import { CareButton } from './CareControls';
import { CareInput, CareTextarea } from './CareControls';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteCareMeasurement, deleteCareWorkout, fetchCareDailyEnergy, fetchCareMeasurementsRange,
    fetchCarePeriodSummary, fetchCareWorkouts, saveCareDailyEnergy, saveCareMeasurement, saveCareWorkout,
} from '../../lib/careApi';
import CareActionDialog from './CareActionDialog';

const inputClass = 'ui-input w-full min-w-0 rounded-lg border px-3 py-2 text-sm';
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

export default function CareDailyRecords({ userId, date, onBusyChange, section, addMeasurementRequest, startWithNew = false, startWithEdit = null }) {
    const queryClient = useQueryClient();
    const [measurementForm, setMeasurementForm] = useState(() => startWithEdit ? Object.fromEntries(Object.entries(startWithEdit).map(([key, value]) => [key, value == null ? '' : String(value)])) : startWithNew && section === 'body' ? { measurement_date: date, measured_at: new Date().toTimeString().slice(0, 5), weight_kg: '', body_fat_kg: '', muscle_kg: '', body_water_kg: '' } : null);
    const [workoutForm, setWorkoutForm] = useState(() => startWithNew && section === 'workout' ? { workout_date: date, name: '', started_at: '', duration_minutes: '', kcal: '', note: '' } : null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [actionDialog, setActionDialog] = useState(null);
    const previousAddRequest = useRef(addMeasurementRequest);
    useEffect(() => () => onBusyChange(false), [onBusyChange]);
    useEffect(() => {
        if (section !== 'body' || previousAddRequest.current === addMeasurementRequest) return;
        previousAddRequest.current = addMeasurementRequest;
        setError('');
        setMeasurementForm({ measurement_date: date, measured_at: new Date().toTimeString().slice(0, 5), weight_kg: '', body_fat_kg: '', muscle_kg: '', body_water_kg: '' });
    }, [addMeasurementRequest, date, section]);
    const current = new Date(`${date}T12:00:00`);
    const bodyStartDate = new Date(current);
    bodyStartDate.setDate(current.getDate() - 7);
    const bodyStart = localDate(bodyStartDate);
    const comparisonStartDate = new Date(bodyStartDate);
    comparisonStartDate.setDate(bodyStartDate.getDate() - 1);
    const measurementsQuery = useQuery({ queryKey: ['care-measurements-range', userId, localDate(comparisonStartDate), date], queryFn: () => fetchCareMeasurementsRange(userId, localDate(comparisonStartDate), date), enabled: !!userId && section === 'body' });
    const workoutsQuery = useQuery({ queryKey: ['care-workouts', userId, date], queryFn: () => fetchCareWorkouts(userId, date), enabled: !!userId && (section === 'workout' || section === 'energy') });
    const energyQuery = useQuery({ queryKey: ['care-energy', userId, date], queryFn: () => fetchCareDailyEnergy(userId, date), enabled: !!userId && section === 'energy' });
    const dayQuery = useQuery({ queryKey: ['care-period', userId, date, date], queryFn: () => fetchCarePeriodSummary(date, date), enabled: !!userId && section === 'energy' });
    const measurements = (measurementsQuery.data || []).filter((row) => row.measurement_date >= bodyStart)
        .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date) || b.measured_at.localeCompare(a.measured_at) || Number(b.id) - Number(a.id));
    const workouts = workoutsQuery.data || [];
    const selectedDay = dayQuery.data?.[0];
    const dailyBalance = balance(selectedDay);

    const run = async (action, refresh, close) => {
        setBusy(true);
        onBusyChange(true);
        setError('');
        try {
            await action();
            await Promise.all(refresh.map((key) => queryClient.invalidateQueries({ queryKey: key })));
            close?.();
        } catch (e) {
            setError(e.message || '저장에 실패했습니다.');
        } finally {
            setBusy(false);
            onBusyChange(false);
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
        run(() => saveCareMeasurement(userId, measurementForm), [['care-measurements-range', userId], ['care-measurement-latest', userId], ['care-measurement-chart', userId], ['care-history', userId]], () => setMeasurementForm(null));
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
        run(() => saveCareDailyEnergy(userId, date, { ...values, intake_confirmed: true }),
            [['care-energy', userId, date], refreshPeriod]);
    };

    return <>
        {error && <div role="alert" className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">{error}</div>}
        {(section === 'body' || section === 'workout') && <div className="min-w-0 space-y-4">
            {section === 'body' &&
            <section className="min-w-0 space-y-3">
                {measurementsQuery.isPending && <p className="page-text-muted text-sm">측정을 불러오는 중...</p>}
                {measurementsQuery.isError && <p role="alert" className="ui-danger-text text-sm">측정을 불러오지 못했습니다: {measurementsQuery.error.message}</p>}
                {measurementsQuery.isSuccess && !measurements.length && <p className="page-text-muted text-sm">이 기간에 기록된 측정이 없습니다.</p>}
                {measurements.map((measurement) => <div key={measurement.id} className="care-record-row care-body-record">
                    <div className="care-body-record-head"><div><strong>{measurement.measurement_date} {measurement.measured_at.slice(0, 5)}</strong></div>
                        <div className="care-text-actions"><CareButton type="button" disabled={busy} onClick={() => { setError(''); setMeasurementForm(Object.fromEntries(Object.entries(measurement).map(([key, value]) => [key, value == null ? '' : String(value)]))); }}>수정</CareButton><CareButton type="button" className="ui-danger-text" disabled={busy} onClick={() => setActionDialog({ message: '이 측정을 삭제할까요?', onConfirm: () => run(() => deleteCareMeasurement(userId, measurement.id), [['care-measurements-range', userId], ['care-measurement-latest', userId], ['care-measurement-chart', userId], ['care-history', userId]]) })}>삭제</CareButton></div>
                    </div>
                    <div className="care-body-record-grid">{fields.map(([key, label]) => {
                        const previousDate = new Date(`${measurement.measurement_date}T12:00:00`);
                        previousDate.setDate(previousDate.getDate() - 1);
                        const previous = (measurementsQuery.data || []).filter((row) => row.measurement_date === localDate(previousDate) && row[key] != null).sort((a, b) => b.measured_at.localeCompare(a.measured_at) || Number(b.id) - Number(a.id))[0];
                        const difference = measurement[key] != null && previous ? Number(measurement[key]) - Number(previous[key]) : null;
                        const favorable = key === 'weight_kg' || key === 'body_fat_kg' ? difference < 0 : difference > 0;
                        return <div key={key} className="care-body-metric"><span>{label}</span><strong>{measurement[key] == null ? '—' : format(measurement[key])}{measurement[key] != null && <small> kg</small>}</strong>{difference != null && <span className={difference === 0 ? 'page-text-muted' : favorable ? 'care-body-good' : 'care-body-bad'}>{difference === 0 ? '변화 없음' : `${difference > 0 ? '▲' : '▼'} ${Number(Math.abs(difference).toFixed(3))} kg`}</span>}</div>;
                    })}</div>
                </div>)}
            </section>}
            {section === 'workout' &&
            <section className="min-w-0 space-y-3">
                <div className="care-section-head"><h2>운동 기록 <span>{workouts.length}건</span></h2><CareButton type="button" className="ui-btn-success" disabled={busy} onClick={() => { setError(''); setWorkoutForm({ workout_date: date, name: '', started_at: '', duration_minutes: '', kcal: '', note: '' }); }}>+ 운동 기록</CareButton></div>
                {workoutsQuery.isPending && <p className="page-text-muted text-sm">운동을 불러오는 중...</p>}
                {workoutsQuery.isError && <p role="alert" className="ui-danger-text text-sm">운동을 불러오지 못했습니다: {workoutsQuery.error.message}</p>}
                {!workoutsQuery.isPending && !workouts.length && <p className="page-text-muted text-sm">기록된 운동이 없습니다.</p>}
                {workouts.map((workout) => <div key={workout.id} className="care-record-row">
                    <div className="care-record-info"><strong>{workout.name}</strong><span>{[workout.started_at?.slice(0, 5), workout.duration_minutes == null ? null : `${workout.duration_minutes}분`, workout.kcal == null ? null : `${workout.kcal} kcal`].filter(Boolean).join(' · ')}</span>{workout.note && <span className="whitespace-pre-wrap">{workout.note}</span>}</div>
                    <div className="care-text-actions"><CareButton type="button" disabled={busy} onClick={() => { setError(''); setWorkoutForm({ ...workout, started_at: workout.started_at?.slice(0, 5) || '', duration_minutes: workout.duration_minutes == null ? '' : String(workout.duration_minutes), kcal: workout.kcal == null ? '' : String(workout.kcal) }); }}>수정</CareButton><CareButton type="button" className="ui-danger-text" disabled={busy} onClick={() => setActionDialog({ message: '이 운동을 삭제할까요?', onConfirm: () => run(() => deleteCareWorkout(userId, workout.id), [['care-workouts', userId, date], refreshPeriod, ['care-history', userId]]) })}>삭제</CareButton></div>
                </div>)}
            </section>}
        </div>}
        {section === 'energy' &&
        <section className="care-energy min-w-0 space-y-4">
            {energyQuery.isPending && <p className="page-text-muted text-xs">활동량을 불러오는 중...</p>}
            {dayQuery.isPending && <p className="page-text-muted text-xs">하루 집계를 불러오는 중...</p>}
            {energyQuery.isError && <p role="alert" className="ui-danger-text text-sm">활동량을 불러오지 못했습니다: {energyQuery.error.message}</p>}
            {dayQuery.isError && <p role="alert" className="ui-danger-text text-sm">하루 집계를 불러오지 못했습니다: {dayQuery.error.message}</p>}
            {energyQuery.isSuccess && <form key={`${date}-${energyQuery.data?.updated_at || ''}`} onSubmit={submitEnergy} className="care-edit-form space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                    <label className="min-w-0 text-sm">활동 소모 (kcal)<CareInput name="active_kcal" type="number" min="0" max="999999999.999" step="0.001" defaultValue={energyQuery.data?.active_kcal ?? ''} className={`${inputClass} mt-1`} /></label>
                    <label className="min-w-0 text-sm">총 소모 (kcal)<CareInput name="total_kcal" type="number" min="0" max="999999999.999" step="0.001" defaultValue={energyQuery.data?.total_kcal ?? ''} className={`${inputClass} mt-1`} /></label>
                </div>
                <CareButton type="submit" className={buttonClass} disabled={busy}>{busy ? '저장 중...' : '활동량 저장'}</CareButton>
            </form>}
            {selectedDay && <div className="care-energy-stats">
                <div><strong>섭취</strong><span>{Number(selectedDay.meal_count) > 0 || selectedDay.intake_confirmed ? `${format(selectedDay.intake_kcal)} kcal` : '미기록'}</span></div>
                <div><strong>운동</strong><span>{workoutsQuery.isPending ? '운동 기록을 불러오는 중...' : workoutsQuery.isError ? <span role="alert" className="ui-danger-text">운동 기록을 불러오지 못했습니다.</span> : <>{selectedDay.workout_kcal == null ? '열량 미기록' : `${format(selectedDay.workout_kcal)} kcal${workouts.some((workout) => workout.kcal == null) ? ' (일부 기록 합계)' : ''}`} · {selectedDay.workout_minutes == null ? '시간 미기록' : `${selectedDay.workout_minutes}분${workouts.some((workout) => workout.duration_minutes == null) ? ' (일부 기록 합계)' : ''}`}</>}</span></div>
                <div><strong>차이</strong><span>{dailyBalance == null ? '계산 전' : `${format(dailyBalance)} kcal${provisional(selectedDay) ? ' · 잠정' : ''}`}</span></div>
            </div>}
        </section>}
        {measurementForm && <form onSubmit={submitMeasurement} className="care-edit-form mt-4 space-y-3">
            <div className="care-measurement-form-head"><h2 className="font-semibold">신체 측정 {measurementForm.id ? '수정' : '추가'}</h2>{measurementForm.id && <span>{measurementForm.measurement_date}</span>}</div>
            {error && <p role="alert" className="ui-danger-text text-sm">{error}</p>}
            <label className="block text-sm">측정 시각<CareInput required autoFocus type="time" value={measurementForm.measured_at.slice(0, 5)} onChange={(event) => setMeasurementForm({ ...measurementForm, measured_at: event.target.value })} className={`${inputClass} mt-1`} /></label>
            <div className="grid grid-cols-2 gap-2">{fields.map(([key, label]) => <label key={key} className="min-w-0 text-sm">{label} (kg)<CareInput type="number" min={key === 'weight_kg' ? '0.001' : '0'} max="999999.999" step="0.001" value={measurementForm[key]} onChange={(event) => setMeasurementForm({ ...measurementForm, [key]: event.target.value })} className={`${inputClass} mt-1`} /></label>)}</div>
            <div className="flex justify-end gap-2"><CareButton type="button" className={buttonClass} disabled={busy} onClick={() => setMeasurementForm(null)}>취소</CareButton><CareButton type="submit" className={buttonClass} disabled={busy}>저장</CareButton></div>
        </form>}
        {workoutForm && <form onSubmit={submitWorkout} className="care-edit-form mt-4 space-y-3">
            <h2 className="font-semibold">운동 {workoutForm.id ? '수정' : '추가'}</h2>
            {error && <p role="alert" className="ui-danger-text text-sm">{error}</p>}
            <label className="block text-sm">운동명<CareInput required autoFocus maxLength={120} value={workoutForm.name} onChange={(event) => setWorkoutForm({ ...workoutForm, name: event.target.value })} className={`${inputClass} mt-1`} /></label>
            <div className="grid gap-2 sm:grid-cols-3"><label className="min-w-0 text-sm">시작 시각<CareInput type="time" value={workoutForm.started_at} onChange={(event) => setWorkoutForm({ ...workoutForm, started_at: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="min-w-0 text-sm">운동 시간 (분)<CareInput type="number" min="0" max="1440" step="1" value={workoutForm.duration_minutes} onChange={(event) => setWorkoutForm({ ...workoutForm, duration_minutes: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="min-w-0 text-sm">운동 열량 (kcal)<CareInput type="number" min="0" max="999999999.999" step="0.001" value={workoutForm.kcal} onChange={(event) => setWorkoutForm({ ...workoutForm, kcal: event.target.value })} className={`${inputClass} mt-1`} /></label></div>
            <label className="block text-sm">메모<CareTextarea maxLength={5000} rows={2} value={workoutForm.note} onChange={(event) => setWorkoutForm({ ...workoutForm, note: event.target.value })} className={`${inputClass} mt-1`} /></label>
            <div className="flex justify-end gap-2"><CareButton type="button" className={buttonClass} disabled={busy} onClick={() => setWorkoutForm(null)}>취소</CareButton><CareButton type="submit" className={buttonClass} disabled={busy}>저장</CareButton></div>
        </form>}
        {actionDialog && <CareActionDialog message={actionDialog.message} onClose={() => { if (!busy) setActionDialog(null); }} onConfirm={() => { setActionDialog(null); actionDialog.onConfirm(); }} />}
    </>;
}
