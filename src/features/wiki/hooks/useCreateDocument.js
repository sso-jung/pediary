// src/features/wiki/hooks/useCreateDocument.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDocument, logDocumentActivity } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useCreateDocument(categoryId) {
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ title }) =>
            createDocument({ userId: user.id, categoryId, title }),
        onSuccess: async (newDoc) => {
            queryClient.invalidateQueries(['documents', user.id, categoryId]);

            // 작성 로그 남기기
            if (newDoc?.id) {
                logDocumentActivity({
                    userId: user.id,
                    documentId: newDoc.id,
                    action: 'created',
                });
            }

            return newDoc;
        },
    });
}
