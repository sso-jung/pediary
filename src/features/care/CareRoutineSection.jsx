import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteCareOneoff, fetchCareRoutineDay, fetchCareRoutineSettings, patchCareRoutineDay,
    saveCareOneoff, saveCareRoutine, setCareOneoffStatus,
} from '../../lib/careApi';

const inputClass = 'ui-control w-full min-w-0 rounded-lg border px-3 py-2 text-sm';
const buttonClass = 'ui-control rounded-lg border px-3 py-2 text-sm';
const weekdays = [[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [7, '일']];
const emptyRoutine = { name: '', repeat_type: 'daily', weekdays: [], interval_days: '2' };
const localToday = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const repeatLabel = (routine) => {
    if (routine.repeat_type === 'daily') return '매일';
    if (routine.repeat_type === 'interval') return `${routine.interval_days}일마다`;
    return `매주 ${weekdays.filter(([number]) => routine.weekdays?.includes(number)).map(([, name]) => name).join('·')}`;
};

export default function CareRoutineSection({ userId, date }) {
    const queryClient = useQueryClient();
    const today = localToday();
    const [routineForm, setRoutineForm] = useState(null);
    const [oneoffForm, setOneoffForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const dayQuery = useQuery({ queryKey: ['care-routine-day', userId, date], queryFn: () => fetchCareRoutineDay(date), enabled: !!userId });
    const settingsQuery = useQuery({ queryKey: ['care-routine-settings', userId, date], queryFn: () => fetchCareRoutineSettings(date), enabled: !!userId });
    const dayItems = dayQuery.data || [];
    const settings = settingsQuery.data || [];
    const completed = dayItems.filter((item) => !item.hidden && item.status === 'done').length;
    const visible = dayItems.filter((item) => !item.hidden).length;

    const run = async (action) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['care-routine-day', userId] }),
                queryClient.invalidateQueries({ queryKey: ['care-routine-settings', userId] }),
            ]);
        } catch (e) {
            setError(e.message || '루틴을 저장하지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const submitRoutine = async (event) => {
        event.preventDefault();
        if (!routineForm.name.trim() || routineForm.name.trim().length > 120 ||
            (routineForm.repeat_type === 'weekdays' && !routineForm.weekdays.length) ||
            (routineForm.repeat_type === 'interval' && (!Number.isInteger(Number(routineForm.interval_days)) ||
                Number(routineForm.interval_days) < 1 || Number(routineForm.interval_days) > 365))) {
            setError('루틴 이름과 반복 규칙을 확인해 주세요.');
            return;
        }
        await run(async () => {
            await saveCareRoutine(routineForm, date);
            setRoutineForm(null);
        });
    };

    const submitOneoff = async (event) => {
        event.preventDefault();
        if (!oneoffForm.oneoff_name.trim() || oneoffForm.oneoff_name.trim().length > 120) {
            setError('항목 이름을 확인해 주세요.');
            return;
        }
        await run(async () => {
            await saveCareOneoff(userId, date, oneoffForm);
            setOneoffForm(null);
        });
    };

    const editToday = (item) => {
        const name = window.prompt('이 날짜에만 표시할 이름', item.name);
        if (name === null) return;
        if (!name.trim() || name.trim().length > 120) {
            setError('항목 이름은 1~120자로 입력해 주세요.');
            return;
        }
        if (item.routine_id) run(() => patchCareRoutineDay(item.routine_id, date, 'rename', name));
        else run(() => saveCareOneoff(userId, date, { id: item.day_id, oneoff_name: name }));
    };

    return (
        <section className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-semibold">{date} 루틴</h2><p className="page-text-muted text-xs">완료 {completed}/{visible} · 체크는 선택한 날짜에만 적용됩니다.</p></div>
                <button type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); setOneoffForm({ oneoff_name: '' }); }}>그날만 추가</button>
            </div>
            {error && <p role="alert" className="ui-danger-text text-sm">{error}</p>}
            {dayQuery.isPending && <p className="page-text-muted text-sm">루틴을 불러오는 중...</p>}
            {dayQuery.isError && <p role="alert" className="ui-danger-text text-sm">루틴을 불러오지 못했습니다: {dayQuery.error.message}</p>}
            {dayItems.map((item) => <div key={item.routine_id ? `routine-${item.routine_id}` : `once-${item.day_id}`} className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border-subtle py-2 text-sm">
                <span className={`min-w-0 flex-1 break-words ${item.hidden ? 'page-text-muted line-through' : ''}`}>{item.name}{!item.routine_id && <span className="page-text-muted ml-1 text-xs">그날만</span>}</span>
                {!item.hidden && <div className="flex flex-wrap gap-1" role="group" aria-label={`${item.name} 상태`}>
                    {[['pending', '미완료'], ['done', '완료'], ['skipped', '건너뜀']].map(([status, label]) =>
                        <button key={status} type="button" className={`${buttonClass} ${item.status === status ? 'font-semibold text-[var(--color-accent)]' : ''}`} aria-pressed={item.status === status} disabled={busy} onClick={() => run(() => item.routine_id ? patchCareRoutineDay(item.routine_id, date, status) : setCareOneoffStatus(userId, item.day_id, status))}>{label}</button>)}</div>}
                {!item.hidden && <button type="button" className={buttonClass} disabled={busy} onClick={() => editToday(item)}>그날만 수정</button>}
                <button type="button" className={buttonClass} disabled={busy} onClick={() => {
                    if (item.routine_id) run(() => patchCareRoutineDay(item.routine_id, date, item.hidden ? 'show' : 'hide'));
                    else if (window.confirm('이 날짜의 항목을 삭제할까요?')) run(() => deleteCareOneoff(userId, item.day_id));
                }}>{item.routine_id ? (item.hidden ? '복원' : '그날만 숨김') : '삭제'}</button>
            </div>)}
            {!dayQuery.isPending && !dayQuery.isError && !dayItems.length && <p className="page-text-muted text-sm">이 날짜에 예정된 루틴이 없습니다.</p>}

            <div className="space-y-2 border-t border-border-subtle pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">반복 루틴</h3><button type="button" className={buttonClass} disabled={busy || date < today} onClick={() => { setError(''); setRoutineForm({ ...emptyRoutine }); }}>반복 생성</button></div>
                {date < today && <p className="page-text-muted text-xs">지난 날짜에서는 반복 설정을 변경할 수 없습니다.</p>}
                {settingsQuery.isPending && <p className="page-text-muted text-sm">반복 설정을 불러오는 중...</p>}
                {settingsQuery.isError && <p role="alert" className="ui-danger-text text-sm">반복 설정을 불러오지 못했습니다: {settingsQuery.error.message}</p>}
                {settings.map((routine) => <div key={routine.routine_id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 break-words">{routine.name} <span className="page-text-muted text-xs">{repeatLabel(routine)}</span></span>
                    <button type="button" className={buttonClass} disabled={busy || date < today} onClick={() => { setError(''); setRoutineForm({ ...routine, interval_days: String(routine.interval_days || 2) }); }}>선택일부터 변경</button>
                    <button type="button" className={buttonClass} disabled={busy || date < today} onClick={() => { if (window.confirm(`${date}부터 ${routine.name} 반복을 중지할까요?`)) run(() => saveCareRoutine({ ...routine, repeat_type: 'stopped' }, date)); }}>선택일부터 중지</button>
                </div>)}
            </div>

            {oneoffForm && <form onSubmit={submitOneoff} className="flex flex-wrap items-end gap-2 rounded-xl border border-border-subtle p-3">
                <label className="min-w-48 flex-1 text-sm">그날만 항목<input required maxLength={120} autoFocus value={oneoffForm.oneoff_name} onChange={(event) => setOneoffForm({ ...oneoffForm, oneoff_name: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <button type="button" className={buttonClass} onClick={() => setOneoffForm(null)}>취소</button><button type="submit" className={buttonClass} disabled={busy}>저장</button>
            </form>}

            {routineForm && <form onSubmit={submitRoutine} className="space-y-3 rounded-xl border border-border-subtle p-3">
                <h3 className="font-semibold">{routineForm.routine_id ? `${date}부터 반복 변경` : `${date}부터 반복 생성`}</h3>
                <label className="block text-sm">루틴 이름<input required maxLength={120} value={routineForm.name} onChange={(event) => setRoutineForm({ ...routineForm, name: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <label className="block text-sm">반복 규칙<select value={routineForm.repeat_type} onChange={(event) => setRoutineForm({ ...routineForm, repeat_type: event.target.value })} className={`${inputClass} mt-1`}><option value="daily">매일</option><option value="weekdays">특정 요일</option><option value="interval">일정 주기</option></select></label>
                {routineForm.repeat_type === 'weekdays' && <fieldset className="text-sm"><legend className="mb-2">반복 요일</legend><div className="flex flex-wrap gap-3">{weekdays.map(([number, label]) => <label key={number} className="flex items-center gap-1"><input type="checkbox" checked={routineForm.weekdays?.includes(number) || false} onChange={(event) => setRoutineForm({ ...routineForm, weekdays: event.target.checked ? [...(routineForm.weekdays || []), number] : routineForm.weekdays.filter((day) => day !== number) })} />{label}</label>)}</div></fieldset>}
                {routineForm.repeat_type === 'interval' && <label className="block text-sm">반복 간격 (일)<input required type="number" min="1" max="365" step="1" value={routineForm.interval_days} onChange={(event) => setRoutineForm({ ...routineForm, interval_days: event.target.value })} className={`${inputClass} mt-1`} /></label>}
                <div className="flex justify-end gap-2"><button type="button" className={buttonClass} onClick={() => setRoutineForm(null)}>취소</button><button type="submit" className={buttonClass} disabled={busy}>{busy ? '저장 중...' : '저장'}</button></div>
            </form>}
        </section>
    );
}
