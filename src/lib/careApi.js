import { supabase } from './supabaseClient';

function result({ data, error }) {
    if (error) throw error;
    return data;
}

export async function fetchCareFoods(userId) {
    return result(await supabase.from('care_foods').select('*').eq('user_id', userId).eq('archived', false).order('name'));
}

export async function saveCareFood(userId, food) {
    const values = {
        user_id: userId,
        name: food.name.trim(),
        base_amount: Number(food.base_amount),
        unit: food.unit,
        base_kcal: Number(food.base_kcal),
        base_protein_g: food.base_protein_g === '' || food.base_protein_g == null ? null : Number(food.base_protein_g),
        updated_at: new Date().toISOString(),
    };
    const response = food.id
        ? await supabase.from('care_foods').update(values).eq('id', food.id).eq('user_id', userId).select().single()
        : await supabase.from('care_foods').insert(values).select().single();
    if (['PGRST204', '42703'].includes(response.error?.code) && response.error.message.includes('base_protein_g')) {
        throw new Error('단백질 저장을 위해 202611160004_add_care_protein.sql을 적용해 주세요.');
    }
    return result(response);
}

export async function archiveCareFood(userId, id) {
    return result(await supabase.from('care_foods').update({ archived: true }).eq('id', id).eq('user_id', userId).select().single());
}

export async function setCareFoodFavorite(userId, id, isFavorite) {
    return result(await supabase.from('care_foods').update({ is_favorite: isFavorite }).eq('id', id).eq('user_id', userId).select().single());
}

export async function fetchCareMeals(userId, date) {
    return result(await supabase.from('care_meals').select('*, care_meal_items (*)')
        .eq('user_id', userId).eq('meal_date', date).order('eaten_at', { nullsFirst: false }));
}

async function fetchCareRange(userId, table, dateColumn, start, end, columns = '*') {
    const rows = [];
    for (let last = null; ;) {
        let query = supabase.from(table).select(columns).eq('user_id', userId)
            .gte(dateColumn, start).lte(dateColumn, end).order('id').limit(500);
        if (last != null) query = query.gt('id', last);
        const page = result(await query);
        rows.push(...page);
        if (page.length < 500) return rows;
        last = page.at(-1).id;
    }
}

export async function fetchCareMealsRange(userId, start, end) {
    return fetchCareRange(userId, 'care_meals', 'meal_date', start, end, '*, care_meal_items (*)');
}

export async function fetchCareMeasurementsRange(userId, start, end) {
    return fetchCareRange(userId, 'care_measurements', 'measurement_date', start, end);
}

export async function fetchCareWorkoutsRange(userId, start, end) {
    return fetchCareRange(userId, 'care_workouts', 'workout_date', start, end);
}

export async function saveCareMeal(meal) {
    return result(await supabase.rpc('save_care_meal', {
        p_id: meal.id || null,
        p_request_key: meal.request_key || null,
        p_expected_updated_at: meal.id ? meal.updated_at : null,
        p_date: meal.meal_date,
        p_type: meal.meal_type,
        p_eaten_at: meal.eaten_at || null,
        p_note: meal.note || '',
        p_items: meal.items,
    }));
}

export async function deleteCareMeal(userId, id) {
    return result(await supabase.from('care_meals').delete().eq('id', id).eq('user_id', userId).select().single());
}

export async function fetchCareMeasurements(userId, date) {
    return result(await supabase.from('care_measurements').select('*')
        .eq('user_id', userId).eq('measurement_date', date).order('measured_at'));
}

export async function fetchLatestCareMeasurement(userId, date) {
    return result(await supabase.from('care_measurements').select('*').eq('user_id', userId)
        .lte('measurement_date', date).order('measurement_date', { ascending: false })
        .order('measured_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle());
}

export async function fetchCareMeasurementChart(userId, metric, start, end) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
        const page = result(await supabase.from('care_measurements').select(`id, measurement_date, measured_at, ${metric}`)
            .eq('user_id', userId).gte('measurement_date', start).lte('measurement_date', end)
            .not(metric, 'is', null).order('measurement_date').order('measured_at').order('id')
            .range(offset, offset + 499));
        rows.push(...page);
        if (page.length < 500) return rows;
    }
}

