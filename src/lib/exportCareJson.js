import { saveAs } from 'file-saver';
import { supabase } from './supabaseClient';

const tables = [
    'care_foods', 'care_meals', 'care_meal_items', 'care_measurements',
    'care_workouts', 'care_daily_energy', 'care_routines',
    'care_routine_versions', 'care_routine_days',
];

export async function downloadCareJson(userId) {
    const data = {};
    for (const table of tables) {
        const key = table === 'care_daily_energy' ? 'energy_date' : 'id';
        const rows = [];
        let last = null;
        while (true) {
            let query = supabase.from(table).select('*').eq('user_id', userId).order(key).limit(500);
            if (last !== null) query = query.gt(key, last);
            const { data: page, error } = await query;
            if (error) {
                if (['care_routines', 'care_routine_versions', 'care_routine_days'].includes(table) && ['42P01', 'PGRST205'].includes(error.code)) {
                    throw new Error('루틴 테이블이 없습니다. 202611160003_create_care_routines.sql을 적용해 주세요.');
                }
                throw new Error(`${table} 내보내기 실패: ${error.message}`);
            }
            rows.push(...page);
            if (page.length < 500) break;
            last = page.at(-1)[key];
        }
        data[table] = rows;
    }

    const exportedAt = new Date().toISOString();
    const backup = { format: 'pediary-care', format_version: 1, exported_at: exportedAt, user_id: userId, tables: data };
    saveAs(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }), `pediary-care-${exportedAt.slice(0, 10)}.json`);
}
