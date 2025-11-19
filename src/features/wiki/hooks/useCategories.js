// src/features/wiki/hooks/useCategories.js
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useCategories() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['categories', user?.id],
        queryFn: () => fetchCategories(user.id),
        enabled: !!user,
    });
}
