import { useQuery } from '@tanstack/react-query';
import { fetchRecentActivity } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useRecentActivity(limit = 20) {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['activity', user?.id, limit],
        queryFn: () => fetchRecentActivity({ userId: user.id, limit }),
        enabled: !!user,
    });
}
