import { CareButton } from './CareControls';
import { CareInput, CareSelect } from './CareControls';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteCareOneoff, fetchCareRoutineDay, fetchCareRoutineSettings, patchCareRoutineDay,
    saveCareOneoff, saveCareRoutine, setCareOneoffStatus,
} from '../../lib/careApi';
import CareActionDialog from './CareActionDialog';

const inputClass = 'ui-input w-full min-w-0 rounded-lg border px-3 py-2 text-sm';
const buttonClass = 'ui-control rounded-lg border px-3 py-2 text-sm';
const weekdays = [[1, '월'], [2, '화'], [3, '수'], [4, '목'], [5, '금'], [6, '토'], [7, '일']];
const emptyRoutine = { name: '', repeat_type: 'daily', weekdays: [], interval_days: '2', month_day: '' };
const localToday = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const repeatLabel = (routine) => {
    if (routine.repeat_type === 'daily') return '매일';
    if (routine.repeat_type === 'interval') return `${routine.interval_days}일마다`;
    if (routine.repeat_type === 'monthly') return `매달 ${routine.month_day}일`;
    return `${routine.repeat_type === 'odd_week' ? '홀수주' : routine.repeat_type === 'even_week' ? '짝수주' : '매주'} ${weekdays.filter(([number]) => routine.weekdays?.includes(number)).map(([, name]) => name).join('·')}`;
};

