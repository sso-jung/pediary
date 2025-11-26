// src/features/wiki/hooks/useMoveCategory.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moveCategory } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useMoveCategory() {
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ categoryId, parentId, beforeCategoryId = null }) => {
            if (!user) throw new Error('로그인이 필요해.');

            return moveCategory({
                userId: user.id,
                categoryId,
                parentId,
                beforeCategoryId,
            });
        },
        onSuccess: () => {
            if (!user) return;
            queryClient.invalidateQueries(['categories', user.id]);
        },
    });
}
