// src/features/wiki/hooks/useUpdateDocument.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDocument, logDocumentActivity } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useUpdateDocument(documentId, slug) {
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ title, contentMarkdown, visibility, categoryId }) =>
            updateDocument({
                userId: user.id,
                documentId,
                title,
                contentMarkdown,
                visibility,
                categoryId,
            }),
        onSuccess: (updatedDoc) => {
            queryClient.invalidateQueries(['document', user.id, slug]);
            queryClient.invalidateQueries([
                'documents',
                user.id,
                updatedDoc.category_id,
            ]);

            // 수정 로그 남기기
            if (updatedDoc?.id) {
                logDocumentActivity({
                    userId: user.id,
                    documentId: updatedDoc.id,
                    action: 'updated',
                });
            }
        },
    });
}