export default function CareRoutineSection({ userId, date, onBusyChange, dayOnly = false, startWithNew = false }) {
    const queryClient = useQueryClient();
    const today = localToday();
    const dayOnlyLabel = date === today ? '오늘만' : '이 날짜만';
    const [routineForm, setRoutineForm] = useState(null);
    const [oneoffForm, setOneoffForm] = useState(() => startWithNew ? { oneoff_name: '' } : null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [actionDialog, setActionDialog] = useState(null);
    const [deleteRoutineId, setDeleteRoutineId] = useState(null);
    useEffect(() => () => onBusyChange(false), [onBusyChange]);
    const dayQuery = useQuery({ queryKey: ['care-routine-day', userId, date], queryFn: () => fetchCareRoutineDay(date), enabled: !!userId });
    const settingsQuery = useQuery({ queryKey: ['care-routine-settings', userId, date], queryFn: () => fetchCareRoutineSettings(date), enabled: !!userId && !dayOnly });
    const dayItems = dayQuery.data || [];
    const settings = settingsQuery.data || [];
    const completed = dayItems.filter((item) => !item.hidden && item.status === 'done').length;
    const visible = dayItems.filter((item) => !item.hidden).length;
    const hiddenItems = dayItems.filter((item) => item.hidden);

    const run = async (action) => {
        setBusy(true);
        onBusyChange(true);
        setError('');
        try {
            await action();
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['care-routine-day', userId] }),
                queryClient.invalidateQueries({ queryKey: ['care-routine-settings', userId] }),
                queryClient.invalidateQueries({ queryKey: ['care-routine-range', userId] }),
            ]);
        } catch (e) {
            setError(e.message || '루틴을 저장하지 못했습니다.');
        } finally {
            setBusy(false);
            onBusyChange(false);
        }
    };

    const submitRoutine = async (event) => {
        event.preventDefault();
        if (!routineForm.name.trim() || routineForm.name.trim().length > 120 ||
            (['weekdays', 'odd_week', 'even_week'].includes(routineForm.repeat_type) && !routineForm.weekdays.length) ||
            (routineForm.repeat_type === 'interval' && (!Number.isInteger(Number(routineForm.interval_days)) ||
                Number(routineForm.interval_days) < 1 || Number(routineForm.interval_days) > 365)) ||
            (routineForm.repeat_type === 'monthly' && (!Number.isInteger(Number(routineForm.month_day)) ||
                Number(routineForm.month_day) < 1 || Number(routineForm.month_day) > 31))) {
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

    const editToday = (item, name) => {
        if (!name.trim() || name.trim().length > 120) {
            setError('항목 이름은 1~120자로 입력해 주세요.');
            return;
        }
        if (item.routine_id) run(() => patchCareRoutineDay(item.routine_id, date, 'rename', name));
        else run(() => saveCareOneoff(userId, date, { id: item.day_id, oneoff_name: name }));
    };

    return (
        <section className="care-routine min-w-0">
            {error && <p role="alert" className="ui-danger-text text-sm">{error}</p>}
            <div className={dayOnly ? 'care-routine-columns care-routine-day-only' : 'care-routine-columns'}>
            <div className="care-routine-column">
            <div className="care-routine-column-head"><div><h2>{date} 적용 루틴</h2><p className="page-text-muted text-xs">{completed}/{visible} 완료 · 체크는 선택한 날짜에만 적용됩니다.</p></div><CareButton type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); setOneoffForm({ oneoff_name: '' }); }}>{dayOnlyLabel} 추가</CareButton></div>
            {dayQuery.isPending && <p className="page-text-muted text-sm">루틴을 불러오는 중...</p>}
            {dayQuery.isError && <p role="alert" className="ui-danger-text text-sm">루틴을 불러오지 못했습니다: {dayQuery.error.message}</p>}
            {dayItems.filter((item) => !item.hidden).map((item) => <div key={item.routine_id ? `routine-${item.routine_id}` : `once-${item.day_id}`} className="care-routine-row">
                <label className="care-routine-name diary-editor-check-row cursor-pointer"><span className="relative flex h-6 w-6 shrink-0 items-center justify-center"><CareInput type="checkbox" className="peer sr-only" checked={item.status === 'done'} disabled={busy} aria-label={`${item.name} 완료`} onChange={(event) => run(() => item.routine_id ? patchCareRoutineDay(item.routine_id, date, event.target.checked ? 'done' : 'pending') : setCareOneoffStatus(userId, item.day_id, event.target.checked ? 'done' : 'pending'))} /><span className="diary-editor-check-box flex h-4 w-4 items-center justify-center rounded border border-border-subtle bg-[var(--color-page-surface)] text-white transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)] [&>svg]:peer-checked:opacity-100"><svg viewBox="0 0 16 16" className="h-3 w-3 opacity-0 transition" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11 12.5 5" /></svg></span></span><span className={item.status === 'skipped' ? 'page-text-muted line-through' : ''}>{item.name}</span></label>
                <div className="care-routine-row-actions"><CareButton type="button" className={item.status === 'skipped' ? 'care-routine-active' : ''} aria-pressed={item.status === 'skipped'} disabled={busy} onClick={() => run(() => item.routine_id ? patchCareRoutineDay(item.routine_id, date, item.status === 'skipped' ? 'pending' : 'skipped') : setCareOneoffStatus(userId, item.day_id, item.status === 'skipped' ? 'pending' : 'skipped'))}>{item.status === 'skipped' ? '건너뜀 취소' : '건너뜀'}</CareButton>
                <CareButton type="button" disabled={busy} onClick={() => setActionDialog({ message: '이 날짜에만 표시할 이름', initialValue: item.name, onConfirm: (name) => editToday(item, name) })}>{dayOnlyLabel} 수정</CareButton>
                <CareButton type="button" className="ui-danger-text" disabled={busy} onClick={() => {
                    if (item.routine_id) {
                        setDeleteRoutineId(deleteRoutineId === `${date}-${item.routine_id}` ? null : `${date}-${item.routine_id}`);
                    } else setActionDialog({ message: '이 날짜의 항목을 삭제할까요?', onConfirm: () => run(() => deleteCareOneoff(userId, item.day_id)) });
                }}>삭제</CareButton></div>
                {deleteRoutineId === `${date}-${item.routine_id}` && item.routine_id && <div className="care-routine-options flex w-full flex-wrap items-center justify-end gap-2" role="group" aria-label={`${item.name} 삭제 방식`}><span className="page-text-muted mr-auto text-xs">이 루틴을 어떻게 처리할까요?</span><CareButton type="button" className={buttonClass} disabled={busy} onClick={() => { setDeleteRoutineId(null); run(() => patchCareRoutineDay(item.routine_id, date, 'hide')); }}>{dayOnlyLabel} 숨김</CareButton><CareButton type="button" className={buttonClass} disabled={busy || date < today} onClick={() => { setDeleteRoutineId(null); setActionDialog({ message: `${date}부터 ${item.name} 반복을 중지할까요?`, onConfirm: () => run(() => saveCareRoutine({ ...item, repeat_type: 'stopped' }, date)) }); }}>선택일부터 중지</CareButton></div>}
            </div>)}
            {!dayQuery.isPending && !dayQuery.isError && !visible && <p className="page-text-muted text-sm">이 날짜에 예정된 루틴이 없습니다.</p>}
            {!!hiddenItems.length && <div className="care-routine-hidden"><h3>숨긴 루틴</h3>{hiddenItems.map((item) => <div key={item.routine_id} className="care-routine-hidden-row"><span>{item.name}</span><CareButton type="button" disabled={busy} onClick={() => run(() => patchCareRoutineDay(item.routine_id, date, 'show'))}>복원</CareButton></div>)}</div>}

            {oneoffForm && <form onSubmit={submitOneoff} className="care-routine-form care-edit-form flex flex-wrap items-end gap-2">
                <label className="min-w-48 flex-1 text-sm">{dayOnlyLabel} 항목<CareInput required maxLength={120} autoFocus value={oneoffForm.oneoff_name} onChange={(event) => setOneoffForm({ ...oneoffForm, oneoff_name: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <CareButton type="button" className={buttonClass} onClick={() => setOneoffForm(null)}>취소</CareButton><CareButton type="submit" className={buttonClass} disabled={busy}>저장</CareButton>
            </form>}

            </div>
            {!dayOnly && <div className="care-routine-column">
            <div className="care-routine-column-head"><div><h2>등록된 반복 루틴</h2><p className="page-text-muted text-xs">{date} 기준 반복 설정</p></div><CareButton type="button" className={buttonClass} disabled={busy || date < today} onClick={() => { setError(''); setRoutineForm({ ...emptyRoutine, month_day: String(Number(date.slice(-2))) }); }}>반복 생성</CareButton></div>

            {routineForm && <form onSubmit={submitRoutine} className="care-routine-form care-edit-form space-y-3">
                <h3 className="font-semibold">{routineForm.routine_id ? `${date}부터 반복 변경` : `${date}부터 반복 생성`}</h3>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.55fr)]"><label className="block min-w-0 text-sm">루틴 이름<CareInput required autoFocus maxLength={120} value={routineForm.name} onChange={(event) => setRoutineForm({ ...routineForm, name: event.target.value })} className={`${inputClass} mt-1`} /></label>
                <label className="block min-w-0 text-sm">반복 규칙<CareSelect value={routineForm.repeat_type} onChange={(event) => setRoutineForm({ ...routineForm, repeat_type: event.target.value })} className={`${inputClass} mt-1`}><option value="daily">매일</option><option value="weekdays">특정 요일</option><option value="odd_week">홀수주</option><option value="even_week">짝수주</option><option value="interval">N일마다</option><option value="monthly">매달 N일</option></CareSelect></label></div>
                {['weekdays', 'odd_week', 'even_week'].includes(routineForm.repeat_type) && <fieldset className="text-sm"><legend className="mb-2">반복 요일</legend><div className="flex flex-wrap gap-3">{weekdays.map(([number, label]) => <label key={number} className="flex items-center gap-1"><CareInput type="checkbox" checked={routineForm.weekdays?.includes(number) || false} onChange={(event) => setRoutineForm({ ...routineForm, weekdays: event.target.checked ? [...(routineForm.weekdays || []), number] : routineForm.weekdays.filter((day) => day !== number) })} />{label}</label>)}</div>{['odd_week', 'even_week'].includes(routineForm.repeat_type) && <p className="page-text-muted mt-2 text-xs">ISO 주차 기준으로 선택한 요일에 반복합니다.</p>}</fieldset>}
                {routineForm.repeat_type === 'interval' && <label className="block w-32 text-sm">반복 간격 (일)<CareInput required type="number" min="1" max="365" step="1" value={routineForm.interval_days} onChange={(event) => setRoutineForm({ ...routineForm, interval_days: event.target.value })} className={`${inputClass} mt-1`} /></label>}
                {routineForm.repeat_type === 'monthly' && <div><label className="block w-32 text-sm">매달 날짜<CareInput required type="number" min="1" max="31" step="1" value={routineForm.month_day} onChange={(event) => setRoutineForm({ ...routineForm, month_day: event.target.value })} className={`${inputClass} mt-1`} /></label><p className="page-text-muted mt-1 text-xs">해당 날짜가 없는 달은 건너뜁니다.</p></div>}
                <div className="flex justify-end gap-2"><CareButton type="button" className={buttonClass} onClick={() => setRoutineForm(null)}>취소</CareButton><CareButton type="submit" className={buttonClass} disabled={busy}>{busy ? '저장 중...' : '저장'}</CareButton></div>
            </form>}

            <div className="care-routine-settings">
                {date < today && <p className="page-text-muted text-xs">지난 날짜에서는 반복 설정을 변경할 수 없습니다.</p>}
                {settingsQuery.isPending && <p className="page-text-muted text-sm">반복 설정을 불러오는 중...</p>}
                {settingsQuery.isError && <p role="alert" className="ui-danger-text text-sm">반복 설정을 불러오지 못했습니다: {settingsQuery.error.message}</p>}
                {settings.map((routine) => <div key={routine.routine_id} className="care-routine-setting">
                    <strong>{routine.name}</strong><span className="care-routine-rule">{repeatLabel(routine)}</span>
                    <div className="care-routine-setting-actions"><CareButton type="button" disabled={busy || date < today} onClick={() => { setError(''); setRoutineForm({ ...routine, interval_days: String(routine.interval_days || 2), month_day: String(routine.month_day || Number(date.slice(-2))) }); }}>변경</CareButton>
                    <CareButton type="button" className="ui-danger-text" disabled={busy || date < today} onClick={() => setActionDialog({ message: `${date}부터 ${routine.name} 반복을 중지할까요?`, onConfirm: () => run(() => saveCareRoutine({ ...routine, repeat_type: 'stopped' }, date)) })}>중지</CareButton></div>
                </div>)}
                {!settingsQuery.isPending && !settingsQuery.isError && !settings.length && <p className="page-text-muted text-sm">등록된 반복 루틴이 없습니다.</p>}
            </div>
            </div>}
            </div>

            {actionDialog && <CareActionDialog message={actionDialog.message} initialValue={actionDialog.initialValue} onClose={() => { if (!busy) setActionDialog(null); }} onConfirm={(value) => { setActionDialog(null); actionDialog.onConfirm(value); }} />}
        </section>
    );
}
