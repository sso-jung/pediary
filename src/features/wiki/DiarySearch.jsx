import { useRef, useState } from 'react';
import { Viewer } from '@toast-ui/react-editor';
import { useAuthStore } from '../../store/authStore';
import { fetchDiarySearchYear } from '../../lib/wikiApi';
import { fetchCareRoutineYear } from '../../lib/careApi';
import DiaryOptionSelectField from './DiaryOptionSelectField';
import CalendarDropdown from './CalendarDropdown';
import { normalizeOptionValue, normalizeOptionValues } from './DiarySelectUtils';

function getSearchText(property, value) {
    if (!value) return '';
    if (property?.type === 'care') return `${value.name} · ${value.status === 'done' ? '완료' : value.status === 'skipped' ? '건너뜀' : '예정'} · ${value.routine_id == null ? '그날만' : '반복'}`;
    if (property?.type === 'select') return normalizeOptionValue(value.option)?.name || '';
    if (property?.type === 'multi_select') return normalizeOptionValues(value.options).map((option) => option.name).join(', ');
    if (property?.type === 'random_pick') return [normalizeOptionValue(value.option)?.name, value.text].filter(Boolean).join(', ');
    if (property?.type === 'period') return [value.start, value.end].filter(Boolean).join(' ~ ');
    if (property?.type === 'number_list') return (value.numbers || []).filter((number) => number !== '' && number != null).join(', ');
    if (property?.type === 'check_list') return (value.items || []).filter((item) => item.checked).map((item) => item.text).filter(Boolean).join(', ');
    if (property?.type === 'goal') return (value.items || []).filter((item) => item.checked).map((item) => item.name).filter(Boolean).join(', ');
    if (property?.type === 'number') return value.number === '' || value.number == null ? '' : String(value.number);
    if (property?.type === 'date') return value.date || '';
    return value.text || '';
}

function getOperators(type) {
    const presence = [{ value: 'has_value', label: '값이 있음' }, { value: 'is_empty', label: '비어 있음' }];
    if (type === 'multi_select') return [{ value: 'any', label: '하나 포함' }, { value: 'all', label: '모두 포함' }, ...presence];
    if (type === 'select') return [{ value: 'eq', label: '일치' }, { value: 'neq', label: '일치하지 않음' }, ...presence];
    if (type === 'number' || type === 'date') return [
        { value: 'eq', label: '같음' }, { value: 'gte', label: '이상' }, { value: 'lte', label: '이하' },
        ...presence,
    ];
    return [{ value: 'includes', label: '포함' }, { value: 'eq', label: '일치' }, ...presence];
}

function hasSearchValue(property, value) {
    if (!value) return false;
    if (property.type === 'care') return !!String(value.name || '').trim();
    if (property.type === 'select') return !!normalizeOptionValue(value.option)?.name;
    if (property.type === 'multi_select') return normalizeOptionValues(value.options).length > 0;
    if (property.type === 'random_pick') return !!normalizeOptionValue(value.option)?.name || !!String(value.text || '').trim();
    if (property.type === 'period') return !!value.start || !!value.end;
    if (property.type === 'number_list') return (value.numbers || []).some((number) => number !== '' && number != null);
    if (property.type === 'check_list') return (value.items || []).some((item) => !!String(item.text || '').trim());
    if (property.type === 'goal') return (value.items || []).some((item) => item.checked);
    if (property.type === 'number') return value.number !== '' && value.number != null;
    if (property.type === 'date') return !!value.date;
    return !!String(value.text || '').trim();
}

function matchesCondition(property, value, condition) {
    if (property.type === 'care') {
        if ((condition.status || 'recorded') === 'recorded' && value.routine_id != null && value.status === 'pending') return false;
        if (condition.status && !['recorded', 'all'].includes(condition.status) && value.status !== condition.status) return false;
        if (condition.routineType === 'oneoff' && value.routine_id != null) return false;
        if (condition.routineType === 'repeat' && value.routine_id == null) return false;
    }
    if (condition.operator === 'has_value' || condition.operator === 'is_empty') return hasSearchValue(property, value);
    const text = getSearchText(property, value);
    if (!text) return false;
    if (property.type === 'care') {
        if (!String(condition.value).trim()) return true;
        const name = value.name.toLocaleLowerCase();
        const expected = String(condition.value).toLocaleLowerCase();
        return condition.operator === 'includes' ? name.includes(expected) : name === expected;
    }
    if (property.type === 'multi_select') {
        const names = normalizeOptionValues(value.options).map((option) => option.name.toLocaleLowerCase());
        return condition.operator === 'all'
            ? condition.value.every((name) => names.includes(name.toLocaleLowerCase()))
            : condition.value.some((name) => names.includes(name.toLocaleLowerCase()));
    }
    if (property.type === 'number') {
        const actual = Number(value.number);
        const expected = Number(condition.value);
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
        if (condition.operator === 'gte') return actual >= expected;
        if (condition.operator === 'lte') return actual <= expected;
        return actual === expected;
    }
    if (property.type === 'date') {
        if (condition.operator === 'gte') return text >= condition.value;
        if (condition.operator === 'lte') return text <= condition.value;
        return text === condition.value;
    }
    const actual = text.toLocaleLowerCase();
    const expected = String(condition.value).toLocaleLowerCase();
    if (condition.operator === 'neq') return actual !== expected;
    return condition.operator === 'includes' ? actual.includes(expected) : actual === expected;
}

