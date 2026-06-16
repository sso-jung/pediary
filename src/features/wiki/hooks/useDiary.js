import { useQuery } from '@tanstack/react-query';
import { fetchDiaryByDate } from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiary(diaryDate) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diary', userId, diaryDate],
        queryFn: () => fetchDiaryByDate({ userId, diaryDate }),
        enabled: !!userId && !!diaryDate,
        staleTime: 1000 * 60,
    });
}
