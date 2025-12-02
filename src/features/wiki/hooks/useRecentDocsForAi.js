// src/features/wiki/hooks/useRecentDocsForAi.js
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { fetchMyDocuments } from '../../../lib/wikiApi';

export function useRecentDocsForAi() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['aiRecentDocs', user?.id],
        enabled: !!user,
        queryFn: async () => {
            if (!user) return [];

            const all = await fetchMyDocuments(user.id); // documents 전체 (*)
            const alive = (all || []).filter((d) => !d.deleted_at);

            const sorted = alive.sort((a, b) => {
                const aTime = new Date(a.updated_at || a.created_at).getTime();
                const bTime = new Date(b.updated_at || b.created_at).getTime();
                return bTime - aTime; // 최신순
            });

            // 🔹 AI에 넘길 형태로 변환
            return sorted.slice(0, 10).map((doc) => ({
                id: doc.id,
                title: doc.title,
                categoryId: doc.category_id ?? null,
                categoryName: null, // 필요하면 나중에 카테고리 조인해서 채워도 됨
                updatedAt: doc.updated_at || doc.created_at,
                content: doc.content_markdown || '',
            }));
        },
    });
}
