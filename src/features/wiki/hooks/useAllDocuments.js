import { useQuery } from '@tanstack/react-query';
import { fetchAllDocuments } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useAllDocuments() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['documents', 'all', user?.id],
        queryFn: () => fetchAllDocuments(user.id),
        enabled: !!user,
    });
}
