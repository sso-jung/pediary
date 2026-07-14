import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteDiary } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDeleteDiary() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ diaryDate }) => deleteDiary({ userId, diaryDate }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['diary', userId, variables?.diaryDate] });
            queryClient.invalidateQueries({ queryKey: ['diaryPropertyValues', userId, variables?.diaryDate] });
            queryClient.invalidateQueries({ queryKey: ['diaryPropertyValuesByPropertyIds', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaries', userId] });
        },
    });
}
