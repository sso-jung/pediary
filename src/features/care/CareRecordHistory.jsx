import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCareMealsRange, fetchCareMeasurementsRange, fetchCareWorkoutsRange } from '../../lib/careApi';

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const format = (value) => Math.round(Number(value) * 10) / 10;
const measurementFields = [
    ['weight_kg', '체중'], ['body_fat_kg', '체지방량'],
    ['muscle_kg', '골격근량'], ['body_water_kg', '체수분량'],
];

export default function CareRecordHistory({ userId, onDateChange }) {
    const [expandedDate, setExpandedDate] = useState(null);
    const [periodOffset, setPeriodOffset] = useState(0);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - periodOffset * 30);
    const end = localDate(endDate);
    const startDate = new Date(`${end}T12:00:00`);
    startDate.setDate(startDate.getDate() - 29);
    const start = localDate(startDate);
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
    const history = historyQuery.data || { meals: [], measurements: [], workouts: [] };
    const dates = [...new Set([
        ...history.meals.map((meal) => meal.meal_date),
        ...history.measurements.map((measurement) => measurement.measurement_date),
        ...history.workouts.map((workout) => workout.workout_date),
    ])].sort().reverse();

    return <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-lg font-semibold">기록 모아보기</h2><p className="page-text-muted mt-1 text-sm">{start} ~ {end} · 식사, 신체 측정, 운동</p></div>
            <div className="flex flex-wrap items-center gap-2"><button type="button" className="ui-control rounded-lg border px-3 py-2 text-xs" onClick={() => { setPeriodOffset(periodOffset + 1); setExpandedDate(null); }}>이전 30일</button><button type="button" className="ui-control rounded-lg border px-3 py-2 text-xs" disabled={periodOffset === 0} onClick={() => { setPeriodOffset(periodOffset - 1); setExpandedDate(null); }}>다음 30일</button>{historyQuery.isSuccess && <span className="page-text-muted text-xs">기록된 날짜 {dates.length}일</span>}</div>
        </div>
        {historyQuery.isPending && <div className="page-card p-5 text-sm">최근 기록을 불러오는 중...</div>}
        {historyQuery.isError && <div role="alert" className="page-card ui-danger-text p-5 text-sm">기록을 불러오지 못했습니다: {historyQuery.error.message}</div>}
        {historyQuery.isSuccess && !dates.length && <div className="page-card page-text-muted p-6 text-center text-sm">최근 30일의 식사·신체·운동 기록이 없습니다.</div>}
        {dates.map((date) => {
            const meals = history.meals.filter((meal) => meal.meal_date === date);
            const measurements = history.measurements.filter((measurement) => measurement.measurement_date === date);
            const workouts = history.workouts.filter((workout) => workout.workout_date === date);
            const items = meals.flatMap((meal) => meal.care_meal_items || []);
            const proteinItems = items.filter((item) => item.protein_g != null);
            const proteinMissing = items.length - proteinItems.length;
            const totalKcal = items.reduce((sum, item) => sum + Number(item.kcal), 0);
            const totalProtein = proteinItems.reduce((sum, item) => sum + Number(item.protein_g), 0);
            const open = expandedDate === date;
            return <article key={date} className="page-card min-w-0 overflow-hidden p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => onDateChange(date)} className="text-left text-base font-semibold text-[var(--color-accent)] hover:underline" title={`${date} 하루 기록 열기`}>{date}</button>
                    <button type="button" className="ui-control rounded-lg border px-3 py-1.5 text-xs" aria-expanded={open} onClick={() => setExpandedDate(open ? null : date)}>{open ? '접기' : '상세 보기'}</button>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <div className="page-list-item"><span className="page-text-muted text-xs">식사 {meals.length}건</span><div className="mt-1 font-medium">{meals.length ? `${format(totalKcal)} kcal` : '기록 없음'}</div>{meals.length > 0 && <div className="page-text-muted mt-1 text-xs">단백질 {proteinItems.length ? `${format(totalProtein)} g` : '미기록'}{proteinMissing > 0 ? ` · 미입력 ${proteinMissing}개` : ''}</div>}</div>
                    <div className="page-list-item"><span className="page-text-muted text-xs">신체 측정</span><div className="mt-1 font-medium">{measurements.length}건</div></div>
                    <div className="page-list-item"><span className="page-text-muted text-xs">운동</span><div className="mt-1 font-medium">{workouts.length}건</div></div>
                </div>
                {open && <div className="mt-4 grid min-w-0 gap-4 border-t border-border-subtle pt-4 lg:grid-cols-3">
                    <div className="min-w-0 space-y-2"><h3 className="text-sm font-semibold">식사</h3>{meals.length ? meals.map((meal) => <div key={meal.id} className="page-list-item text-sm"><div className="font-medium">{meal.meal_type} {meal.eaten_at?.slice(0, 5)}</div>{(meal.care_meal_items || []).map((item) => <p key={item.id} className="page-text-muted mt-1 break-words text-xs">{item.food_name} {item.amount}{item.unit} · {item.kcal} kcal · 단백질 {item.protein_g == null ? '미기록' : `${item.protein_g} g`}</p>)}{meal.note && <p className="page-text-muted mt-2 whitespace-pre-wrap break-words text-xs">{meal.note}</p>}</div>) : <p className="page-text-muted text-xs">기록 없음</p>}</div>
                    <div className="min-w-0 space-y-2"><h3 className="text-sm font-semibold">신체 측정</h3>{measurements.length ? measurements.map((measurement) => <div key={measurement.id} className="page-list-item text-sm"><div className="font-medium">{measurement.measured_at?.slice(0, 5)}</div><p className="page-text-muted mt-1 break-words text-xs">{measurementFields.filter(([key]) => measurement[key] != null).map(([key, label]) => `${label} ${measurement[key]} kg`).join(' · ')}</p></div>) : <p className="page-text-muted text-xs">기록 없음</p>}</div>
                    <div className="min-w-0 space-y-2"><h3 className="text-sm font-semibold">운동</h3>{workouts.length ? workouts.map((workout) => <div key={workout.id} className="page-list-item text-sm"><div className="font-medium">{workout.name}</div><p className="page-text-muted mt-1 text-xs">{workout.started_at?.slice(0, 5) || '시각 미기록'} · {workout.duration_minutes == null ? '시간 미기록' : `${workout.duration_minutes}분`} · {workout.kcal == null ? '열량 미기록' : `${workout.kcal} kcal`}</p>{workout.note && <p className="page-text-muted mt-2 whitespace-pre-wrap break-words text-xs">{workout.note}</p>}</div>) : <p className="page-text-muted text-xs">기록 없음</p>}</div>
                </div>}
            </article>;
        })}
    </section>;
}
