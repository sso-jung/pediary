import { useQuery } from '@tanstack/react-query';
import { fetchDailyActivity } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDailyActivity(dateStr) {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['activity', 'daily', user?.id, dateStr],
        queryFn: () => fetchDailyActivity(user.id, dateStr),
        enabled: !!user && !!dateStr, // 날짜 선택될 때만 실행
    });
}
