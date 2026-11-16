import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteCareMeasurement, deleteCareWorkout, fetchCareDailyEnergy, fetchCareMeasurements,
    fetchCarePeriodSummary, fetchCareWorkouts, saveCareDailyEnergy, saveCareMeasurement, saveCareWorkout,
} from '../../lib/careApi';

const inputClass = 'ui-control w-full min-w-0 rounded-lg border px-3 py-2 text-sm';
const buttonClass = 'ui-control rounded-lg border px-3 py-2 text-sm';
const fields = [
    ['weight_kg', '체중'], ['body_fat_kg', '체지방량'],
    ['muscle_kg', '골격근량'], ['body_water_kg', '체수분량'],
];
const format = (value) => Math.round(Number(value) * 10) / 10;
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validOptional = (value, positive = false) => value === '' || (Number.isFinite(Number(value)) && Number(value) <= 999999999.999 && (positive ? Number(value) > 0 : Number(value) >= 0));
const balance = (day) => day && day.total_kcal != null && (Number(day.meal_count) > 0 || day.intake_confirmed)
    ? Number(day.total_kcal) - Number(day.intake_kcal) : null;
const provisional = (day) => day.summary_date === localDate(new Date()) || !day.intake_confirmed;
const summary = (days) => {
    const included = days.filter((day) => balance(day) != null);
    return { count: included.length, value: included.reduce((sum, day) => sum + balance(day), 0), provisionalCount: included.filter(provisional).length };
};

