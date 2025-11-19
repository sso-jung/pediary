// src/features/wiki/hooks/useCreateCategory.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useCreateCategory() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, parentId = null }) =>
      createCategory({ userId: user.id, name, parentId }),
    onSuccess: () => {
      // 카테고리 목록 다시 가져오기
      queryClient.invalidateQueries(['categories', user.id]);
    },
  });
}
