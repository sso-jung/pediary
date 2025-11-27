// src/features/wiki/hooks/useDocumentFavorites.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchMyDocumentFavorites,
    addDocumentFavorite,
    removeDocumentFavorite,
} from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

const FAVORITES_KEY = ['documentFavorites'];

export function useDocumentFavorites() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: FAVORITES_KEY,
        queryFn: () => fetchMyDocumentFavorites(user.id),
        enabled: !!user,
    });
}

export function useToggleFavoriteDocument() {
    const user = useAuthStore((s) => s.user);
    const qc = useQueryClient();

    return useMutation({
        mutationFn: ({ documentId, isFavorite }) => {
            if (!user) throw new Error('로그인이 필요해.');
            return isFavorite
                ? removeDocumentFavorite({ userId: user.id, documentId })
                : addDocumentFavorite({ userId: user.id, documentId });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: FAVORITES_KEY });
            // 문서 목록들 다시 불러오기
            qc.invalidateQueries({ queryKey: ['visibleDocuments'] });
            qc.invalidateQueries({ queryKey: ['documents'] });
        },
    });
}
