import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchDiariesByDateRange } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiariesByDateRange(startDate, endDate, enabled = true, propertyIds = null) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const propertyIdKey = Array.isArray(propertyIds) ? propertyIds.join(',') : 'all';

    return useQuery({
        queryKey: ['diaries', userId, startDate, endDate, propertyIdKey],
        queryFn: () => fetchDiariesByDateRange({ userId, startDate, endDate, propertyIds }),
        enabled: enabled && !!userId && !!startDate && !!endDate,
        staleTime: 1000 * 60,
        placeholderData: keepPreviousData,
    });
}
