// src/features/wiki/hooks/useAiRecentActivity.js
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { fetchDailyActivity } from '../../../lib/wikiApi';

function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function useAiRecentActivity() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['aiRecentActivity', user?.id],
        enabled: !!user,
        queryFn: async () => {
            if (!user) return [];

            const now = new Date();
            const todayStr = formatDate(now);

            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yesterdayStr = formatDate(yesterday);

            const [today, yday] = await Promise.all([
                fetchDailyActivity(user.id, todayStr),
                fetchDailyActivity(user.id, yesterdayStr),
            ]);

            const merged = [...(today || []), ...(yday || [])];

            // 최신순 정렬 (created_at DESC)
            merged.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            );

            return merged;
        },
    });
}
