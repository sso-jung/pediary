import { useQuery } from '@tanstack/react-query';
import { fetchDiaryPropertyValues } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiaryPropertyValues(diaryDate) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryPropertyValues', userId, diaryDate],
        queryFn: () => fetchDiaryPropertyValues({ userId, diaryDate }),
        enabled: !!userId && !!diaryDate,
    });
}