export default function CareDailyRecords({ userId, date, onDateChange, section }) {
    const queryClient = useQueryClient();
    const [measurementForm, setMeasurementForm] = useState(null);
    const [workoutForm, setWorkoutForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const current = new Date(`${date}T12:00:00`);
    const weekday = current.getDay();
    const weekStartDate = new Date(current);
    weekStartDate.setDate(current.getDate() - weekday);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    const weekStart = localDate(weekStartDate);
    const weekEnd = localDate(weekEndDate);
    const monthStart = `${date.slice(0, 7)}-01`;
    const monthEnd = localDate(new Date(current.getFullYear(), current.getMonth() + 1, 0));
    const monthOffset = new Date(`${monthStart}T12:00:00`).getDay();
    const measurementsQuery = useQuery({ queryKey: ['care-measurements', userId, date], queryFn: () => fetchCareMeasurements(userId, date), enabled: !!userId && section === 'body' });
    const workoutsQuery = useQuery({ queryKey: ['care-workouts', userId, date], queryFn: () => fetchCareWorkouts(userId, date), enabled: !!userId && (section === 'workout' || section === 'energy') });
    const energyQuery = useQuery({ queryKey: ['care-energy', userId, date], queryFn: () => fetchCareDailyEnergy(userId, date), enabled: !!userId && section === 'energy' });
    const weekQuery = useQuery({ queryKey: ['care-period', userId, weekStart, weekEnd], queryFn: () => fetchCarePeriodSummary(weekStart, weekEnd), enabled: !!userId && section === 'energy' });
    const monthQuery = useQuery({ queryKey: ['care-period', userId, monthStart, monthEnd], queryFn: () => fetchCarePeriodSummary(monthStart, monthEnd), enabled: !!userId && section === 'energy' });
    const measurements = measurementsQuery.data || [];
    const workouts = workoutsQuery.data || [];
    const monthDays = monthQuery.data || [];
    const selectedDay = monthDays.find((day) => day.summary_date === date);
    const dailyBalance = balance(selectedDay);
    const weekBalance = summary(weekQuery.data || []);
    const monthBalance = summary(monthDays);

    const run = async (action, refresh, close) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await Promise.all(refresh.map((key) => queryClient.invalidateQueries({ queryKey: key })));
            close?.();
        } catch (e) {
            setError(e.message || '저장에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const refreshPeriod = ['care-period', userId];
    const submitMeasurement = (event) => {
        event.preventDefault();
        if (!measurementForm.measured_at || fields.every(([key]) => measurementForm[key] === '') ||
            fields.some(([key]) => !validOptional(measurementForm[key], key === 'weight_kg'))) {
            setError('측정 시각과 하나 이상의 측정값을 확인해 주세요.');
            return;
        }
        run(() => saveCareMeasurement(userId, measurementForm), [['care-measurements', userId, date], ['care-measurement-chart', userId], ['care-history', userId]], () => setMeasurementForm(null));
    };

    const submitWorkout = (event) => {
        event.preventDefault();
        if (!workoutForm.name.trim() || workoutForm.name.trim().length > 120 || workoutForm.note.length > 5000 ||
            !validOptional(workoutForm.kcal) || !validOptional(workoutForm.duration_minutes) ||
            (workoutForm.duration_minutes !== '' && (!Number.isInteger(Number(workoutForm.duration_minutes)) || Number(workoutForm.duration_minutes) > 1440))) {
            setError('운동명, 운동 시간, 열량을 확인해 주세요.');
            return;
        }
        run(() => saveCareWorkout(userId, workoutForm), [['care-workouts', userId, date], refreshPeriod, ['care-history', userId]], () => setWorkoutForm(null));
    };

    const submitEnergy = (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        if (!validOptional(values.active_kcal) || !validOptional(values.total_kcal)) {
            setError('활동·총 소모 열량을 확인해 주세요.');
            return;
        }
        run(() => saveCareDailyEnergy(userId, date, { ...values, intake_confirmed: values.intake_confirmed === 'on' }),
            [['care-energy', userId, date], refreshPeriod]);
    };

    return <>
        {error && <div role="alert" className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">{error}</div>}
        {(section === 'body' || section === 'workout') && <div className="min-w-0 space-y-4">
            {section === 'body' &&
            <section className="min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">신체 측정</h2><button type="button" className="ui-btn-success rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => { setError(''); setMeasurementForm({ measurement_date: date, measured_at: new Date().toTimeString().slice(0, 5), weight_kg: '', body_fat_kg: '', muscle_kg: '', body_water_kg: '' }); }}>+ 측정 기록</button></div>
                {measurementsQuery.isPending && <p className="page-text-muted text-sm">측정을 불러오는 중...</p>}
                {measurementsQuery.isError && <p role="alert" className="ui-danger-text text-sm">측정을 불러오지 못했습니다: {measurementsQuery.error.message}</p>}
                {!measurementsQuery.isPending && !measurements.length && <p className="page-text-muted text-sm">기록된 측정이 없습니다.</p>}
                {measurements.map((measurement) => <div key={measurement.id} className="page-list-item flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 break-words">{measurement.measured_at.slice(0, 5)} · {fields.filter(([key]) => measurement[key] != null).map(([key, label]) => `${label} ${measurement[key]} kg`).join(' · ')}</div>
                    <div className="flex gap-1"><button type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); setMeasurementForm(Object.fromEntries(Object.entries(measurement).map(([key, value]) => [key, value == null ? '' : String(value)]))); }}>수정</button><button type="button" className={buttonClass} disabled={busy} onClick={() => { if (window.confirm('이 측정을 삭제할까요?')) run(() => deleteCareMeasurement(userId, measurement.id), [['care-measurements', userId, date], ['care-measurement-chart', userId], ['care-history', userId]]); }}>삭제</button></div>
                </div>)}
            </section>}
            {section === 'workout' &&
            <section className="min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">운동 기록</h2><button type="button" className="ui-btn-success rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => { setError(''); setWorkoutForm({ workout_date: date, name: '', started_at: '', duration_minutes: '', kcal: '', note: '' }); }}>+ 운동 기록</button></div>
                {workoutsQuery.isPending && <p className="page-text-muted text-sm">운동을 불러오는 중...</p>}
                {workoutsQuery.isError && <p role="alert" className="ui-danger-text text-sm">운동을 불러오지 못했습니다: {workoutsQuery.error.message}</p>}
                {!workoutsQuery.isPending && !workouts.length && <p className="page-text-muted text-sm">기록된 운동이 없습니다.</p>}
                {workouts.map((workout) => <div key={workout.id} className="page-list-item flex min-w-0 flex-wrap items-start justify-between gap-2 text-sm">
                    <div className="min-w-0 break-words"><strong>{workout.name}</strong>{workout.started_at && ` · ${workout.started_at.slice(0, 5)}`}{workout.duration_minutes != null && ` · ${workout.duration_minutes}분`}{workout.kcal != null && ` · ${workout.kcal} kcal`}{workout.note && <p className="page-text-muted mt-1 whitespace-pre-wrap">{workout.note}</p>}</div>
                    <div className="flex gap-1"><button type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); setWorkoutForm({ ...workout, started_at: workout.started_at?.slice(0, 5) || '', duration_minutes: workout.duration_minutes == null ? '' : String(workout.duration_minutes), kcal: workout.kcal == null ? '' : String(workout.kcal) }); }}>수정</button><button type="button" className={buttonClass} disabled={busy} onClick={() => { if (window.confirm('이 운동을 삭제할까요?')) run(() => deleteCareWorkout(userId, workout.id), [['care-workouts', userId, date], refreshPeriod, ['care-history', userId]]); }}>삭제</button></div>
                </div>)}
            </section>}
        </div>}
        {section === 'energy' &&
        <section className="min-w-0 space-y-4">
            <h2 className="text-lg font-semibold">에너지 수지</h2>
            {energyQuery.isError && <p role="alert" className="ui-danger-text text-sm">에너지를 불러오지 못했습니다: {energyQuery.error.message}</p>}
            {monthQuery.isError && <p role="alert" className="ui-danger-text text-sm">기간 집계를 불러오지 못했습니다: {monthQuery.error.message}</p>}
            {energyQuery.isSuccess && <form key={`${date}-${energyQuery.data?.updated_at || ''}`} onSubmit={submitEnergy} className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                    <label className="min-w-0 text-sm">활동 소모 (kcal)<input name="active_kcal" type="number" min="0" max="999999999.999" step="0.001" defaultValue={energyQuery.data?.active_kcal ?? ''} className={`${inputClass} mt-1`} /></label>
                    <label className="min-w-0 text-sm">총 소모 (kcal)<input name="total_kcal" type="number" min="0" max="999999999.999" step="0.001" defaultValue={energyQuery.data?.total_kcal ?? ''} className={`${inputClass} mt-1`} /></label>
                </div>
                <p className="page-text-muted text-xs">총 소모는 직접 입력한 값입니다. 활동·운동 열량은 더하지 않습니다.</p>
                <label className="flex items-center gap-2 text-sm"><input name="intake_confirmed" type="checkbox" defaultChecked={energyQuery.data?.intake_confirmed || false} /> 이 날짜의 식사 기록 완료 (식사 0건이면 섭취 0 kcal)</label>
                <button type="submit" className={buttonClass} disabled={busy}>{busy ? '저장 중...' : '에너지 저장'}</button>
            </form>}
            {selectedDay && <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>섭취: {Number(selectedDay.meal_count) > 0 || selectedDay.intake_confirmed ? `${format(selectedDay.intake_kcal)} kcal` : '미기록'}</div>
                <div>운동: {selectedDay.workout_kcal == null ? '열량 미기록' : `${format(selectedDay.workout_kcal)} kcal${workouts.some((workout) => workout.kcal == null) ? ' (일부 기록 합계)' : ''}`} · {selectedDay.workout_minutes == null ? '시간 미기록' : `${selectedDay.workout_minutes}분${workouts.some((workout) => workout.duration_minutes == null) ? ' (일부 기록 합계)' : ''}`}</div>
                <div>차이: {dailyBalance == null ? '계산 전' : `${format(dailyBalance)} kcal${provisional(selectedDay) ? ' · 잠정' : ''}`}</div>
            </div>}
            <div className="grid gap-2 text-sm sm:grid-cols-2"><div>선택한 주: {weekBalance.count ? `${format(weekBalance.value)} kcal · ${weekBalance.count}일 포함${weekBalance.provisionalCount ? ` · 잠정 ${weekBalance.provisionalCount}일` : ''}` : '계산 가능한 날 없음'}</div><div>선택한 달: {monthBalance.count ? `${format(monthBalance.value)} kcal · ${monthBalance.count}일 포함${monthBalance.provisionalCount ? ` · 잠정 ${monthBalance.provisionalCount}일` : ''}` : '계산 가능한 날 없음'}</div></div>
            {monthQuery.isSuccess && <div><h3 className="mb-2 text-sm font-semibold">{date.slice(0, 7)} 날짜별 기록</h3><div className="grid grid-cols-7 gap-1 text-center text-xs">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <div key={day}>{day}</div>)}{Array.from({ length: monthOffset }, (_, index) => <div key={`blank-${index}`} />)}{monthDays.map((day) => <button key={day.summary_date} type="button" onClick={() => onDateChange(day.summary_date)} className={`min-w-0 rounded-lg border border-border-subtle p-1 ${day.summary_date === date ? 'font-bold' : ''}`} title={`${day.summary_date} · ${balance(day) == null ? '미계산' : `${format(balance(day))} kcal${provisional(day) ? ' · 잠정' : ''}`}`} aria-label={`${day.summary_date} 선택`} aria-pressed={day.summary_date === date}><div>{Number(day.summary_date.slice(-2))}</div><div className="truncate">{balance(day) == null ? '—' : format(balance(day))}</div>{balance(day) != null && provisional(day) && <div>잠정</div>}</button>)}</div><p className="page-text-muted mt-2 text-xs">차이 = 총 소모 − 기록된 섭취. 양수는 적자, 음수는 잉여입니다. 미기록일은 합계에서 제외합니다.</p></div>}
        </section>}
        {measurementForm && <form onSubmit={submitMeasurement} className="page-list-item mt-4 space-y-3">
            <h2 className="font-semibold">신체 측정 {measurementForm.id ? '수정' : '추가'}</h2>
            {error && <p role="alert" className="ui-danger-text text-sm">{error}</p>}
            <label className="block text-sm">측정 시각<input required autoFocus type="time" value={measurementForm.measured_at.slice(0, 5)} onChange={(event) => setMeasurementForm({ ...measurementForm, measured_at: event.target.value })} className={`${inputClass} mt-1`} /></label>
            <div className="grid grid-cols-2 gap-2">{fields.map(([key, label]) => <label key={key} className="min-w-0 text-sm">{label} (kg)<input type="number" min={key === 'weight_kg' ? '0.001' : '0'} max="999999.999" step="0.001" value={measurementForm[key]} onChange={(event) => setMeasurementForm({ ...measurementForm, [key]: event.target.value })} className={`${inputClass} mt-1`} /></label>)}</div>
            <div className="flex justify-end gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => setMeasurementForm(null)}>취소</button><button type="submit" className={buttonClass} disabled={busy}>저장</button></div>
        </form>}
        {workoutForm && <form onSubmit={submitWorkout} className="page-list-item mt-4 space-y-3">
            <h2 className="font-semibold">운동 {workoutForm.id ? '수정' : '추가'}</h2>
            {error && <p role="alert" className="ui-danger-text text-sm">{error}</p>}
            <label className="block text-sm">운동명<input required autoFocus maxLength={120} value={workoutForm.name} onChange={(event) => setWorkoutForm({ ...workoutForm, name: event.target.value })} className={`${inputClass} mt-1`} /></label>
            <div className="grid gap-2 sm:grid-cols-3"><label className="min-w-0 text-sm">시작 시각<input type="time" value={workoutForm.started_at} onChange={(event) => setWorkoutForm({ ...workoutForm, started_at: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="min-w-0 text-sm">운동 시간 (분)<input type="number" min="0" max="1440" step="1" value={workoutForm.duration_minutes} onChange={(event) => setWorkoutForm({ ...workoutForm, duration_minutes: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="min-w-0 text-sm">운동 열량 (kcal)<input type="number" min="0" max="999999999.999" step="0.001" value={workoutForm.kcal} onChange={(event) => setWorkoutForm({ ...workoutForm, kcal: event.target.value })} className={`${inputClass} mt-1`} /></label></div>
            <label className="block text-sm">메모<textarea maxLength={5000} rows={2} value={workoutForm.note} onChange={(event) => setWorkoutForm({ ...workoutForm, note: event.target.value })} className={`${inputClass} mt-1`} /></label>
            <div className="flex justify-end gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => setWorkoutForm(null)}>취소</button><button type="submit" className={buttonClass} disabled={busy}>저장</button></div>
        </form>}
    </>;
}
