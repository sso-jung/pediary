import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHolidaysByYear, syncHolidaysByYear } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

const syncedYears = new Set();

export function useHolidays(year) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['holidays', year],
        queryFn: () => fetchHolidaysByYear(year),
        enabled: !!userId && !!year,
        staleTime: 1000 * 60 * 60 * 24,
        retry: 1,
    });

    useEffect(() => {
        if (!userId || !year) return;
        if (query.isLoading || query.isFetching) return;
        if (query.error) return;
        if ((query.data || []).length > 0) return;
        if (syncedYears.has(year)) return;

        syncedYears.add(year);

        syncHolidaysByYear(year)
            .then(() => {
                queryClient.invalidateQueries({ queryKey: ['holidays', year] });
            })
            .catch((e) => {
                console.error(e);
            });
    }, [query.data, query.error, query.isFetching, query.isLoading, queryClient, userId, year]);

    return query;
}
