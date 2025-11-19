// src/features/wiki/hooks/useDocument.js
import { useQuery } from '@tanstack/react-query';
import { fetchDocumentBySlug } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDocument(slug) {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['document', user?.id, slug],
        queryFn: () => fetchDocumentBySlug({ userId: user.id, slug }),
        enabled: !!user && !!slug,
    });
}
