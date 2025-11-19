// src/features/wiki/hooks/useDocuments.js
import { useQuery } from '@tanstack/react-query';
import { fetchDocumentsByCategory } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDocuments(categoryId) {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['documents', user?.id, categoryId],
        queryFn: () => fetchDocumentsByCategory({ userId: user.id, categoryId }),
        enabled: !!user && !!categoryId,
    });
}
