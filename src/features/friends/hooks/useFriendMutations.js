// src/features/friends/hooks/useFriendMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    acceptFriendRequest,
    deleteFriendRelation,
} from '../../../lib/wikiApi';
import { supabase } from '../../../lib/supabaseClient';
import { useSnackbar } from '../../../components/ui/SnackbarContext.jsx';

export function useSendFriendRequest(userId) {
    const qc = useQueryClient();
    const { showSnackbar } = useSnackbar();

    return useMutation({
        mutationFn: async ({ friendId }) => {
            const { data, error } = await supabase
                .from('friends')
                .insert({
                    user_id: userId,
                    friend_id: friendId,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            // ✅ 위에서 정의한 queryKey와 정확히 일치
            qc.invalidateQueries({ queryKey: ['incomingFriendRequests', userId] });
            qc.invalidateQueries({ queryKey: ['outgoingFriendRequests', userId] });

            showSnackbar('친구 요청을 보냈어요.');
        },
        onError: (err) => {
            showSnackbar(
                err.message || '친구 요청을 보내는 데 실패했어요.',
            );
        },
    });
}

export function useAcceptFriendRequest(userId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (requestId) => acceptFriendRequest(requestId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['friends', userId] });
            qc.invalidateQueries({ queryKey: ['incomingFriendRequests', userId] });
            qc.invalidateQueries({ queryKey: ['outgoingFriendRequests', userId] });
        },
    });
}

export function useDeleteFriendRelation(userId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteFriendRelation(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['friends', userId] });
            qc.invalidateQueries({ queryKey: ['incomingFriendRequests', userId] });
            qc.invalidateQueries({ queryKey: ['outgoingFriendRequests', userId] });
        },
    });
}
