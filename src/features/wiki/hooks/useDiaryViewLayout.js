import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchDiaryViewLayout,
    fetchDiaryViewSetting,
    updateDiaryViewLayout,
    updateDiaryViewSetting,
} from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiaryViewLayout(viewType) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryViewLayout', userId, viewType],
        queryFn: () => fetchDiaryViewLayout({ userId, viewType }),
        enabled: !!userId && !!viewType,
    });
}

export function useDiaryViewSetting(viewType) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryViewSetting', userId, viewType],
        queryFn: () => fetchDiaryViewSetting({ userId, viewType }),
        enabled: !!userId && !!viewType,
    });
}

export function useUpdateDiaryViewLayout(viewType) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ items }) => updateDiaryViewLayout({ userId, viewType, items }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryViewLayout', userId, viewType] });
        },
    });
}

export function useUpdateDiaryViewSetting(viewType) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ showTitle }) => updateDiaryViewSetting({ userId, viewType, showTitle }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryViewSetting', userId, viewType] });
        },
    });
}