export async function saveCareMeasurement(userId, measurement) {
    const values = {
        user_id: userId, measurement_date: measurement.measurement_date,
        measured_at: measurement.measured_at,
        weight_kg: measurement.weight_kg === '' ? null : Number(measurement.weight_kg),
        body_fat_kg: measurement.body_fat_kg === '' ? null : Number(measurement.body_fat_kg),
        muscle_kg: measurement.muscle_kg === '' ? null : Number(measurement.muscle_kg),
        body_water_kg: measurement.body_water_kg === '' ? null : Number(measurement.body_water_kg),
        updated_at: new Date().toISOString(),
    };
    if (measurement.id) return result(await supabase.from('care_measurements').update(values).eq('id', measurement.id).eq('user_id', userId).select().single());
    return result(await supabase.from('care_measurements').insert(values).select().single());
}

export async function deleteCareMeasurement(userId, id) {
    return result(await supabase.from('care_measurements').delete().eq('id', id).eq('user_id', userId).select().single());
}

export async function fetchCareWorkouts(userId, date) {
    return result(await supabase.from('care_workouts').select('*')
        .eq('user_id', userId).eq('workout_date', date).order('started_at', { nullsFirst: false }));
}

export async function saveCareWorkout(userId, workout) {
    const values = {
        user_id: userId, workout_date: workout.workout_date, name: workout.name.trim(),
        started_at: workout.started_at || null,
        duration_minutes: workout.duration_minutes === '' ? null : Number(workout.duration_minutes),
        kcal: workout.kcal === '' ? null : Number(workout.kcal),
        note: workout.note,
        updated_at: new Date().toISOString(),
    };
    if (workout.id) return result(await supabase.from('care_workouts').update(values).eq('id', workout.id).eq('user_id', userId).select().single());
    return result(await supabase.from('care_workouts').insert(values).select().single());
}

export async function deleteCareWorkout(userId, id) {
    return result(await supabase.from('care_workouts').delete().eq('id', id).eq('user_id', userId).select().single());
}

export async function fetchCareDailyEnergy(userId, date) {
    return result(await supabase.from('care_daily_energy').select('*')
        .eq('user_id', userId).eq('energy_date', date).maybeSingle());
}

export async function saveCareDailyEnergy(userId, date, energy) {
    return result(await supabase.from('care_daily_energy').upsert({
        user_id: userId, energy_date: date,
        active_kcal: energy.active_kcal === '' ? null : Number(energy.active_kcal),
        total_kcal: energy.total_kcal === '' ? null : Number(energy.total_kcal),
        intake_confirmed: energy.intake_confirmed,
        updated_at: new Date().toISOString(),
    }).select().single());
}

export async function fetchCarePeriodSummary(start, end) {
    return result(await supabase.rpc('care_period_summary', { p_start: start, p_end: end }));
}

export async function fetchCareRoutineDay(date) {
    return result(await supabase.rpc('list_care_routine_day', { p_date: date }));
}

export async function fetchCareRoutineRange(start, endExclusive) {
    return result(await supabase.rpc('list_care_routine_range', { p_start: start, p_end_exclusive: endExclusive }));
}

export async function fetchCareRoutineSettings(date) {
    return result(await supabase.rpc('list_care_routine_settings', { p_date: date }));
}

export async function saveCareRoutine(routine, date) {
    return result(await supabase.rpc('save_care_routine', {
        p_id: routine.routine_id || null,
        p_revision: routine.revision || null,
        p_date: date,
        p_name: routine.name,
        p_repeat_type: routine.repeat_type,
        p_weekdays: ['weekdays', 'odd_week', 'even_week'].includes(routine.repeat_type) ? routine.weekdays : null,
        p_interval_days: routine.repeat_type === 'interval' ? Number(routine.interval_days) : null,
        p_month_day: routine.repeat_type === 'monthly' ? Number(routine.month_day) : null,
    }));
}

export async function patchCareRoutineDay(routineId, date, action, name = null) {
    return result(await supabase.rpc('patch_care_routine_day', {
        p_routine_id: routineId, p_date: date, p_action: action, p_name: name,
    }));
}

export async function saveCareOneoff(userId, date, day) {
    const values = { user_id: userId, routine_date: date, oneoff_name: day.oneoff_name.trim(), updated_at: new Date().toISOString() };
    if (day.id) return result(await supabase.from('care_routine_days').update(values).eq('id', day.id).eq('user_id', userId).is('routine_id', null).select().single());
    return result(await supabase.from('care_routine_days').insert(values).select().single());
}

export async function setCareOneoffStatus(userId, id, status) {
    return result(await supabase.from('care_routine_days').update({ status, updated_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', userId).is('routine_id', null).select().single());
}

export async function deleteCareOneoff(userId, id) {
    return result(await supabase.from('care_routine_days').delete().eq('id', id)
        .eq('user_id', userId).is('routine_id', null).select().single());
}
