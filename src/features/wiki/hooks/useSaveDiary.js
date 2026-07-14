import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertDiary } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useSaveDiary() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ diaryDate, title, contentMarkdown, propertyValues }) =>
            upsertDiary({ userId, diaryDate, title, contentMarkdown, propertyValues }),
        onSuccess: (diary) => {
            queryClient.invalidateQueries({ queryKey: ['diary', userId, diary?.diary_date] });
            queryClient.invalidateQueries({ queryKey: ['diaryPropertyValues', userId, diary?.diary_date] });
            queryClient.invalidateQueries({ queryKey: ['diaryPropertyValuesByPropertyIds', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaries', userId] });
        },
    });
}
