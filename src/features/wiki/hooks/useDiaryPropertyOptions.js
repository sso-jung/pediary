import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';

const QUERY_KEY = ['diary_property_options'];

export function useDiaryPropertyOptions() {
    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('diary_property_options')
                .select('*')
                .order('property_id', { ascending: true })
                .order('sort_order', { ascending: true })
                .order('id', { ascending: true });

            if (error) throw error;
            return data || [];
        },
    });
}

export function useCreateDiaryPropertyOption() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
                               propertyId,
                               name,
                               color = '#e5e7eb',
                               textColor = '#374151',
                               sortOrder = 0,
                           }) => {
            const { data, error } = await supabase
                .from('diary_property_options')
                .insert({
                    property_id: propertyId,
                    name,
                    color,
                    text_color: textColor,
                    sort_order: sortOrder,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diary_property_options'] });
        },
    });
}

export function useUpdateDiaryPropertyOption() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ optionId, name, color, textColor, sortOrder }) => {
            const payload = {
                updated_at: new Date().toISOString(),
            };

            if (name !== undefined) payload.name = name;
            if (color !== undefined) payload.color = color;
            if (textColor !== undefined) payload.text_color = textColor;
            if (sortOrder !== undefined) payload.sort_order = sortOrder;

            const { data, error } = await supabase
                .from('diary_property_options')
                .update(payload)
                .eq('id', optionId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diary_property_options'] });
        },
    });
}

export function useDeleteDiaryPropertyOption() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ optionId }) => {
            const { error } = await supabase
                .from('diary_property_options')
                .delete()
                .eq('id', optionId);

            if (error) throw error;
            return optionId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
}