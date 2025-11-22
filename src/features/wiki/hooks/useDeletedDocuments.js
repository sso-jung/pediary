// src/features/wiki/hooks/useDeletedDocuments.js
import { useQuery } from '@tanstack/react-query';
import { fetchDeletedDocuments } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDeletedDocuments() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['deletedDocuments', user?.id],
        queryFn: () => fetchDeletedDocuments(user.id),
        enabled: !!user,
    });
}
