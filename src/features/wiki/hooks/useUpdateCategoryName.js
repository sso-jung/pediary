// src/features/wiki/hooks/useUpdateCategoryName.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { updateCategoryName } from '../../../lib/wikiApi';

export function useUpdateCategoryName() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: async ({ categoryId, name }) => {
            if (!user) throw new Error('로그인이 필요해.');
            return updateCategoryName({
                userId: user.id,
                categoryId,
                name,
            });
        },
        onSuccess: () => {
            // 카테고리 목록 다시 가져오기
            queryClient.invalidateQueries(['categories']);
        },
    });
}
