// src/features/wiki/hooks/useRestoreDocument.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreDocument } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useRestoreDocument() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: ({ documentId }) =>
            restoreDocument({ documentId, userId: user.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deletedDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['visibleDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['myDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['allDocuments'] });
        },
    });
}