export default function DiarySearch({ properties = [], propertyOptions = [], yearOptions = [], onOpenDiary }) {
    const user = useAuthStore((state) => state.user);
    const [year, setYear] = useState(new Date().getFullYear());
    const [conditions, setConditions] = useState([{ id: crypto.randomUUID(), propertyId: '', operator: 'includes', value: '' }]);
    const [combine, setCombine] = useState('and');
    const [results, setResults] = useState(null);
    const [shown, setShown] = useState(50);
    const [expandedDate, setExpandedDate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const searchRunRef = useRef(0);
    const searchableProperties = properties.some((property) => property.type === 'care')
        ? properties : [...properties, { id: '__care__', name: '가꿈 루틴', type: 'care' }];
    const propertyById = new Map(searchableProperties.map((property) => [String(property.id), property]));

    const clearResults = () => {
        searchRunRef.current += 1;
        setResults(null);
        setExpandedDate(null);
        setLoading(false);
        setError('');
    };

    const updateCondition = (index, patch) => {
        clearResults();
        setConditions((current) => current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...patch } : item,
        ));
    };

    const runSearch = async (event) => {
        event.preventDefault();
        const selectedYear = Number(year);
        if (!Number.isInteger(selectedYear) || selectedYear < 1000 || selectedYear > 9998) {
            setError('연도를 확인해 줘.');
            return;
        }
        if (conditions.some((condition) => !condition.propertyId || (!['has_value', 'is_empty'].includes(condition.operator) && propertyById.get(condition.propertyId)?.type !== 'care' && (Array.isArray(condition.value) ? condition.value.length === 0 : String(condition.value).trim() === '')))) {
            setError('검색 조건의 속성과 값을 입력해 줘.');
            return;
        }
        if (conditions.length === 0) {
            setError('속성 조건을 추가해 줘.');
            return;
        }

        const searchRun = ++searchRunRef.current;
        setLoading(true);
        setError('');
        setResults(null);
        try {
            const [diaries, careRows] = await Promise.all([
                fetchDiarySearchYear({ userId: user?.id, year: selectedYear }),
                conditions.some((condition) => propertyById.get(condition.propertyId)?.type === 'care' || condition.operator === 'is_empty') ? fetchCareRoutineYear(selectedYear) : [],
            ]);
            if (searchRun !== searchRunRef.current) return;
            const dates = new Map(diaries.map((diary) => [diary.diary_date, { ...diary, careRows: [] }]));
            const includePending = conditions.some((condition) => propertyById.get(condition.propertyId)?.type === 'care'
                && condition.operator !== 'is_empty' && ['all', 'pending'].includes(condition.status));
            const visibleCareRows = careRows.filter((row) => !row.hidden);
            visibleCareRows.forEach((row) => {
                if (row.routine_id != null && row.status === 'pending' && !includePending) return;
                if (!dates.has(row.routine_date)) dates.set(row.routine_date, { diary_date: row.routine_date, title: '', content_markdown: '', diary_property_values: [], careRows: [] });
            });
            visibleCareRows.forEach((row) => {
                if (!dates.has(row.routine_date)) return;
                dates.get(row.routine_date).careRows.push(row);
            });
            const careProperty = searchableProperties.find((property) => property.type === 'care');
            const found = [...dates.values()].map((diary) => {
                const values = (diary.diary_property_values || [])
                    .map((entry) => ({ property: propertyById.get(String(entry.property_id)), value: entry.value }))
                    .filter((entry) => entry.property && hasSearchValue(entry.property, entry.value));
                if (careProperty) values.push(...diary.careRows.map((row) => ({ property: careProperty, value: row })));
                const matched = conditions.map((condition) => {
                    const entry = values.find((item) => String(item.property.id) === condition.propertyId
                        && matchesCondition(item.property, item.value, condition));
                    return condition.operator === 'is_empty'
                        ? (entry ? null : { property: propertyById.get(condition.propertyId), value: null, empty: true })
                        : entry;
                });
                const conditionMatches = combine === 'and' ? matched.every(Boolean) : matched.some(Boolean);
                if (!conditionMatches) return null;
                return { ...diary, values, matched: [...new Set(matched.filter(Boolean))] };
            }).filter(Boolean).sort((a, b) => b.diary_date.localeCompare(a.diary_date));
            setResults(found);
            setShown(50);
            setExpandedDate(null);
        } catch (searchError) {
            if (searchRun === searchRunRef.current) setError(searchError.message || '검색 중 오류가 발생했어.');
        } finally {
            if (searchRun === searchRunRef.current) setLoading(false);
        }
    };

    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 text-xs text-[var(--color-text-main)]">
            <form onSubmit={runSearch} className="rounded-lg border border-border-subtle p-3">
                <div className="flex flex-wrap items-end gap-2 border-b border-border-subtle pb-3">
                    <div>
                        <span className="mb-1 block text-[11px] text-[var(--color-text-muted)]">검색 연도</span>
                        <CalendarDropdown className="w-[82px] sm:w-[86px]" value={year} label={`${year}년`} options={yearOptions.map((value) => ({ value, label: `${value}년` }))} onChange={(value) => { clearResults(); setYear(value); }} />
                    </div>
                    {conditions.length > 1 && <div className="w-[156px]">
                        <span className="mb-1 block text-[11px] text-[var(--color-text-muted)]">조건 연결</span>
                        <CalendarDropdown value={combine} label={combine === 'and' ? '모두 만족 (AND)' : '하나라도 (OR)'} options={[{ value: 'and', label: '모두 만족 (AND)' }, { value: 'or', label: '하나라도 (OR)' }]} onChange={(value) => { clearResults(); setCombine(value); }} />
                    </div>}
                    <button type="submit" disabled={loading || !user?.id} className="ui-control h-[30px] rounded-md px-3 text-[12px] font-medium disabled:opacity-50">{loading ? '검색 중...' : '검색'}</button>
                </div>
                <div className="mt-3 space-y-2">
                    {conditions.map((condition, index) => {
                        const property = propertyById.get(condition.propertyId);
                        const options = propertyOptions.filter((option) => String(option.property_id) === condition.propertyId);
                        const isSelect = property?.type === 'select' || property?.type === 'multi_select';
                        return (
                            <div key={condition.id} className="rounded-lg border border-border-subtle p-2.5">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="font-medium">조건 {index + 1}</span>
                                    <button type="button" onClick={() => { clearResults(); setConditions((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]" aria-label={`${index + 1}번째 조건 삭제`}>삭제</button>
                                </div>
                                <div className={`grid grid-cols-1 gap-2 ${['has_value', 'is_empty'].includes(condition.operator) ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                                    <div className="min-w-0">
                                        <span className="mb-1 block text-[11px] text-[var(--color-text-muted)]">속성</span>
                                        <CalendarDropdown value={condition.propertyId} label={property?.name || '속성 선택'} options={searchableProperties.map((item) => ({ value: String(item.id), label: item.name }))} onChange={(value) => updateCondition(index, { propertyId: value, operator: getOperators(propertyById.get(value)?.type)[0].value, value: '', status: 'recorded', routineType: 'all' })} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="mb-1 block text-[11px] text-[var(--color-text-muted)]">비교</span>
                                        <CalendarDropdown value={condition.operator} label={getOperators(property?.type).find((item) => item.value === condition.operator)?.label || '포함'} options={getOperators(property?.type)} onChange={(value) => updateCondition(index, { operator: value })} />
                                    </div>
                                    {!['has_value', 'is_empty'].includes(condition.operator) && <div className="min-w-0">
                                        <span className="mb-1 block text-[11px] text-[var(--color-text-muted)]">값</span>
                                        {isSelect ? (
                                            <DiaryOptionSelectField value={property.type === 'multi_select' ? (Array.isArray(condition.value) ? condition.value.map((name) => ({ name })) : []) : condition.value ? { name: condition.value } : null} options={options} multiple={property.type === 'multi_select'} onChange={(value) => updateCondition(index, { value: property.type === 'multi_select' ? value.map((option) => option.name) : value?.name || '' })} onInputCommit={(name) => updateCondition(index, { value: property.type === 'multi_select' ? [...(Array.isArray(condition.value) ? condition.value : []).filter((item) => item.toLocaleLowerCase() !== name.toLocaleLowerCase()), name] : name })} placeholder="값 선택 또는 입력" />
                                        ) : (
                                            <input aria-label={`${index + 1}번째 값`} type={property?.type === 'number' ? 'number' : property?.type === 'date' ? 'date' : 'text'} value={condition.value} onChange={(event) => updateCondition(index, { value: event.target.value })} placeholder={property?.type === 'care' ? '이름 (비우면 전체)' : '값 입력'} className="ui-input h-[30px] w-full !rounded-md !px-2 !py-0 text-[12px]" />
                                        )}
                                    </div>}
                                </div>
                                {property?.type === 'care' && <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div className="min-w-0">
                                        <span className="mb-1 block text-[11px] text-[var(--color-text-muted)]">상태</span>
                                        <CalendarDropdown value={condition.status || 'recorded'} label={{ recorded: '기록된 일정', all: '모든 일정', done: '완료', skipped: '건너뜀', pending: '예정' }[condition.status || 'recorded']} options={[{ value: 'recorded', label: '기록된 일정' }, { value: 'all', label: '모든 일정' }, { value: 'done', label: '완료' }, { value: 'skipped', label: '건너뜀' }, { value: 'pending', label: '예정' }]} onChange={(value) => updateCondition(index, { status: value })} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="mb-1 block text-[11px] text-[var(--color-text-muted)]">유형</span>
                                        <CalendarDropdown value={condition.routineType || 'all'} label={{ all: '전체', oneoff: '그날만', repeat: '반복' }[condition.routineType || 'all']} options={[{ value: 'all', label: '전체' }, { value: 'oneoff', label: '그날만' }, { value: 'repeat', label: '반복' }]} onChange={(value) => updateCondition(index, { routineType: value })} />
                                    </div>
                                </div>}
                            </div>
                        );
                    })}
                </div>
                <button type="button" onClick={() => { clearResults(); setConditions((current) => [...current, { id: crypto.randomUUID(), propertyId: '', operator: 'includes', value: '' }]); }} className="ui-control mt-3 h-[30px] rounded-md px-3 text-[12px]">+ 조건 추가</button>
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">숨겨진 속성도 검색해. 체크 목록과 목표의 단어 비교는 완료한 항목만 검색해. 가꿈의 기록된 일정은 그날만 등록한 일정과 완료·건너뜀으로 기록된 반복 루틴이야. 비어 있음은 해당 연도에 기록이 있는 날짜에서 찾아.</p>
            </form>

            {error && <p role="alert" className="mt-3 text-red-500">{error}</p>}
            {results && <p className="mt-4 px-1 text-xs font-medium text-[var(--color-text-muted)]">{year}년 · 일치하는 날짜 {results.length}일</p>}
            {results?.length === 0 && <p className="mt-3 px-1 text-[var(--color-text-muted)]">일치하는 기록이 없어.</p>}
            <div className="mt-2 space-y-2">
                {results?.slice(0, shown).map((diary) => (
                    <div key={diary.diary_date} className="rounded-lg border border-border-subtle p-3">
                        <div className="flex items-center justify-between gap-2">
                            <button type="button" onClick={() => setExpandedDate((date) => date === diary.diary_date ? null : diary.diary_date)} aria-expanded={expandedDate === diary.diary_date} className="min-w-0 text-left text-xs font-semibold">{diary.diary_date}{diary.title && ` · ${diary.title}`}</button>
                            <button type="button" onClick={() => onOpenDiary(diary.diary_date)} className="ui-control shrink-0 rounded-md px-2 py-1 text-[11px]">날짜 열기</button>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[11px] text-[var(--color-text-muted)]">{diary.matched.slice(0, 4).map((entry) => `${entry.property.name}: ${entry.empty ? '비어 있음' : getSearchText(entry.property, entry.value) || '값이 있음'}`).join(' · ')}</p>
                        {expandedDate === diary.diary_date && (
                            <div className="mt-3 space-y-1 border-t pt-2 text-xs" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                {diary.content_markdown && <div className="mb-2 min-w-0 overflow-x-auto"><Viewer key={diary.diary_date} initialValue={diary.content_markdown} /></div>}
                                {diary.values.map((entry, index) => <p key={`${entry.property.id}-${index}`}><strong>{entry.property.name}</strong> · {getSearchText(entry.property, entry.value) || '값이 있음'}</p>)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {results && shown < results.length && <button type="button" onClick={() => setShown((count) => count + 50)} className="ui-control mt-3 w-full rounded-lg px-3 py-2">더 보기</button>}
        </div>
    );
}
