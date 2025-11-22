// src/features/wiki/hooks/useHardDeleteDocument.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hardDeleteDocument } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useHardDeleteDocument() {
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: ({ documentId }) =>
            hardDeleteDocument({ documentId, userId: user.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deletedDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['visibleDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['myDocuments'] });
            queryClient.invalidateQueries({ queryKey: ['allDocuments'] });
        },
    });
}
