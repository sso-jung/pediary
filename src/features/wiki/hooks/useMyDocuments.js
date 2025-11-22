// src/features/wiki/hooks/useMyDocuments.js
import { useQuery } from '@tanstack/react-query';
import { fetchMyDocuments } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useMyDocuments() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['myDocuments', user?.id],
        queryFn: () => fetchMyDocuments(user.id),
        enabled: !!user,
    });
}