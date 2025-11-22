// src/features/wiki/hooks/useVisibleDocuments.js
import { useQuery } from '@tanstack/react-query';
import { fetchVisibleDocuments } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useVisibleDocuments() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['visibleDocuments', user?.id],
        queryFn: () => fetchVisibleDocuments(user.id),
        enabled: !!user,
    });
}
