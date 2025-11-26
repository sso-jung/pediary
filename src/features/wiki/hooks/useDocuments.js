// src/features/wiki/hooks/useDocuments.js
import { useQuery } from '@tanstack/react-query';
import { fetchVisibleDocumentsByCategory } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDocuments(categoryId) {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['visibleDocuments', user?.id, categoryId || 'all'],
        enabled: !!user,
        queryFn: () =>
            fetchVisibleDocumentsByCategory({
                userId: user.id,
                // "all" 같은 값은 null로 넘겨서 전체 조회
                categoryId: categoryId === 'all' ? null : categoryId,
                includeChildren: true, // 🔹 여기! 1depth 선택 시 자식까지 포함
            }),
    });
}