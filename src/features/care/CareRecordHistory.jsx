import { CareButton } from './CareControls';
import CareDetailDialog from './CareDetailDialog';
import CareRoutineSection from './CareRoutineSection';
import { useQuery } from '@tanstack/react-query';
import { fetchCareMealsRange, fetchCareMeasurementsRange, fetchCareRoutineRange, fetchCareWorkoutsRange } from '../../lib/careApi';

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const format = (value) => Math.round(Number(value) * 10) / 10;
const measurementFields = [
    ['weight_kg', '체중'], ['body_fat_kg', '체지방량'],
    ['muscle_kg', '골격근량'], ['body_water_kg', '체수분량'],
];
export default function CareRecordHistory({ userId, month, periodQuery, selectedDate, onSelectDate, onDateChange, onAddRecord, onEditMeal, onDeleteMeal, onEditMeasurement, onDeleteMeasurement, onBusyChange }) {
    const [year, number] = month.split('-').map(Number);
    const start = `${month}-01`;
    const end = `${month}-${String(new Date(year, number, 0).getDate()).padStart(2, '0')}`;
    const blanks = new Date(year, number - 1, 1).getDay();
    const days = Array.from({ length: Number(end.slice(-2)) }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
    const trailing = (7 - (blanks + days.length) % 7) % 7;
    const historyQuery = useQuery({
        queryKey: ['care-history', userId, start, end],
        queryFn: async () => {
            const [meals, measurements, workouts] = await Promise.all([
                fetchCareMealsRange(userId, start, end),
                fetchCareMeasurementsRange(userId, start, end),
                fetchCareWorkoutsRange(userId, start, end),
            ]);
            return { meals, measurements, workouts };
        },
        enabled: !!userId,
    });
    const routineQuery = useQuery({
        queryKey: ['care-routine-range', userId, start, localDate(new Date(year, number, 1))],
        queryFn: () => fetchCareRoutineRange(start, localDate(new Date(year, number, 1))),
        enabled: !!userId,
    });
    const previousDate = selectedDate ? new Date(`${selectedDate}T12:00:00`) : null;
    previousDate?.setDate(previousDate.getDate() - 1);
    const comparisonDate = previousDate ? localDate(previousDate) : null;
    const comparisonQuery = useQuery({
        queryKey: ['care-measurements-range', userId, comparisonDate, selectedDate],
        queryFn: () => fetchCareMeasurementsRange(userId, comparisonDate, selectedDate),
        enabled: !!userId && !!selectedDate,
    });
    const history = historyQuery.data || { meals: [], measurements: [], workouts: [] };
    const routineRows = (routineQuery.data || []).filter((row) => !row.hidden);
    const periodByDate = new Map((periodQuery.data || []).map((row) => [row.summary_date, row]));
    const selectedMeals = history.meals.filter((meal) => meal.meal_date === selectedDate).sort((a, b) => ['아침', '점심', '저녁', '간식'].indexOf(a.meal_type) - ['아침', '점심', '저녁', '간식'].indexOf(b.meal_type) || (a.eaten_at || '').localeCompare(b.eaten_at || '') || String(a.id).localeCompare(String(b.id)));
    const mealLabel = (meal) => {
        const sameType = selectedMeals.filter((item) => item.meal_type === meal.meal_type);
        return sameType.length > 1 ? `${meal.meal_type} ${sameType.findIndex((item) => item.id === meal.id) + 1}` : meal.meal_type;
    };
    const selectedMeasurements = history.measurements.filter((measurement) => measurement.measurement_date === selectedDate);
    const previousMeasurements = (comparisonQuery.data || []).filter((measurement) => measurement.measurement_date === comparisonDate).sort((a, b) => b.measured_at.localeCompare(a.measured_at) || Number(b.id) - Number(a.id));
    const selectedWorkouts = history.workouts.filter((workout) => workout.workout_date === selectedDate);
    const selectedItems = selectedMeals.flatMap((meal) => meal.care_meal_items || []);
    const selectedProtein = selectedItems.filter((item) => item.protein_g != null);
    const selectedKcal = selectedItems.reduce((sum, item) => sum + Number(item.kcal), 0);

    return <section className="care-history space-y-4">
        {historyQuery.isPending && <div className="page-card p-5 text-sm">기록을 불러오는 중...</div>}
        {historyQuery.isSuccess && routineQuery.isPending && <p className="page-text-muted text-xs">루틴 요약을 불러오는 중...</p>}
        {historyQuery.isError && <div role="alert" className="page-card ui-danger-text p-5 text-sm">기록을 불러오지 못했습니다: {historyQuery.error.message}</div>}
        {historyQuery.isSuccess && routineQuery.isError && <p role="alert" className="ui-danger-text text-xs">루틴 요약을 불러오지 못했습니다: {routineQuery.error.message}</p>}
        {periodQuery.isError && <p role="alert" className="ui-danger-text text-xs">열량을 불러오지 못했습니다: {periodQuery.error.message}</p>}
        {historyQuery.isSuccess && <div className="care-history-calendar-wrap"><div className="care-history-weekdays grid grid-cols-7 text-[11.5px]">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => <div key={day} className="px-2 py-1 text-center font-medium">{day}</div>)}
        </div><div className="care-history-calendar grid min-w-0 grid-cols-7 border-l border-t border-border-subtle text-[11px]">
            {Array.from({ length: blanks }, (_, index) => <div key={`blank-${index}`} className="care-history-blank" />)}
            {days.map((day) => {
                const routines = routineRows.filter((row) => row.routine_date === day);
                const summary = periodByDate.get(day);
                const hasIntake = summary && Number(summary.meal_count) > 0;
                const hasBalance = summary?.total_kcal != null && (hasIntake || summary.intake_confirmed);
                return <div key={day} className="care-history-day diary-calendar-cell flex min-w-0 flex-col border-b border-r border-border-subtle px-0.5 py-0.5 sm:px-2 sm:py-1.5" data-selected={selectedDate === day}>
                    <CareButton type="button" className="care-history-date flex min-w-0 text-left" aria-pressed={selectedDate === day} aria-label={`${day} 기록 보기`} onClick={() => onSelectDate(day)}>
                        <span className="care-history-day-head"><span className={'care-history-mark ' + (hasBalance && Number(summary.total_kcal) - Number(summary.intake_kcal) < 0 ? 'care-history-over' : '')}>{hasBalance && <>{Number(summary.total_kcal) - Number(summary.intake_kcal) < 0 ? '초과' : '부족'} {format(Math.abs(Number(summary.total_kcal) - Number(summary.intake_kcal)))} kcal</>}</span><span className={'care-history-number diary-today-marker inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none sm:h-5 sm:w-5 sm:text-[12px] ' + (day === localDate(new Date()) ? 'bg-red-500 text-white' : '')}>{Number(day.slice(-2))}</span></span>
                    </CareButton>
                    {routines.length > 0 && <div className="care-history-routines diary-monthly-cell-scroll">{routines.map((row) => <CareButton key={row.routine_id ? `routine-${row.routine_id}` : `once-${row.day_id}`} type="button" className="care-history-routine diary-editor-check-row" title={row.name} aria-label={`${day} ${row.name} 기록 보기`} onClick={() => onSelectDate(day)}><span className={'care-history-check diary-editor-check-box flex h-3 w-3 shrink-0 items-center justify-center rounded border border-border-subtle bg-[var(--color-page-surface)] text-white ' + (row.status === 'done' ? 'care-history-checked' : '')}><svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11 12.5 5" /></svg></span><span className={row.status === 'skipped' ? 'line-through' : ''}>{row.name}</span></CareButton>)}</div>}
                </div>;
            })}
            {Array.from({ length: trailing }, (_, index) => <div key={`end-${index}`} className="care-history-blank" />)}
        </div></div>}
        {selectedDate?.startsWith(month) && historyQuery.isSuccess && <CareDetailDialog title={`${selectedDate} 기록`} className="care-history-dialog" headerAction={<CareButton type="button" className="ui-control care-history-open" onClick={() => onDateChange(selectedDate)}>하루 기록 열기 →</CareButton>} onClose={() => onSelectDate(null)}>
            <div className="care-history-detail min-w-0 space-y-4">
                <section className="min-w-0 space-y-2"><div className="care-history-section-head"><h4>식사 <span className="page-text-muted font-normal">{selectedMeals.length ? `${format(selectedKcal)} kcal${selectedProtein.length ? ` · 단백질 ${format(selectedProtein.reduce((sum, item) => sum + Number(item.protein_g), 0))} g` : ''}` : ''}</span></h4><CareButton type="button" className="ui-control care-history-add" onClick={() => onAddRecord('meal', selectedDate)}>+ 식사 기록</CareButton></div>{selectedMeals.length ? selectedMeals.map((meal) => <div key={meal.id} className="care-meal-card min-w-0"><div className="care-meal-card-head"><div className="care-meal-card-heading"><h3 className="care-meal-card-title">{mealLabel(meal)}</h3><span className="page-text-muted text-xs">{meal.eaten_at?.slice(0, 5)}</span><strong className="care-meal-card-kcal">{format((meal.care_meal_items || []).reduce((sum, item) => sum + Number(item.kcal), 0))} kcal</strong></div><div className="care-meal-card-actions"><CareButton type="button" onClick={() => onEditMeal(meal)}>수정</CareButton><CareButton type="button" className="ui-danger-text" onClick={() => onDeleteMeal(meal, mealLabel(meal))}>삭제</CareButton></div></div><div className="care-meal-card-foods">{[...(meal.care_meal_items || [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => <div key={item.id} className="care-meal-card-item"><span className="min-w-0 break-words">{item.food_name}</span><span className="page-text-muted">{item.amount}{item.unit}{item.protein_g == null ? '' : ` · 단백질 ${item.protein_g} g`}</span><span>{item.kcal} kcal</span></div>)}</div>{meal.note && <p className="care-meal-card-note page-text-muted whitespace-pre-wrap break-words">{meal.note}</p>}</div>) : <p className="page-text-muted text-xs">기록 없음</p>}</section>
                <section className="min-w-0 space-y-2"><div className="care-history-section-head"><h4>신체 측정{selectedMeasurements.length === 1 && <span className="care-history-heading-time">{selectedMeasurements[0].measurement_date} {selectedMeasurements[0].measured_at?.slice(0, 5)}</span>}</h4><CareButton type="button" className="ui-control care-history-add" onClick={() => onAddRecord('body', selectedDate)}>+ 측정 기록</CareButton></div>{selectedMeasurements.length ? selectedMeasurements.map((measurement) => <div key={measurement.id} className="care-record-row care-body-record">{selectedMeasurements.length > 1 && <div className="care-body-record-head"><strong>{measurement.measurement_date} {measurement.measured_at?.slice(0, 5)}</strong></div>}<div className="care-body-record-grid"><div className="care-body-record-actions care-text-actions"><CareButton type="button" onClick={() => onEditMeasurement(measurement)}>수정</CareButton><CareButton type="button" className="ui-danger-text" onClick={() => onDeleteMeasurement(measurement)}>삭제</CareButton></div>{measurementFields.map(([key, label]) => {
                    const previous = previousMeasurements.find((row) => row[key] != null);
                    const difference = measurement[key] != null && previous ? Number(measurement[key]) - Number(previous[key]) : null;
                    const favorable = key === 'weight_kg' || key === 'body_fat_kg' ? difference < 0 : difference > 0;
                    return <div key={key} className="care-body-metric"><span>{label}</span><strong>{measurement[key] == null ? '—' : format(measurement[key])}{measurement[key] != null && <small> kg</small>}</strong>{difference != null && <span className={difference === 0 ? 'page-text-muted' : favorable ? 'care-body-good' : 'care-body-bad'}>{difference === 0 ? '변화 없음' : `${difference > 0 ? '▲' : '▼'} ${Number(Math.abs(difference).toFixed(3))} kg`}</span>}</div>;
                })}</div></div>) : <p className="page-text-muted text-xs">기록 없음</p>}</section>
                <section className="min-w-0 space-y-2"><div className="care-history-section-head"><h4>운동</h4><CareButton type="button" className="ui-control care-history-add" onClick={() => onAddRecord('workout', selectedDate)}>+ 운동 기록</CareButton></div>{selectedWorkouts.length ? selectedWorkouts.map((workout) => <div key={workout.id} className="care-record-row"><div className="care-record-info"><strong>{workout.name}</strong><span>{[workout.started_at?.slice(0, 5), workout.duration_minutes == null ? null : `${workout.duration_minutes}분`, workout.kcal == null ? null : `${workout.kcal} kcal`].filter(Boolean).join(' · ')}</span>{workout.note && <span className="whitespace-pre-wrap">{workout.note}</span>}</div></div>) : <p className="care-history-empty page-text-muted text-xs">기록 없음</p>}</section>
                <section className="min-w-0 space-y-2"><div className="care-history-section-head"><h4>루틴</h4><CareButton type="button" className="ui-control care-history-add" onClick={() => onAddRecord('routine', selectedDate)}>+ 루틴 등록</CareButton></div><CareRoutineSection key={selectedDate} userId={userId} date={selectedDate} onBusyChange={onBusyChange} dayOnly /></section>
            </div>
        </CareDetailDialog>}
    </section>;
}
