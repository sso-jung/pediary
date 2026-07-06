// src/features/wiki/hooks/useUpdateDocumentCategory.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDocumentCategory } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useUpdateDocumentCategory() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: async ({ documentId, categoryId }) => {
            if (!user) throw new Error('로그인이 필요해.');
            return updateDocumentCategory({
                userId: user.id,
                documentId,
                categoryId,
            });
        },
        onSuccess: (updatedDoc) => {
            queryClient.invalidateQueries({ queryKey: ['document'] });
            queryClient.invalidateQueries({ queryKey: ['visibleDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['allDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['myDocuments'] });
            queryClient.invalidateQueries({
                queryKey: ['documents', user?.id, updatedDoc?.category_id],
            });
        },
    });
}
