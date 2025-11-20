import { useQuery } from '@tanstack/react-query';
import { fetchTodayActivity } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useTodayActivity() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['activity', 'today', user?.id],
        queryFn: () => fetchTodayActivity(user.id),
        enabled: !!user,
    });
}