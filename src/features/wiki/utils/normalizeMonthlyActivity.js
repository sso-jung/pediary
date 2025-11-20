// src/features/wiki/utils/normalizeMonthlyActivity.js
const ACTION_PRIORITY = {
    viewed: 1,
    updated: 2,
    created: 3,
};

/**
 * monthlyActivity: fetchMonthlyActivity 결과
 * [
 *   { action: 'viewed'|'updated'|'created', created_at, documents: { id, title, slug } }
 * ]
 *
 * 반환 형태:
 * {
 *   '2025-11-19': [
 *      { docId, title, slug, action }, // 문서당 최대 1개 (우선순위: 작성 > 수정 > 열람)
 *   ],
 *   '2025-11-20': [...],
 * }
 */
export function normalizeMonthlyActivity(monthlyActivity = []) {
    const byDate = {};

    for (const item of monthlyActivity) {
        const dateKey = item.created_at.slice(0, 10); // 'YYYY-MM-DD'
        const doc = item.documents;
        if (!doc) continue;

        const docId = doc.id;
        if (!docId) continue;

        if (!byDate[dateKey]) {
            byDate[dateKey] = {};
        }

        const prev = byDate[dateKey][docId];
        const currentPriority = ACTION_PRIORITY[item.action] || 0;
        const prevPriority = prev ? ACTION_PRIORITY[prev.action] || 0 : 0;

        // 같은 날짜 + 같은 문서가 여러 번 있을 경우
        // 작성(created) > 수정(updated) > 열람(viewed) 우선순위로 하나만 남긴다
        if (!prev || currentPriority > prevPriority) {
            byDate[dateKey][docId] = {
                docId,
                title: doc.title || '제목 없음',
                slug: doc.slug,
                action: item.action,
            };
        }
    }

    // 최종적으로 날짜별 배열로 변환
    const result = {};
    Object.keys(byDate).forEach((dateKey) => {
        result[dateKey] = Object.values(byDate[dateKey]);
    });

    return result;
}
