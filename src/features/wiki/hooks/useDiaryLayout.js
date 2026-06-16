import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDiaryLayout, updateDiaryLayout } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiaryLayout() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryLayout', userId],
        queryFn: () => fetchDiaryLayout(userId),
        enabled: !!userId,
    });
}

export function useUpdateDiaryLayout() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ items }) => updateDiaryLayout({ userId, items }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryLayout', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaryProperties', userId] });
        },
    });
}
