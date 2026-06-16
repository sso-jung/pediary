import { useQuery } from '@tanstack/react-query';
import { fetchDiariesByDateRange } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiariesByDateRange(startDate, endDate, enabled = true) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaries', userId, startDate, endDate],
        queryFn: () => fetchDiariesByDateRange({ userId, startDate, endDate }),
        enabled: enabled && !!userId && !!startDate && !!endDate,
        staleTime: 1000 * 60,
    });
}
