import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createDiaryProperty,
    deleteDiaryProperty,
    fetchDiaryProperties,
    updateDiaryProperty,
} from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiaryProperties() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryProperties', userId],
        queryFn: () => fetchDiaryProperties(userId),
        enabled: !!userId,
    });
}

export function useCreateDiaryProperty() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ name, type, icon, config, defaultValue }) =>
            createDiaryProperty({ userId, name, type, icon, config, defaultValue }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryProperties', userId] });
        },
    });
}

export function useUpdateDiaryProperty() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ propertyId, name, type, icon }) =>
            updateDiaryProperty({ userId, propertyId, name, type, icon }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryProperties', userId] });
        },
    });
}

export function useDeleteDiaryProperty() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ propertyId }) =>
            deleteDiaryProperty({ userId, propertyId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryProperties', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaryPropertyValues', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaries', userId] });
        },
    });
}
