// src/features/wiki/hooks/useDeleteCategory.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { softDeleteCategoryAndDocuments } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDeleteCategory() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: async ({ categoryId }) => {
            if (!user) throw new Error('로그인이 필요해.');
            await softDeleteCategoryAndDocuments({
                userId: user.id,
                categoryId,
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
