import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchDiaryViewLayout,
    fetchDiaryViewSetting,
    fetchDiaryViewSettings,
    updateDiaryViewLayout,
    updateDiaryViewSetting,
    updateDiaryViewTab,
    updateDiaryViewTabOrder,
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

export function useDiaryViewSettings() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryViewSettings', userId],
        queryFn: () => fetchDiaryViewSettings({ userId }),
        enabled: !!userId,
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
            queryClient.invalidateQueries({ queryKey: ['diaryViewSettings', userId] });
        },
    });
}

export function useUpdateDiaryViewTab() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ viewType, changes }) => updateDiaryViewTab({ userId, viewType, changes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryViewSettings', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaryViewSetting', userId] });
        },
    });
}

export function useUpdateDiaryViewTabOrder() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tabs, mobile }) => updateDiaryViewTabOrder({ userId, tabs, mobile }),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryViewSettings', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaryViewSetting', userId] });
        },
    });
}
