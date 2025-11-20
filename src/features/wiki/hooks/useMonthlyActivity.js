// src/features/wiki/hooks/useMonthlyActivity.js
import { useQuery } from '@tanstack/react-query';
import { fetchMonthlyActivity } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useMonthlyActivity(year, month) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['monthlyActivity', userId, year, month],
        queryFn: () => fetchMonthlyActivity(userId, year, month),
        enabled: !!userId && !!year && !!month,
    });
}
