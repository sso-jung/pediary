import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
    archiveCareFood, deleteCareMeal, fetchCareDailyEnergy, fetchCareFoods, fetchCareMeals,
    fetchCareMeasurements, fetchCareRoutineDay, fetchCareWorkouts, saveCareFood, saveCareMeal,
} from '../../lib/careApi';
import CareDailyRecords from './CareDailyRecords';
import CareRoutineSection from './CareRoutineSection';
import CareAnalysis from './CareAnalysis';
import CareRecordHistory from './CareRecordHistory';
import CareDetailDialog from './CareDetailDialog';

const UNITS = ['g', 'mL', '개', '인분'];
const MEAL_TYPES = ['아침', '점심', '저녁', '간식'];
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
const calculatedKcal = (item, amount) => Math.round(Number(item.base_kcal) * Number(amount) / Number(item.base_amount) * 1000) / 1000;
const validNumber = (value, allowZero = false) => {
    const number = Number(value);
    return value !== '' && Number.isFinite(number) && number <= 999999999.999 && (allowZero ? number >= 0 : number > 0);
};
const inputClass = 'ui-control w-full min-w-0 rounded-lg border px-3 py-2 text-sm';
const buttonClass = 'ui-control rounded-lg border px-3 py-2 text-sm';

export default function CarePage() {
    const userId = useAuthStore((state) => state.user?.id);
    const queryClient = useQueryClient();
    const [date, setDate] = useState(today);
    const [view, setView] = useState('day');
    const [activePanel, setActivePanel] = useState(null);
    const [search, setSearch] = useState('');
    const [foodForm, setFoodForm] = useState(null);
    const [mealForm, setMealForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const foodsQuery = useQuery({ queryKey: ['care-foods', userId], queryFn: () => fetchCareFoods(userId), enabled: !!userId && (activePanel === 'food' || (activePanel === 'meal' && !!mealForm)) });
    const mealsQuery = useQuery({ queryKey: ['care-meals', userId, date], queryFn: () => fetchCareMeals(userId, date), enabled: !!userId && view === 'day' });
    const measurementsQuery = useQuery({ queryKey: ['care-measurements', userId, date], queryFn: () => fetchCareMeasurements(userId, date), enabled: !!userId && view === 'day' });
    const workoutsQuery = useQuery({ queryKey: ['care-workouts', userId, date], queryFn: () => fetchCareWorkouts(userId, date), enabled: !!userId && view === 'day' });
    const energyQuery = useQuery({ queryKey: ['care-energy', userId, date], queryFn: () => fetchCareDailyEnergy(userId, date), enabled: !!userId && view === 'day' });
    const routineQuery = useQuery({ queryKey: ['care-routine-day', userId, date], queryFn: () => fetchCareRoutineDay(date), enabled: !!userId && view === 'day' });
    const foods = foodsQuery.data || [];
    const meals = mealsQuery.data || [];
    const filteredFoods = foods.filter((food) => food.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const totalKcal = meals.reduce((sum, meal) => sum + (meal.care_meal_items || []).reduce((mealSum, item) => mealSum + Number(item.kcal), 0), 0);
    const mealItems = meals.flatMap((meal) => meal.care_meal_items || []);
    const proteinItems = mealItems.filter((item) => item.protein_g != null);
    const totalProtein = proteinItems.reduce((sum, item) => sum + Number(item.protein_g), 0);
    const proteinMissing = mealItems.length - proteinItems.length;
    const measurements = measurementsQuery.data || [];
    const workouts = workoutsQuery.data || [];
    const energy = energyQuery.data;
    const routines = (routineQuery.data || []).filter((item) => !item.hidden);
    const lastMeasurement = measurements.at(-1);
    const lastMeasurementField = lastMeasurement && [['weight_kg', '체중'], ['muscle_kg', '골격근량'], ['body_fat_kg', '체지방량'], ['body_water_kg', '체수분량']].find(([key]) => lastMeasurement[key] != null);
    const workoutMinutes = workouts.filter((workout) => workout.duration_minutes != null).reduce((sum, workout) => sum + Number(workout.duration_minutes), 0);
    const dailyBalance = energy?.total_kcal != null && (meals.length || energy.intake_confirmed) ? Number(energy.total_kcal) - totalKcal : null;
    const format = (value) => Math.round(Number(value) * 10) / 10;
    const tiles = [
        { key: 'meal', number: '01', label: '식사', value: mealsQuery.isError ? '불러오기 실패' : mealsQuery.isPending ? '불러오는 중' : meals.length ? format(totalKcal) : '미기록', unit: meals.length ? 'kcal' : '', note: meals.length ? `단백질 ${proteinItems.length ? `${format(totalProtein)} g` : '미기록'}${proteinMissing ? ` · 미입력 ${proteinMissing}개` : ''} · ${meals.length}건` : '먹은 음식과 영양을 기록하세요.' },
        { key: 'body', number: '02', label: '신체 측정', value: measurementsQuery.isError ? '불러오기 실패' : measurementsQuery.isPending ? '불러오는 중' : lastMeasurementField ? format(lastMeasurement[lastMeasurementField[0]]) : '미기록', unit: lastMeasurementField ? 'kg' : '', note: lastMeasurementField ? `${lastMeasurementField[1]} · ${lastMeasurement.measured_at.slice(0, 5)} 측정` : '체중과 신체 수치를 기록하세요.' },
        { key: 'workout', number: '03', label: '운동', value: workoutsQuery.isError ? '불러오기 실패' : workoutsQuery.isPending ? '불러오는 중' : workouts.length ? workouts.length : '미기록', unit: workouts.length ? '건' : '', note: workouts.length ? `${workouts.some((workout) => workout.duration_minutes != null) ? `${workoutMinutes}분 기록` : '시간 미기록'}${workouts.some((workout) => workout.duration_minutes == null) ? ' · 일부 시간 미기록' : ''}` : '오늘의 운동을 기록하세요.' },
        { key: 'routine', number: '04', label: '루틴', value: routineQuery.isError ? '불러오기 실패' : routineQuery.isPending ? '불러오는 중' : routines.length ? `${routines.filter((item) => item.status === 'done').length}/${routines.length}` : '예정 없음', unit: '', note: routines.length ? '완료 / 예정된 루틴' : '반복 루틴을 만들 수 있습니다.' },
        { key: 'energy', number: '05', label: '에너지 수지', value: energyQuery.isError || mealsQuery.isError ? '불러오기 실패' : energyQuery.isPending || mealsQuery.isPending ? '불러오는 중' : dailyBalance == null ? '계산 전' : format(dailyBalance), unit: dailyBalance == null ? '' : 'kcal', note: dailyBalance == null ? '총 소모와 식사 기록이 필요합니다.' : `${dailyBalance >= 0 ? '적자' : '잉여'} · 총 소모 − 섭취${!energy.intake_confirmed || date === today() ? ' · 잠정' : ''}` },
        { key: 'analysis', number: '06', label: '기록 분석', value: '추이 보기', unit: '', note: '신체 수치와 에너지 변화를 확인하세요.' },
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

    return (
        <main className="page-text-main mx-auto w-full min-w-0 max-w-[100rem] space-y-5 overflow-x-hidden px-3 py-5 sm:px-6 lg:px-9">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-4">
                <div>
                    <h1 className="text-2xl font-semibold">가꿈</h1>
                    <p className="page-text-muted mt-1 text-sm">하루의 기록을 가볍게 확인하고 필요한 항목을 열어 보세요.</p>
                </div>
                <button type="button" className={buttonClass} onClick={() => { setError(''); setActivePanel('food'); }}>음식 사전</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-xl border border-border-subtle p-1" role="group" aria-label="가꿈 화면">
                    <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')} className={'rounded-lg px-4 py-2 text-sm font-medium ' + (view === 'day' ? 'bg-[var(--color-accent)] text-white' : 'page-text-muted')}>하루 기록</button>
                    <button type="button" aria-pressed={view === 'history'} onClick={() => setView('history')} className={'rounded-lg px-4 py-2 text-sm font-medium ' + (view === 'history' ? 'bg-[var(--color-accent)] text-white' : 'page-text-muted')}>기록 모아보기</button>
                </div>
                {view === 'day' && <label className="text-sm">날짜
                    <input type="date" value={date} onChange={(event) => { if (validDate(event.target.value)) { setDate(event.target.value); setMealForm(null); } }} className={inputClass + ' mt-1'} />
                </label>}
            </div>

            {error && !activePanel && <div role="alert" className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">{error}</div>}

            {view === 'day'
                ? <div className="grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-xl border border-border-subtle bg-[var(--color-border-subtle)] md:grid-cols-2 min-[1281px]:grid-cols-3">
                    {tiles.map((tile) => <button key={tile.key} type="button" onClick={() => { setError(''); setActivePanel(tile.key); }} className="flex h-[184px] min-w-0 flex-col justify-between bg-[var(--color-surface-elevated)] p-5 text-left transition-colors hover:bg-[var(--color-panel-bg)] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] sm:p-6">
                        <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{tile.label}</span><span className="text-xs font-semibold text-[var(--color-accent)]">{tile.number}</span></div>
                        <div className="min-w-0"><div className="flex min-w-0 items-baseline gap-1.5"><strong className="truncate text-3xl font-semibold tracking-tight">{tile.value}</strong>{tile.unit && <span className="page-text-muted shrink-0 text-sm">{tile.unit}</span>}</div><p className="page-text-muted mt-2 truncate text-xs" title={tile.note}>{tile.note}</p></div>
                        <span className="text-xs font-medium text-[var(--color-accent)]">자세히 보기 →</span>
                    </button>)}
                </div>
                : <CareRecordHistory userId={userId} onDateChange={(nextDate) => { setDate(nextDate); setView('day'); setMealForm(null); }} />}

            {activePanel && <CareDetailDialog title={foodForm ? (foodForm.id ? '음식 수정' : '음식 등록') : activePanel === 'meal' ? (mealForm ? '식사 기록' : '식사') : { food: '음식 사전', body: '신체 측정', workout: '운동 기록', routine: '루틴', energy: '에너지 수지', analysis: '기록 분석' }[activePanel]} onClose={() => { setFoodForm(null); setMealForm(null); setActivePanel(null); }}>
                {error && <p role="alert" className="ui-danger-text mb-4 text-sm">{error}</p>}
                {foodForm ? <form onSubmit={submitFood} className="space-y-4">
                    <p className="page-text-muted text-sm">기준량당 영양 정보를 입력하세요. 식사에 담으면 당시 값이 보관됩니다.</p>
                    <label className="block text-sm">음식명<input required maxLength={120} value={foodForm.name} onChange={(event) => setFoodForm({ ...foodForm, name: event.target.value })} className={inputClass + ' mt-1'} /></label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="min-w-0 text-sm">기준량<input required type="number" min="0.001" max="999999999.999" step="0.001" value={foodForm.base_amount} onChange={(event) => setFoodForm({ ...foodForm, base_amount: event.target.value })} className={inputClass + ' mt-1'} /></label>
                        <label className="min-w-0 text-sm">단위<select value={foodForm.unit} onChange={(event) => setFoodForm({ ...foodForm, unit: event.target.value })} className={inputClass + ' mt-1'}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="min-w-0 text-sm">기준 열량 (kcal)<input required type="number" min="0" max="999999999.999" step="0.001" value={foodForm.base_kcal} onChange={(event) => setFoodForm({ ...foodForm, base_kcal: event.target.value })} className={inputClass + ' mt-1'} /></label>
                        <label className="min-w-0 text-sm">기준 단백질 (g) <span className="page-text-muted text-xs">선택</span><input type="number" min="0" max="999999999.999" step="0.001" value={foodForm.base_protein_g ?? ''} onChange={(event) => setFoodForm({ ...foodForm, base_protein_g: event.target.value })} className={inputClass + ' mt-1'} /></label>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-border-subtle pt-4"><button type="button" className={buttonClass} disabled={busy} onClick={() => setFoodForm(null)}>취소</button><button type="submit" className="ui-btn-success rounded-lg border px-4 py-2 text-sm" disabled={busy}>{busy ? '저장 중...' : '음식 저장'}</button></div>
                </form> : activePanel === 'food' ? <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="page-text-muted text-sm">음식을 검색하거나 새로 등록하세요.</p><button type="button" className="ui-btn-success rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => { setError(''); setFoodForm({ ...emptyFood }); }}>+ 음식 등록</button></div>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="음식 검색" aria-label="음식 검색" className={inputClass} />
                    {foodsQuery.isPending && <p className="page-text-muted text-sm">음식을 불러오는 중...</p>}
                    {foodsQuery.isError && <p role="alert" className="ui-danger-text text-sm">음식을 불러오지 못했습니다: {foodsQuery.error.message}</p>}
                    <div className="space-y-2">{filteredFoods.map((food) => <div key={food.id} className="page-list-item flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm"><div className="min-w-0 break-words"><strong>{food.name}</strong><p className="page-text-muted mt-1 text-xs">기준 {food.base_amount}{food.unit} · {food.base_kcal} kcal · 단백질 {food.base_protein_g == null ? '미기록' : food.base_protein_g + ' g'}</p></div><div className="flex gap-1"><button type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); setFoodForm({ ...food, base_amount: String(food.base_amount), base_kcal: String(food.base_kcal), base_protein_g: food.base_protein_g == null ? '' : String(food.base_protein_g) }); }}>수정</button><button type="button" className={buttonClass} disabled={busy} onClick={() => { if (window.confirm('음식을 보관할까요? 과거 식사에는 남습니다.')) run(() => archiveCareFood(userId, food.id), ['care-foods', userId]); }}>보관</button></div></div>)}</div>
                    {foodsQuery.isSuccess && !filteredFoods.length && <p className="page-text-muted text-sm">검색 결과가 없습니다.</p>}
                </div> : activePanel === 'meal' ? mealForm ? <form onSubmit={submitMeal} className="space-y-5">
                    <div><p className="page-text-muted mb-2 text-xs">식사 구분</p><div className="flex flex-wrap gap-2" role="group" aria-label="식사 구분">{MEAL_TYPES.map((type) => <button key={type} type="button" aria-pressed={mealForm.meal_type === type} onClick={() => setMealForm({ ...mealForm, meal_type: type })} className={'rounded-full border px-4 py-2 text-sm transition ' + (mealForm.meal_type === type ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white' : 'ui-control')}>{type}</button>)}</div></div>
                    <label className="block max-w-48 text-sm">먹은 시각<input type="time" value={mealForm.eaten_at?.slice(0, 5) || ''} onChange={(event) => setMealForm({ ...mealForm, eaten_at: event.target.value })} className={inputClass + ' mt-1'} /></label>
                    <div className="space-y-3 border-t border-border-subtle pt-4"><h3 className="text-sm font-semibold">담은 음식 · {mealForm.items.length}개</h3>{mealForm.items.length ? mealForm.items.map((item, index) => <div key={(item.id || item.food_id) + '-' + index} className="page-list-item min-w-0 space-y-3">
                        <div className="flex items-start justify-between gap-2"><div className="min-w-0 break-words text-sm font-medium">{item.food_name}<p className="page-text-muted mt-1 text-xs">기준 {item.base_amount}{item.unit} · {item.base_kcal} kcal · 단백질 {item.base_protein_g == null ? '미기록' : item.base_protein_g + ' g'}</p></div><button type="button" className="ui-danger-text shrink-0 text-xs" onClick={() => setMealForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>빼기</button></div>
                        <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-xs">섭취량 ({item.unit})<input required type="number" min="0.001" max="999999999.999" step="0.001" value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} className={inputClass + ' mt-1'} /></label><label className="min-w-0 text-xs">열량 (kcal)<input required type="number" min="0" max="999999999.999" step="0.001" value={item.kcal} onChange={(event) => updateItem(index, { kcal: event.target.value, manual_kcal: true })} className={inputClass + ' mt-1'} /></label></div>
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="page-text-muted text-xs">섭취 단백질 {item.base_protein_g == null ? '미기록' : (item.protein_g || 0) + ' g'}</p>{item.manual_kcal && <button type="button" className="text-xs text-[var(--color-accent)]" onClick={() => updateItem(index, { manual_kcal: false })}>열량 자동 계산</button>}</div>
                    </div>) : <p className="page-text-muted text-sm">아래 음식 목록에서 담아 주세요.</p>}</div>
                    <div className="space-y-2 border-t border-border-subtle pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">음식 찾기</h3><button type="button" className="text-xs font-medium text-[var(--color-accent)]" onClick={() => { setError(''); setFoodForm({ ...emptyFood }); }}>+ 새 음식 등록</button></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="음식 이름 검색" aria-label="담을 음식 검색" className={inputClass} />
                        {foodsQuery.isPending && <p className="page-text-muted text-xs">음식을 불러오는 중...</p>}{foodsQuery.isError && <p role="alert" className="ui-danger-text text-xs">음식을 불러오지 못했습니다: {foodsQuery.error.message}</p>}
                        <div className="max-h-48 space-y-1 overflow-y-auto">{filteredFoods.map((food) => <div key={food.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{food.name}</p><p className="page-text-muted text-xs">{food.base_amount}{food.unit} · {food.base_kcal} kcal · 단백질 {food.base_protein_g == null ? '미기록' : food.base_protein_g + ' g'}</p></div><button type="button" className={buttonClass} onClick={() => addItem(food)}>담기</button></div>)}</div>
                    </div>
                    <label className="block text-sm">메모<textarea maxLength={5000} value={mealForm.note} onChange={(event) => setMealForm({ ...mealForm, note: event.target.value })} className={inputClass + ' mt-1'} rows={2} /></label>
                    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:-mx-6 sm:px-6" style={{ backgroundColor: 'var(--color-surface-elevated)' }}><div className="text-sm font-medium">{format(mealForm.items.reduce((sum, item) => sum + Number(item.kcal || 0), 0))} kcal <span className="page-text-muted text-xs">· 단백질 {mealForm.items.some((item) => item.base_protein_g != null) ? format(mealForm.items.reduce((sum, item) => sum + Number(item.protein_g || 0), 0)) + ' g' : '미기록'}</span></div><div className="flex gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => setMealForm(null)}>취소</button><button type="submit" className="ui-btn-success rounded-lg border px-4 py-2 text-sm" disabled={busy}>{busy ? '저장 중...' : '식사 저장'}</button></div></div>
                </form> : <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2"><p className="page-text-muted text-sm">{date} · {meals.length}건 · {format(totalKcal)} kcal</p><button type="button" className="ui-btn-success rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => { setError(''); setMealForm({ request_key: crypto.randomUUID(), meal_date: date, meal_type: '아침', eaten_at: '', note: '', items: [] }); }}>+ 식사 기록</button></div>
                    {mealsQuery.isPending && <p className="page-text-muted text-sm">식사를 불러오는 중...</p>}{mealsQuery.isError && <p role="alert" className="ui-danger-text text-sm">식사를 불러오지 못했습니다: {mealsQuery.error.message}</p>}
                    {meals.map((meal) => <div key={meal.id} className="page-list-item min-w-0 space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">{meal.meal_type} <span className="page-text-muted text-xs">{meal.eaten_at?.slice(0, 5)}</span></h3><p className="page-text-muted mt-1 text-xs">{format((meal.care_meal_items || []).reduce((sum, item) => sum + Number(item.kcal), 0))} kcal</p></div><div className="flex gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => { setError(''); setMealForm({ ...meal, items: [...(meal.care_meal_items || [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => ({ ...item, amount: String(item.amount), kcal: String(item.kcal) })) }); }}>수정</button><button type="button" className={buttonClass} disabled={busy} onClick={() => { if (window.confirm('이 식사 기록을 삭제할까요?')) run(async () => { await deleteCareMeal(userId, meal.id); await Promise.all([queryClient.invalidateQueries({ queryKey: ['care-period', userId] }), queryClient.invalidateQueries({ queryKey: ['care-history', userId] })]); }, ['care-meals', userId, date]); }}>삭제</button></div></div><div className="space-y-1 border-t border-border-subtle pt-3">{[...(meal.care_meal_items || [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => <p key={item.id} className="page-text-muted break-words text-sm">{item.food_name} {item.amount}{item.unit} · {item.kcal} kcal · 단백질 {item.protein_g == null ? '미기록' : item.protein_g + ' g'}</p>)}</div>{meal.note && <p className="page-text-muted whitespace-pre-wrap break-words text-sm">{meal.note}</p>}</div>)}
                    {mealsQuery.isSuccess && !meals.length && <p className="page-text-muted py-8 text-center text-sm">이 날짜의 식사 기록이 없습니다.</p>}
                </div> : ['body', 'workout', 'energy'].includes(activePanel) ? <CareDailyRecords key={activePanel + date} userId={userId} date={date} section={activePanel} onDateChange={(nextDate) => setDate(nextDate)} /> : activePanel === 'routine' ? <CareRoutineSection key={date} userId={userId} date={date} /> : <CareAnalysis userId={userId} date={date} />}
            </CareDetailDialog>}
        </main>
    );
}
