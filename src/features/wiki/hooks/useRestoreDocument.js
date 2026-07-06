// src/features/wiki/hooks/useRestoreDocument.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreDocumentWithCategoryHandling } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useRestoreDocument() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: async ({ documentId }) => {
            if (!user) throw new Error('로그인이 필요해.');
            return restoreDocumentWithCategoryHandling({
                documentId,
                userId: user.id,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['visibleDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['allDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['myDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['deletedDocuments'] });
        },
    });
}
