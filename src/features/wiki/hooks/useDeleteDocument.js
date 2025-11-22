// src/features/wiki/hooks/useDeleteDocument.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { softDeleteDocument } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDeleteDocument() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: ({ documentId }) =>
            softDeleteDocument({ documentId, userId: user.id }),
        onSuccess: (_data, variables) => {
            // 문서 관련 캐시들 무효화
            queryClient.invalidateQueries({ queryKey: ['visibleDocuments'] });
            queryClient.invalidateQueries({
                queryKey: ['document', user?.id, variables?.slug],
            });
            queryClient.invalidateQueries({ queryKey: ['allDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['myDocuments'] });
        },
    });
}
