import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/authStore';

const QUERY_KEY = ['diaryGoals'];

export function useDiaryGoals(enabled = true) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: [QUERY_KEY[0], userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('diary_goal_sets')
                .select(`
                    *,
                    diary_goal_items (
                        id,
                        user_id,
                        goal_set_id,
                        name,
                        sort_order,
                        created_at,
                        updated_at
                    )
                `)
                .eq('user_id', userId)
                .order('property_id', { ascending: true })
                .order('start_date', { ascending: false })
                .order('sort_order', { ascending: true });

            if (error) throw error;

            return (data || []).map((goalSet) => ({
                ...goalSet,
                diary_goal_items: [...(goalSet.diary_goal_items || [])].sort(
                    (a, b) =>
                        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
                        (a.id ?? 0) - (b.id ?? 0),
                ),
            }));
        },
        enabled: enabled && !!userId,
    });
}

export function useCreateDiaryGoalSet() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ propertyId, name, startDate, endDate, sortOrder = 0 }) => {
            const { data, error } = await supabase
                .from('diary_goal_sets')
                .insert({
                    user_id: userId,
                    property_id: propertyId,
                    name,
                    start_date: startDate,
                    end_date: endDate,
                    sort_order: sortOrder,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY[0], userId] });
        },
    });
}

export function useUpdateDiaryGoalSet() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ goalSetId, name, startDate, endDate, sortOrder }) => {
            const payload = {
                updated_at: new Date().toISOString(),
            };

            if (name !== undefined) payload.name = name;
            if (startDate !== undefined) payload.start_date = startDate;
            if (endDate !== undefined) payload.end_date = endDate;
            if (sortOrder !== undefined) payload.sort_order = sortOrder;

            const { data, error } = await supabase
                .from('diary_goal_sets')
                .update(payload)
                .eq('id', goalSetId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY[0], userId] });
        },
    });
}

export function useDeleteDiaryGoalSet() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ goalSetId }) => {
            const { error } = await supabase
                .from('diary_goal_sets')
                .delete()
                .eq('id', goalSetId)
                .eq('user_id', userId);

            if (error) throw error;
            return goalSetId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY[0], userId] });
        },
    });
}

export function useCreateDiaryGoalItem() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ goalSetId, name, sortOrder = 0 }) => {
            const { data, error } = await supabase
                .from('diary_goal_items')
                .insert({
                    user_id: userId,
                    goal_set_id: goalSetId,
                    name,
                    sort_order: sortOrder,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY[0], userId] });
        },
    });
}

export function useUpdateDiaryGoalItem() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ goalItemId, name, sortOrder }) => {
            const payload = {
                updated_at: new Date().toISOString(),
            };

            if (name !== undefined) payload.name = name;
            if (sortOrder !== undefined) payload.sort_order = sortOrder;

            const { data, error } = await supabase
                .from('diary_goal_items')
                .update(payload)
                .eq('id', goalItemId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY[0], userId] });
        },
    });
}

export function useDeleteDiaryGoalItem() {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ goalItemId }) => {
            const { error } = await supabase
                .from('diary_goal_items')
                .delete()
                .eq('id', goalItemId)
                .eq('user_id', userId);

            if (error) throw error;
            return goalItemId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY[0], userId] });
        },
    });
}
