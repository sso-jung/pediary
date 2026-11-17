import { CareButton } from './CareControls';
import { CareInput, CareSelect, CareTextarea } from './CareControls';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
    archiveCareFood, deleteCareMeal, deleteCareMeasurement, fetchCareDailyEnergy, fetchCareFoods, fetchCareMeals,
    fetchLatestCareMeasurement, fetchCareMeasurementsRange, fetchCarePeriodSummary, fetchCareRoutineDay, fetchCareWorkouts, patchCareRoutineDay, saveCareFood, saveCareMeal, setCareFoodFavorite, setCareOneoffStatus,
} from '../../lib/careApi';
import CareDailyRecords from './CareDailyRecords';
import CareRoutineSection from './CareRoutineSection';
import CareAnalysis from './CareAnalysis';
import CareRecordHistory from './CareRecordHistory';
import CareDetailDialog from './CareDetailDialog';
import CareActionDialog from './CareActionDialog';
import CareBodyChart from './CareBodyChart';
import './care.css';

const UNITS = ['g', 'mL', '개', '인분'];
const MEAL_TYPES = ['아침', '점심', '저녁', '간식'];
const BODY_FIELDS = [['weight_kg', '체중'], ['muscle_kg', '골격근량'], ['body_fat_kg', '체지방량'], ['body_water_kg', '체수분량']];
const sortMeals = (items) => [...items].sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type) || (a.eaten_at || '').localeCompare(b.eaten_at || '') || String(a.id).localeCompare(String(b.id)));
const mealDescription = (meal, label) => {
    const names = (meal.care_meal_items || []).map((item) => item.food_name);
    const summary = names.slice(0, 2).map((name) => name.length > 18 ? `${name.slice(0, 18)}…` : name).join(', ');
    return `${label}${meal.eaten_at ? ` ${meal.eaten_at.slice(0, 5)}` : ''} · ${summary}${names.length > 2 ? ` 외 ${names.length - 2}개` : ''}`;
};
const emptyFood = { name: '', base_amount: '100', unit: 'g', base_kcal: '', base_protein_g: '' };
const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) &&
        `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value;
};
const moveDate = (value, days) => {
    const next = new Date(`${value}T12:00:00`);
    next.setDate(next.getDate() + days);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
};
const moveMonth = (month, amount) => {
    const [year, number] = month.split('-').map(Number);
    const next = new Date(year, number - 1 + amount, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
};
const calculatedKcal = (item, amount) => Math.round(Number(item.base_kcal) * Number(amount) / Number(item.base_amount) * 1000) / 1000;
const validNumber = (value, allowZero = false) => {
    const number = Number(value);
    return value !== '' && Number.isFinite(number) && number <= 999999999.999 && (allowZero ? number >= 0 : number > 0);
};
const inputClass = 'ui-input w-full min-w-0 rounded-lg border px-3 py-2 text-sm';
const buttonClass = 'ui-control rounded-lg border px-3 py-2 text-sm';

export default function CarePage() {
    const userId = useAuthStore((state) => state.user?.id);
    const queryClient = useQueryClient();
    const [date, setDate] = useState(today);
    const selectDate = (value) => { setDate(value); setMealForm(null); };
    const [view, setView] = useState('day');
    const [historyMonth, setHistoryMonth] = useState(() => today().slice(0, 7));
    const [historyDate, setHistoryDate] = useState(null);
    const [historyYear, historyNumber] = historyMonth.split('-').map(Number);
    const historyStart = `${historyMonth}-01`;
    const historyEnd = `${historyMonth}-${String(new Date(historyYear, historyNumber, 0).getDate()).padStart(2, '0')}`;
    const [activePanel, setActivePanel] = useState(null);
    const [bodyAddRequest, setBodyAddRequest] = useState(0);
    const [newRecordSection, setNewRecordSection] = useState(null);
    const [measurementToEdit, setMeasurementToEdit] = useState(null);
    const [search, setSearch] = useState('');
    const [mealSearch, setMealSearch] = useState('');
    const [foodListSearch, setFoodListSearch] = useState('');
    const [foodListPage, setFoodListPage] = useState(1);
    const [foodForm, setFoodForm] = useState(null);
    const [mealForm, setMealForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [childBusy, setChildBusy] = useState(false);
    const [error, setError] = useState('');
    const [actionDialog, setActionDialog] = useState(null);
    const foodsQuery = useQuery({ queryKey: ['care-foods', userId], queryFn: () => fetchCareFoods(userId), enabled: !!userId && (activePanel === 'food' || (activePanel === 'meal' && !!mealForm)) });
    const mealsQuery = useQuery({ queryKey: ['care-meals', userId, date], queryFn: () => fetchCareMeals(userId, date), enabled: !!userId && (view === 'day' || activePanel === 'meal') });
    const measurementsQuery = useQuery({ queryKey: ['care-measurement-latest', userId, date], queryFn: () => fetchLatestCareMeasurement(userId, date), enabled: !!userId && view === 'day' });
    const chartStart = moveDate(date, -29);
    const chartQuery = useQuery({ queryKey: ['care-measurement-chart', userId, 'home', chartStart, date], queryFn: () => fetchCareMeasurementsRange(userId, chartStart, date), enabled: !!userId && view === 'day' });
    const workoutsQuery = useQuery({ queryKey: ['care-workouts', userId, date], queryFn: () => fetchCareWorkouts(userId, date), enabled: !!userId && view === 'day' });
    const energyQuery = useQuery({ queryKey: ['care-energy', userId, date], queryFn: () => fetchCareDailyEnergy(userId, date), enabled: !!userId && view === 'day' });
    const routineQuery = useQuery({ queryKey: ['care-routine-day', userId, date], queryFn: () => fetchCareRoutineDay(date), enabled: !!userId && view === 'day' });
    const periodQuery = useQuery({ queryKey: ['care-period', userId, 'history', historyStart, historyEnd], queryFn: () => fetchCarePeriodSummary(historyStart, historyEnd), enabled: !!userId && view === 'history' });
    const balanceDays = (periodQuery.data || []).filter((row) => row.total_kcal != null && (Number(row.meal_count) > 0 || row.intake_confirmed));
    const monthBalance = Math.round(balanceDays.reduce((sum, row) => sum + Number(row.total_kcal) - Number(row.intake_kcal), 0) * 10) / 10;
    const foods = foodsQuery.data || [];
    const meals = mealsQuery.data || [];
    const filteredFoods = foods.filter((food) => food.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const mealFoods = mealSearch.trim() ? foods.filter((food) => food.name.toLocaleLowerCase().includes(mealSearch.trim().toLocaleLowerCase())) : foods.filter((food) => food.is_favorite);
    const listedFoods = foods.filter((food) => food.name.toLocaleLowerCase().includes(foodListSearch.trim().toLocaleLowerCase()));
    const foodListPages = Math.max(1, Math.ceil(listedFoods.length / 10));
    const currentFoodListPage = Math.min(foodListPage, foodListPages);
    const totalKcal = meals.reduce((sum, meal) => sum + (meal.care_meal_items || []).reduce((mealSum, item) => mealSum + Number(item.kcal), 0), 0);
    const mealItems = meals.flatMap((meal) => meal.care_meal_items || []);
    const proteinItems = mealItems.filter((item) => item.protein_g != null);
    const totalProtein = proteinItems.reduce((sum, item) => sum + Number(item.protein_g), 0);
    const proteinMissing = mealItems.length - proteinItems.length;
    const mealPreview = sortMeals(meals);
    const mealLabel = (meal) => {
        const sameType = mealPreview.filter((item) => item.meal_type === meal.meal_type);
        return sameType.length > 1 ? `${meal.meal_type} ${sameType.findIndex((item) => item.id === meal.id) + 1}` : meal.meal_type;
    };
    const lastMeasurement = measurementsQuery.data;
    const workouts = workoutsQuery.data || [];
    const energy = energyQuery.data;
    const routines = (routineQuery.data || []).filter((item) => !item.hidden);
    const lastBodyValues = Object.fromEntries(BODY_FIELDS.map(([key]) => [key, lastMeasurement?.[key]]));
    const workoutMinutes = workouts.filter((workout) => workout.duration_minutes != null).reduce((sum, workout) => sum + Number(workout.duration_minutes), 0);
    const dailyBalance = mealsQuery.isSuccess && energy?.total_kcal != null && (meals.length || energy.intake_confirmed) ? Number(energy.total_kcal) - totalKcal : null;
    const format = (value) => Math.round(Number(value) * 10) / 10;
    const tilePreview = {
        workout: workoutsQuery.isSuccess && workouts.length ? <>{workouts.slice(0, 3).map((workout) => <span key={workout.id}>{workout.name}{workout.duration_minutes == null ? '' : ` · ${workout.duration_minutes}분`}</span>)}{workouts.length > 3 && <span>외 {workouts.length - 3}건</span>}</> : null,
        routine: routineQuery.isSuccess && routines.length ? <>{routines.map((item) => <label key={item.routine_id ? `routine-${item.routine_id}` : `once-${item.day_id}`} className="care-routine-preview-row diary-editor-check-row"><span className="relative flex h-5 w-5 shrink-0 items-center justify-center"><CareInput type="checkbox" className="peer sr-only" checked={item.status === 'done'} disabled={busy} aria-label={`${item.name} 완료`} onChange={async (event) => {
            setBusy(true);
            setError('');
            try {
                await (item.routine_id ? patchCareRoutineDay(item.routine_id, date, event.target.checked ? 'done' : 'pending') : setCareOneoffStatus(userId, item.day_id, event.target.checked ? 'done' : 'pending'));
                await Promise.all([queryClient.invalidateQueries({ queryKey: ['care-routine-day', userId] }), queryClient.invalidateQueries({ queryKey: ['care-routine-range', userId] })]);
            } catch (e) { setError(e.message || '루틴을 변경하지 못했습니다.'); }
            finally { setBusy(false); }
        }} /><span className="diary-editor-check-box flex h-4 w-4 items-center justify-center rounded border border-border-subtle bg-[var(--color-page-surface)] text-white transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)] [&>svg]:peer-checked:opacity-100"><svg viewBox="0 0 16 16" className="h-3 w-3 opacity-0 transition" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11 12.5 5" /></svg></span></span><span className={item.status === 'skipped' ? 'line-through' : ''}>{item.name}</span></label>)}</> : null,
        energy: energyQuery.isSuccess && energy ? <>{energy.total_kcal != null && <span>총 소모 {format(energy.total_kcal)} kcal</span>}{mealsQuery.isSuccess && (meals.length || energy.intake_confirmed) && <span>섭취 {format(totalKcal)} kcal{!energy.intake_confirmed || date === today() ? ' · 잠정' : ''}</span>}{dailyBalance != null && <span>차이 {format(dailyBalance)} kcal</span>}</> : null,
        analysis: chartQuery.isPending ? <span>측정 기록을 불러오는 중...</span> : chartQuery.isError ? <span role="alert" className="ui-danger-text">측정 기록을 불러오지 못했습니다.</span> : <CareBodyChart rows={chartQuery.data || []} start={chartStart} end={date} />,
    };
    const tiles = [
        { key: 'meal', number: '01', label: '식사', value: mealsQuery.isError ? '불러오기 실패' : mealsQuery.isPending ? '불러오는 중' : meals.length ? format(totalKcal) : '미기록', unit: meals.length ? 'kcal' : '', note: meals.length ? '' : '먹은 음식과 영양을 기록하세요.' },
        { key: 'body', number: '02', label: '신체 측정', value: measurementsQuery.isError ? '불러오기 실패' : measurementsQuery.isPending ? '불러오는 중' : lastMeasurement ? '' : '미기록', unit: '', note: lastMeasurement ? '' : '체중과 신체 수치를 기록하세요.' },
        { key: 'workout', number: '03', label: '운동', value: workoutsQuery.isError ? '불러오기 실패' : workoutsQuery.isPending ? '불러오는 중' : workouts.length ? workouts.length : '미기록', unit: workouts.length ? '건' : '', note: workouts.length ? `${workouts.some((workout) => workout.duration_minutes != null) ? `${workoutMinutes}분 기록` : '시간 미기록'}${workouts.some((workout) => workout.duration_minutes == null) ? ' · 일부 시간 미기록' : ''}` : '오늘의 운동을 기록하세요.' },
        { key: 'routine', number: '04', label: '루틴', value: routineQuery.isError ? '불러오기 실패' : routineQuery.isPending ? '불러오는 중' : routines.length ? `${routines.filter((item) => item.status === 'done').length}/${routines.length}` : '예정 없음', unit: '', note: routines.length ? '완료 / 예정된 루틴' : '반복 루틴을 만들 수 있습니다.' },
        { key: 'energy', number: '05', label: '총 활동량', value: energyQuery.isError ? '불러오기 실패' : energyQuery.isPending ? '불러오는 중' : energy?.active_kcal == null ? '미기록' : format(energy.active_kcal), unit: energy?.active_kcal == null ? '' : 'kcal', note: energyQuery.isSuccess && energy?.active_kcal == null ? '활동 소모 미기록' : '' },
        { key: 'analysis', number: '06', label: '기록 분석', value: '', unit: '', note: '' },
    ];

    const run = async (action, refresh) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await queryClient.invalidateQueries({ queryKey: refresh });
        } catch (e) {
            setError(e.message || '저장에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const toggleFavorite = (food) => run(() => setCareFoodFavorite(userId, food.id, !food.is_favorite), ['care-foods', userId]);
    const favoriteButton = (food) => <button type="button" className={'care-food-favorite ui-fav ' + (food.is_favorite ? 'ui-fav-on' : 'ui-fav-off')} disabled={busy} aria-label={`${food.name} ${food.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}`} aria-pressed={!!food.is_favorite} onClick={() => toggleFavorite(food)}>{food.is_favorite ? '★' : '☆'}</button>;

    const submitFood = async (event) => {
        event.preventDefault();
        if (!foodForm.name.trim() || foodForm.name.trim().length > 120 ||
            !validNumber(foodForm.base_amount) || !validNumber(foodForm.base_kcal, true) ||
            (foodForm.base_protein_g !== '' && !validNumber(foodForm.base_protein_g, true)) || !UNITS.includes(foodForm.unit)) {
            setError('음식명, 기준량, 단위, 열량·단백질을 확인해 주세요.');
            return;
        }
        await run(async () => {
            const saved = await saveCareFood(userId, foodForm);
            if (activePanel === 'meal' && mealForm && !foodForm.id) addItem(saved);
            setFoodForm(null);
        }, ['care-foods', userId]);
    };

    const addItem = (food) => {
        setMealForm((current) => ({
            ...current,
            items: [...current.items, {
                food_id: food.id, food_name: food.name, base_amount: food.base_amount,
                unit: food.unit, base_kcal: food.base_kcal, base_protein_g: food.base_protein_g,
                amount: String(food.base_amount), kcal: String(food.base_kcal),
                protein_g: food.base_protein_g, manual_kcal: false,
            }],
        }));
    };

    const updateItem = (index, patch) => {
        setMealForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => {
                if (index !== itemIndex) return item;
                const next = { ...item, ...patch };
                if ('amount' in patch && !next.manual_kcal) next.kcal = String(calculatedKcal(next, patch.amount));
                if ('amount' in patch && next.base_protein_g != null) next.protein_g = patch.amount === '' ? '' : String(Math.round(Number(next.base_protein_g) * Number(patch.amount) / Number(next.base_amount) * 1000) / 1000);
                if ('manual_kcal' in patch && !patch.manual_kcal) next.kcal = String(calculatedKcal(next, next.amount));
                return next;
            }),
        }));
    };

    const submitMeal = async (event) => {
        event.preventDefault();
        if (!MEAL_TYPES.includes(mealForm.meal_type) || !mealForm.items.length || mealForm.note.length > 5000 ||
            mealForm.items.some((item) => !validNumber(item.amount) || !validNumber(item.base_amount) ||
                !validNumber(item.base_kcal, true) || !validNumber(item.kcal, true) ||
                (item.base_protein_g != null && !validNumber(item.base_protein_g, true)) || !UNITS.includes(item.unit))) {
            setError('식사와 음식의 수량·열량을 확인해 주세요.');
            return;
        }
        await run(async () => {
            await saveCareMeal(mealForm);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['care-period', userId] }),
                queryClient.invalidateQueries({ queryKey: ['care-history', userId] }),
            ]);
            setMealForm(null);
        }, ['care-meals', userId, date]);
    };

    const editMeal = (meal) => {
        setError('');
        setMealSearch('');
        setMealForm({ ...meal, items: [...(meal.care_meal_items || [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => ({ ...item, amount: String(item.amount), kcal: String(item.kcal) })) });
        setActivePanel('meal');
    };

    const confirmDeleteMeal = (meal, label = mealLabel(meal)) => {
        setError('');
        setActionDialog({ message: `‘${mealDescription(meal, label)}’ 기록을 삭제할까요?`, onConfirm: () => run(async () => {
            await deleteCareMeal(userId, meal.id);
            await Promise.all([queryClient.invalidateQueries({ queryKey: ['care-period', userId] }), queryClient.invalidateQueries({ queryKey: ['care-history', userId] })]);
        }, ['care-meals', userId, meal.meal_date]) });
    };

    const addHistoryRecord = (section, selectedDate) => {
        setHistoryDate(null);
        setDate(selectedDate);
        setError('');
        setNewRecordSection(section);
        setMeasurementToEdit(null);
        setFoodForm(null);
        if (section === 'meal') { setMealSearch(''); setMealForm({ request_key: crypto.randomUUID(), meal_date: selectedDate, meal_type: '아침', eaten_at: '', note: '', items: [] }); }
        else setMealForm(null);
        setActivePanel(section);
    };

    const editHistoryMeal = (meal) => {
        setHistoryDate(null);
        setDate(meal.meal_date);
        setNewRecordSection(null);
        editMeal(meal);
    };

    const editHistoryMeasurement = (measurement) => {
        setHistoryDate(null);
        setDate(measurement.measurement_date);
        setNewRecordSection(null);
        setMeasurementToEdit(measurement);
        setActivePanel('body');
    };

    const deleteHistoryMeasurement = (measurement) => {
        setHistoryDate(null);
        setActionDialog({ message: '이 측정을 삭제할까요?', onConfirm: () => run(async () => {
            await deleteCareMeasurement(userId, measurement.id);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['care-measurement-latest', userId] }),
                queryClient.invalidateQueries({ queryKey: ['care-measurement-chart', userId] }),
                queryClient.invalidateQueries({ queryKey: ['care-history', userId] }),
            ]);
        }, ['care-measurements-range', userId]) });
    };

    return (
        <main className="care-page page-text-main mx-auto w-full min-w-0 max-w-[82rem] space-y-5 overflow-x-hidden px-3 py-5 sm:px-6 lg:px-9">
            <div className="care-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle">
                <div className="care-tabs inline-flex rounded-xl border border-border-subtle p-1" role="group" aria-label="가꿈 화면">
                    <CareButton type="button" aria-pressed={view === 'day'} onClick={() => { setHistoryDate(null); setView('day'); }} className={'care-tab rounded-lg px-4 py-2 text-sm font-medium ' + (view === 'day' ? 'care-selected' : 'page-text-muted')}>하루 기록</CareButton>
                    <CareButton type="button" aria-pressed={view === 'history'} onClick={() => { setHistoryDate(null); setView('history'); }} className={'care-tab rounded-lg px-4 py-2 text-sm font-medium ' + (view === 'history' ? 'care-selected' : 'page-text-muted')}>기록 모아보기</CareButton>
                </div>
                <div className="care-toolbar-controls">
                    {view === 'day' && <div className="care-date-nav" role="group" aria-label="가꿈 날짜 선택">
                        <CareButton type="button" className="ui-control care-date-arrow" aria-label="이전 날짜" onClick={() => selectDate(moveDate(date, -1))}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 5L7.5 10l5 5" /></svg></CareButton>
                        <label className="care-date-field"><span className="sr-only">날짜</span><CareInput type="date" value={date} onChange={(event) => { if (validDate(event.target.value)) selectDate(event.target.value); }} className={inputClass} /></label>
                        <CareButton type="button" className="ui-control care-date-arrow" aria-label="다음 날짜" onClick={() => selectDate(moveDate(date, 1))}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 5l5 5-5 5" /></svg></CareButton>
                        <CareButton type="button" className="ui-control care-date-today" disabled={date === today()} onClick={() => selectDate(today())}>오늘</CareButton>
                    </div>}
                    {view === 'history' && <div className="care-date-nav" role="group" aria-label="기록 모아보기 월 선택">
                        {periodQuery.isSuccess && balanceDays.length > 0 && <span className="care-history-total">누적 {monthBalance > 0 ? '부족' : monthBalance < 0 ? '초과' : '차이'} <strong>{format(Math.abs(monthBalance))} kcal</strong></span>}
                        <CareButton type="button" className="ui-control care-date-arrow" aria-label="이전 달" onClick={() => { setHistoryMonth(moveMonth(historyMonth, -1)); setHistoryDate(null); }}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 5L7.5 10l5 5" /></svg></CareButton>
                        <strong className="care-history-month">{historyMonth.slice(0, 4)}년 {Number(historyMonth.slice(5))}월</strong>
                        <CareButton type="button" className="ui-control care-date-arrow" aria-label="다음 달" onClick={() => { setHistoryMonth(moveMonth(historyMonth, 1)); setHistoryDate(null); }}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 5l5 5-5 5" /></svg></CareButton>
                    </div>}
                    <CareButton type="button" className="care-food-button" onClick={() => { setError(''); setActivePanel('food'); }}>음식 사전</CareButton>
                </div>
            </div>

            {error && !activePanel && <div role="alert" className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">{error}</div>}

            {view === 'day'
                ? <div className="care-tiles grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 min-[1281px]:grid-cols-3">
                    {tiles.map((tile) => tile.key === 'meal' ? <div key={tile.key} className="care-tile care-meal-tile flex min-w-0 flex-col p-5 text-left sm:p-6">
                        <CareButton type="button" className="care-meal-open" aria-label="식사 기록 추가" disabled={busy} onClick={() => { setError(''); setMealSearch(''); setMealForm({ request_key: crypto.randomUUID(), meal_date: date, meal_type: '아침', eaten_at: '', note: '', items: [] }); setActivePanel('meal'); }} />
                        <div className="care-meal-content flex items-start justify-between gap-2"><span className="text-sm font-medium">{tile.label}</span><span className="care-tile-number text-xs font-semibold">{tile.number}</span></div>
                        <div className="care-meal-content care-meal-summary min-w-0"><div className="flex min-w-0 items-baseline gap-1.5"><strong className="care-tile-value truncate font-semibold tracking-tight">{tile.value}</strong>{tile.unit && <span className="page-text-muted shrink-0 text-sm">{tile.unit}</span>}{proteinItems.length > 0 && <span className="care-meal-protein page-text-muted ml-2 shrink-0 text-xs">{proteinMissing ? '기록된 ' : ''}단백질 {format(totalProtein)} g</span>}</div>{tile.note && <p className="care-tile-note page-text-muted mt-2 text-xs">{tile.note}</p>}</div>
                        {mealPreview.length > 0 && <div className="care-meal-content care-meal-preview page-text-muted text-xs">{mealPreview.map((meal) => <div key={meal.id} className="care-meal-entry"><strong className="care-meal-preview-label">{mealLabel(meal)}</strong><div className="care-meal-foods">{[...(meal.care_meal_items || [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => <span key={item.id}>{item.food_name}</span>)}</div><div className="care-meal-entry-actions"><CareButton type="button" disabled={busy} aria-label={`${mealDescription(meal, mealLabel(meal))} 식사 수정`} onClick={() => editMeal(meal)}>수정</CareButton><CareButton type="button" className="ui-danger-text" disabled={busy} aria-label={`${mealDescription(meal, mealLabel(meal))} 식사 삭제`} onClick={() => confirmDeleteMeal(meal)}>삭제</CareButton></div></div>)}</div>}
                    </div> : tile.key === 'body' ? <CareButton key={tile.key} type="button" onClick={() => { setError(''); setActivePanel('body'); }} className="care-tile care-body-tile flex min-w-0 flex-col p-5 text-left sm:p-6">
                        <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{tile.label}</span><span className="care-tile-number text-xs font-semibold">{tile.number}</span></div>
                        {measurementsQuery.isPending || measurementsQuery.isError || !lastMeasurement ? <div className="care-summary-main"><strong className="care-tile-value">{tile.value}</strong><span className="page-text-muted text-xs">{tile.note}</span></div> : <><div className="care-body-grid">{BODY_FIELDS.map(([key, label]) => <div key={key}><span>{label}</span><strong>{lastBodyValues[key] == null ? '—' : <>{format(lastBodyValues[key])}<small> kg</small></>}</strong></div>)}</div><span className="care-body-time">마지막 기록 {lastMeasurement.measurement_date} {lastMeasurement.measured_at.slice(0, 5)}</span></>}
                    </CareButton> : tile.key === 'routine' ? <div key={tile.key} className="care-tile care-routine-tile flex min-w-0 flex-col p-5 text-left sm:p-6">
                        <CareButton type="button" className="care-meal-open" aria-label="루틴 열기" onClick={() => { setError(''); setActivePanel('routine'); }} />
                        <div className="care-routine-content flex items-start justify-between gap-2"><span className="text-sm font-medium">{tile.label}</span><span className="care-tile-number text-xs font-semibold">{tile.number}</span></div>
                        <div className="care-routine-content care-summary-main min-w-0"><strong className={'care-tile-value font-semibold tracking-tight ' + (routines.length > 0 && routines.every((item) => item.status === 'done') ? 'care-routine-complete' : '')}>{tile.value}</strong></div>
                        <div className="care-routine-content care-summary-preview page-text-muted text-xs">{tilePreview.routine || <span>{tile.note}</span>}</div>
                    </div> : tile.key === 'analysis' ? <CareButton key={tile.key} type="button" onClick={() => { setError(''); setActivePanel('analysis'); }} className="care-tile care-analysis-tile flex min-w-0 flex-col p-5 text-left sm:p-6">
                        <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{tile.label}</span><span className="care-tile-number text-xs font-semibold">{tile.number}</span></div>
                        {tilePreview.analysis}
                    </CareButton> : <CareButton key={tile.key} type="button" onClick={() => { setError(''); setActivePanel(tile.key); }} className="care-tile care-summary-tile flex min-w-0 flex-col p-5 text-left sm:p-6">
                        <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{tile.label}</span><span className="care-tile-number text-xs font-semibold">{tile.number}</span></div>
                        <div className="care-summary-main min-w-0"><div className="flex min-w-0 items-baseline gap-1.5"><strong className="care-tile-value truncate font-semibold tracking-tight">{tile.value}</strong>{tile.unit && <span className="page-text-muted shrink-0 text-sm">{tile.unit}</span>}</div></div>
                        <div className="care-summary-preview page-text-muted text-xs">{tilePreview[tile.key] || (tile.note ? <span>{tile.note}</span> : null)}</div>
                    </CareButton>)}
                </div>
                : <CareRecordHistory userId={userId} month={historyMonth} periodQuery={periodQuery} selectedDate={historyDate} onSelectDate={setHistoryDate} onDateChange={(nextDate) => { setHistoryDate(null); setDate(nextDate); setView('day'); setMealForm(null); }} onAddRecord={addHistoryRecord} onEditMeal={editHistoryMeal} onDeleteMeal={(meal, label) => { setHistoryDate(null); confirmDeleteMeal(meal, label); }} onEditMeasurement={editHistoryMeasurement} onDeleteMeasurement={deleteHistoryMeasurement} onBusyChange={setChildBusy} />}

            {activePanel && <CareDetailDialog title={foodForm ? (foodForm.id ? '음식 수정' : '음식 등록') : activePanel === 'meal' ? `${date} 식사${mealForm ? ' 기록' : ''}` : activePanel === 'body' ? `신체 측정 · ${moveDate(date, -7)} ~ ${date}` : { food: '음식 사전', workout: '운동 기록', routine: '루틴', energy: '총 활동량', analysis: '기록 분석' }[activePanel]} headerAction={activePanel === 'body' ? <CareButton type="button" className="ui-btn-success" disabled={busy || childBusy} onClick={() => setBodyAddRequest((count) => count + 1)}>+ 측정 기록</CareButton> : activePanel === 'meal' && mealForm && !foodForm && <CareButton type="button" className={buttonClass} disabled={busy} onClick={() => setMealForm(null)}>기록 목록</CareButton>} onClose={() => { if (busy || childBusy) return; setFoodForm(null); setMealForm(null); setNewRecordSection(null); setMeasurementToEdit(null); setActivePanel(null); }}>
                {error && <p role="alert" className="ui-danger-text mb-4 text-sm">{error}</p>}
                {foodForm ? <><form onSubmit={submitFood} className="care-food-form space-y-4">
                    <div className="care-food-form-fields space-y-4">
                    <label className="block text-sm"><span className="care-food-field-label">음식명</span><CareInput required maxLength={120} value={foodForm.name} onChange={(event) => setFoodForm({ ...foodForm, name: event.target.value })} className={inputClass + ' mt-1'} /></label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="min-w-0 text-sm"><span className="care-food-field-label">기준량</span><CareInput required type="number" min="0.001" max="999999999.999" step="0.001" value={foodForm.base_amount} onChange={(event) => setFoodForm({ ...foodForm, base_amount: event.target.value })} className={inputClass + ' mt-1'} /></label>
                        <label className="min-w-0 text-sm"><span className="care-food-field-label">단위</span><CareSelect value={foodForm.unit} onChange={(event) => setFoodForm({ ...foodForm, unit: event.target.value })} className={inputClass + ' mt-1'}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</CareSelect></label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="min-w-0 text-sm"><span className="care-food-field-label">기준 열량 (kcal)</span><CareInput required type="number" min="0" max="999999999.999" step="0.001" value={foodForm.base_kcal} onChange={(event) => setFoodForm({ ...foodForm, base_kcal: event.target.value })} className={inputClass + ' mt-1'} /></label>
                        <label className="min-w-0 text-sm"><span className="care-food-field-label">기준 단백질 (g) <small className="page-text-muted">선택</small></span><CareInput type="number" min="0" max="999999999.999" step="0.001" value={foodForm.base_protein_g ?? ''} onChange={(event) => setFoodForm({ ...foodForm, base_protein_g: event.target.value })} className={inputClass + ' mt-1'} /></label>
                    </div>
                    </div>
                    <div className="flex justify-end gap-1.5 border-t border-border-subtle pt-3"><CareButton type="button" className="ui-control care-food-form-action" disabled={busy} onClick={() => setFoodForm(null)}>취소</CareButton><CareButton type="submit" className="care-food-form-action care-food-form-save" disabled={busy}>{busy ? '저장 중...' : '음식 저장'}</CareButton></div>
                </form><section className="care-food-directory" aria-label="등록한 음식"><div className="care-food-directory-head"><h3>등록한 음식 <span>{foods.length}</span></h3><span className="page-text-muted text-xs">검색 결과 {listedFoods.length}개</span></div><CareInput type="search" value={foodListSearch} onChange={(event) => { setFoodListSearch(event.target.value); setFoodListPage(1); }} placeholder="등록한 음식 검색" aria-label="등록한 음식 검색" className={inputClass} />
                    {foodsQuery.isPending && <p className="page-text-muted text-xs">음식을 불러오는 중...</p>}{foodsQuery.isError && <p role="alert" className="ui-danger-text text-xs">음식을 불러오지 못했습니다: {foodsQuery.error.message}</p>}
                    {foodsQuery.isSuccess && !listedFoods.length && <p className="page-text-muted py-4 text-center text-xs">{foodListSearch.trim() ? '검색 결과가 없습니다.' : '등록한 음식이 없습니다.'}</p>}
                    {foodsQuery.isSuccess && !!listedFoods.length && <><div className="care-food-directory-list">{listedFoods.slice((currentFoodListPage - 1) * 10, currentFoodListPage * 10).map((food) => <div key={food.id} className="care-food-directory-row"><span className="care-food-name-with-favorite">{favoriteButton(food)}<strong title={food.name}>{food.name}</strong></span><span className="page-text-muted">{food.base_amount}{food.unit} · {food.base_kcal} kcal{food.base_protein_g == null ? '' : ` · 단백질 ${food.base_protein_g} g`}</span><div><CareButton type="button" disabled={busy} onClick={() => { setError(''); setFoodForm({ ...food, base_amount: String(food.base_amount), base_kcal: String(food.base_kcal), base_protein_g: food.base_protein_g == null ? '' : String(food.base_protein_g) }); }}>수정</CareButton><CareButton type="button" className="ui-danger-text" disabled={busy} onClick={() => setActionDialog({ message: `‘${food.name}’ 음식을 목록에서 삭제할까요? 과거 식사 기록에는 남습니다.`, onConfirm: () => run(async () => { await archiveCareFood(userId, food.id); setFoodForm((current) => current?.id === food.id ? null : current); }, ['care-foods', userId]) })}>삭제</CareButton></div></div>)}</div><div className="care-food-directory-pages"><span className="page-text-muted">{currentFoodListPage} / {foodListPages}</span><div><CareButton type="button" className={buttonClass} disabled={currentFoodListPage === 1} onClick={() => setFoodListPage(currentFoodListPage - 1)}>이전</CareButton><CareButton type="button" className={buttonClass} disabled={currentFoodListPage === foodListPages} onClick={() => setFoodListPage(currentFoodListPage + 1)}>다음</CareButton></div></div></>}
                </section></> : activePanel === 'food' ? <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="page-text-muted text-sm">음식을 검색하거나 새로 등록하세요.</p><CareButton type="button" className="ui-btn-success rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => { setError(''); setFoodForm({ ...emptyFood }); }}>+ 음식 등록</CareButton></div>
                    <CareInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="음식 검색" aria-label="음식 검색" className={inputClass} />
                    {foodsQuery.isPending && <p className="page-text-muted text-sm">음식을 불러오는 중...</p>}
                    {foodsQuery.isError && <p role="alert" className="ui-danger-text text-sm">음식을 불러오지 못했습니다: {foodsQuery.error.message}</p>}
                    <div className="space-y-2">{filteredFoods.map((food) => <div key={food.id} className="page-list-item flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm"><div className="min-w-0 break-words"><span className="care-food-name-with-favorite">{favoriteButton(food)}<strong>{food.name}</strong></span><p className="page-text-muted mt-1 text-xs">기준 {food.base_amount}{food.unit} · {food.base_kcal} kcal · 단백질 {food.base_protein_g == null ? '미기록' : food.base_protein_g + ' g'}</p></div><div className="flex gap-1"><CareButton type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); setFoodForm({ ...food, base_amount: String(food.base_amount), base_kcal: String(food.base_kcal), base_protein_g: food.base_protein_g == null ? '' : String(food.base_protein_g) }); }}>수정</CareButton><CareButton type="button" className={buttonClass} disabled={busy} onClick={() => setActionDialog({ message: `‘${food.name}’ 음식을 목록에서 삭제할까요? 과거 식사 기록에는 남습니다.`, onConfirm: () => run(() => archiveCareFood(userId, food.id), ['care-foods', userId]) })}>삭제</CareButton></div></div>)}</div>
                    {foodsQuery.isSuccess && !filteredFoods.length && <p className="page-text-muted text-sm">검색 결과가 없습니다.</p>}
                </div> : activePanel === 'meal' ? mealForm ? <form onSubmit={submitMeal} className="care-meal-form space-y-5">
                    <div className="care-meal-section"><h3 className="care-meal-section-title mb-3">식사 구분</h3><div className="flex flex-wrap gap-2" role="group" aria-label="식사 구분">{MEAL_TYPES.map((type) => <CareButton key={type} type="button" aria-pressed={mealForm.meal_type === type} onClick={() => setMealForm({ ...mealForm, meal_type: type })} className={'rounded-full border px-4 py-2 text-sm transition ' + (mealForm.meal_type === type ? 'care-selected' : 'ui-control')}>{type}</CareButton>)}</div></div>
                    <div className="care-meal-section"><label className="block max-w-48"><span className="care-meal-section-title">먹은 시각</span><CareInput type="time" value={mealForm.eaten_at?.slice(0, 5) || ''} onChange={(event) => setMealForm({ ...mealForm, eaten_at: event.target.value })} className={inputClass + ' mt-3'} /></label></div>
                    <div className="care-meal-section space-y-3"><h3 className="care-meal-section-title">담은 음식 · {mealForm.items.length}개</h3>{mealForm.items.length ? <div className="care-meal-items">{mealForm.items.map((item, index) => <div key={(item.id || item.food_id) + '-' + index} className="care-meal-item">
                        <div className="care-meal-item-info"><strong>{item.food_name}</strong><p className="page-text-muted">기준 {item.base_amount}{item.unit} · {item.base_kcal} kcal{item.base_protein_g == null ? '' : ` · 단백질 ${item.base_protein_g} g`}</p></div>
                        <label>섭취량 ({item.unit})<CareInput required type="number" min="0.001" max="999999999.999" step="0.001" value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} className={inputClass} /></label><label>열량 (kcal)<CareInput required type="number" min="0" max="999999999.999" step="0.001" value={item.kcal} onChange={(event) => updateItem(index, { kcal: event.target.value, manual_kcal: true })} className={inputClass} /></label>
                        <CareButton type="button" className="ui-danger-text care-meal-item-remove" onClick={() => setMealForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>빼기</CareButton>
                        {item.manual_kcal && <div className="care-meal-item-foot"><CareButton type="button" className="text-[var(--color-accent)]" onClick={() => updateItem(index, { manual_kcal: false })}>열량 자동 계산</CareButton></div>}
                    </div>)}</div> : <p className="page-text-muted text-xs">아래 음식 목록에서 담아 주세요.</p>}</div>
                    <div className="care-meal-section space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="care-meal-section-title">음식 찾기</h3><CareButton type="button" className="text-xs font-medium text-[var(--color-accent)]" onClick={() => { setError(''); setFoodForm({ ...emptyFood }); }}>+ 새 음식 등록</CareButton></div><CareInput value={mealSearch} onChange={(event) => setMealSearch(event.target.value)} placeholder="음식 이름 검색" aria-label="담을 음식 검색" className={inputClass + ' care-meal-search'} />
                        {foodsQuery.isPending && <p className="page-text-muted text-xs">음식을 불러오는 중...</p>}{foodsQuery.isError && <p role="alert" className="ui-danger-text text-xs">음식을 불러오지 못했습니다: {foodsQuery.error.message}</p>}
                        <div className="care-food-list max-h-48 overflow-y-auto">{mealFoods.map((food) => <div key={food.id} className="care-food-row min-w-0"><strong className="care-food-name min-w-0 truncate">{food.name}</strong><div className="care-food-meta page-text-muted"><span>{food.base_amount}{food.unit}</span><span>{food.base_kcal} kcal</span><span>단백질 {food.base_protein_g == null ? '미기록' : `${food.base_protein_g} g`}</span></div><CareButton type="button" className="ui-control care-food-add" onClick={() => addItem(food)}>담기</CareButton></div>)}</div>
                        {foodsQuery.isSuccess && !mealFoods.length && <p className="page-text-muted text-xs">{mealSearch.trim() ? '검색 결과가 없습니다.' : '즐겨찾기한 음식이 없습니다. 음식 등록에서 별을 눌러 추가하거나 이름으로 검색해 주세요.'}</p>}
                    </div>
                    <label className="care-meal-section block text-sm"><span className="care-meal-section-title">메모</span><CareTextarea maxLength={5000} value={mealForm.note} onChange={(event) => setMealForm({ ...mealForm, note: event.target.value })} className={inputClass + ' mt-3'} rows={2} /></label>
                    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:-mx-6 sm:px-6" style={{ backgroundColor: 'var(--color-surface-elevated)' }}><div className="text-sm font-medium">{format(mealForm.items.reduce((sum, item) => sum + Number(item.kcal || 0), 0))} kcal{mealForm.items.some((item) => item.base_protein_g != null) && <span className="page-text-muted text-xs"> · {mealForm.items.some((item) => item.base_protein_g == null) ? '기록된 ' : ''}단백질 {format(mealForm.items.reduce((sum, item) => sum + Number(item.protein_g || 0), 0))} g</span>}</div><div className="flex gap-2"><CareButton type="button" className={buttonClass} disabled={busy} onClick={() => setMealForm(null)}>취소</CareButton><CareButton type="submit" className="ui-btn-success rounded-lg border px-4 py-2 text-sm" disabled={busy}>{busy ? '저장 중...' : '식사 저장'}</CareButton></div></div>
                </form> : <div className="care-meal-list space-y-4">
                    <div className="care-meal-list-summary flex items-center justify-between gap-2"><p><strong className="care-meal-total">{format(totalKcal)} kcal</strong><span className="page-text-muted ml-2 text-xs">{meals.length}건</span></p><CareButton type="button" className="ui-btn-success rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => { setError(''); setMealSearch(''); setMealForm({ request_key: crypto.randomUUID(), meal_date: date, meal_type: '아침', eaten_at: '', note: '', items: [] }); }}>+ 식사 기록</CareButton></div>
                    {mealsQuery.isPending && <p className="page-text-muted text-sm">식사를 불러오는 중...</p>}{mealsQuery.isError && <p role="alert" className="ui-danger-text text-sm">식사를 불러오지 못했습니다: {mealsQuery.error.message}</p>}
                    {mealPreview.map((meal) => <div key={meal.id} className="care-meal-card min-w-0">
                        <div className="care-meal-card-head"><div className="care-meal-card-heading"><h3 className="care-meal-card-title">{mealLabel(meal)}</h3><span className="page-text-muted text-xs">{meal.eaten_at?.slice(0, 5)}</span><strong className="care-meal-card-kcal">{format((meal.care_meal_items || []).reduce((sum, item) => sum + Number(item.kcal), 0))} kcal</strong></div><div className="care-meal-card-actions"><CareButton type="button" disabled={busy} onClick={() => editMeal(meal)}>수정</CareButton><CareButton type="button" className="ui-danger-text" disabled={busy} onClick={() => confirmDeleteMeal(meal)}>삭제</CareButton></div></div>
                        <div className="care-meal-card-foods">{[...(meal.care_meal_items || [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => <div key={item.id} className="care-meal-card-item"><span className="min-w-0 break-words">{item.food_name}</span><span className="page-text-muted">{item.amount}{item.unit}{item.protein_g == null ? '' : ` · 단백질 ${item.protein_g} g`}</span><span>{item.kcal} kcal</span></div>)}</div>
                        {meal.note && <p className="care-meal-card-note page-text-muted whitespace-pre-wrap break-words">{meal.note}</p>}
                    </div>)}
                    {mealsQuery.isSuccess && !meals.length && <p className="page-text-muted py-8 text-center text-sm">이 날짜의 식사 기록이 없습니다.</p>}
                </div> : ['body', 'workout', 'energy'].includes(activePanel) ? <CareDailyRecords key={activePanel + date} userId={userId} date={date} section={activePanel} startWithNew={newRecordSection === activePanel} startWithEdit={measurementToEdit} addMeasurementRequest={bodyAddRequest} onBusyChange={setChildBusy} /> : activePanel === 'routine' ? <CareRoutineSection key={date} userId={userId} date={date} onBusyChange={setChildBusy} startWithNew={newRecordSection === 'routine'} /> : <CareAnalysis userId={userId} date={date} />}
            </CareDetailDialog>}
            {actionDialog && <CareActionDialog message={actionDialog.message} onClose={() => { if (!busy) setActionDialog(null); }} onConfirm={() => { setActionDialog(null); actionDialog.onConfirm(); }} />}
        </main>
    );
}
