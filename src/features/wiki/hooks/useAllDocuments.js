import { useQuery } from '@tanstack/react-query';
import { fetchAllDocuments } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useAllDocuments(enabled = true) {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['allDocuments', user?.id],
        queryFn: () => fetchAllDocuments(user.id),
        enabled: enabled && !!user,
    });
}
