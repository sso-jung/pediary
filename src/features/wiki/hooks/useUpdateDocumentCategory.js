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
        onSuccess: () => {
            // 귀찮으니 일단 전체 invalidate (규모 크면 나중에 세분화)
            queryClient.invalidateQueries();
        },
    });
}
