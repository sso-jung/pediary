import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createDiaryProperty,
    createDiaryPropertySection,
    deleteDiaryProperty,
    deleteDiaryPropertySection,
    fetchDiaryProperties,
    fetchDiaryPropertySections,
    updateDiaryPropertySection,
    updateDiaryPropertySectionOrder,
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
        mutationFn: ({ name, type, icon, sectionId, config, defaultValue }) =>
            createDiaryProperty({ userId, name, type, icon, sectionId, config, defaultValue }),
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
        mutationFn: ({ propertyId, name, type, icon, sectionId }) =>
            updateDiaryProperty({ userId, propertyId, name, type, icon, sectionId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryProperties', userId] });
        },
    });
}

export function useDiaryPropertySections() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryPropertySections', userId],
        queryFn: () => fetchDiaryPropertySections(userId),
        enabled: !!userId,
    });
}

export function useCreateDiaryPropertySection() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ name, parentSectionId }) =>
            createDiaryPropertySection({ userId, name, parentSectionId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryPropertySections', userId] });
        },
    });
}

export function useUpdateDiaryPropertySection() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sectionId, name, parentSectionId, collapsed }) =>
            updateDiaryPropertySection({
                userId,
                sectionId,
                name,
                parentSectionId,
                collapsed,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryPropertySections', userId] });
        },
    });
}

export function useDeleteDiaryPropertySection() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sectionId }) =>
            deleteDiaryPropertySection({ userId, sectionId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryPropertySections', userId] });
            queryClient.invalidateQueries({ queryKey: ['diaryProperties', userId] });
        },
    });
}

export function useUpdateDiaryPropertySectionOrder() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sections }) =>
            updateDiaryPropertySectionOrder({ userId, sections }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaryPropertySections', userId] });
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
