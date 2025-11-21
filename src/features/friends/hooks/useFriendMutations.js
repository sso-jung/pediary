// src/features/friends/hooks/useFriendMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    sendFriendRequest,
    acceptFriendRequest,
    deleteFriendRelation,
} from '../../../lib/wikiApi';
import {useSnackbar} from "../../../components/ui/SnackbarContext.jsx";

export function useSendFriendRequest(userId) {
    const qc = useQueryClient();
    const { showMessage } = useSnackbar();

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
            qc.invalidateQueries({ queryKey: ['incomingFriendRequests'] });
            qc.invalidateQueries({ queryKey: ['outgoingFriendRequests'] });
            showMessage('친구 요청을 보냈어요.', 'success');
        },
        onError: (err) => {
            showMessage(
                err.message || '친구 요청을 보내는 데 실패했어요.',
                'error',
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
            qc.invalidateQueries({ queryKey: ['friendRequests', userId] });
        },
    });
}

export function useDeleteFriendRelation(userId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteFriendRelation(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['friends', userId] });
            qc.invalidateQueries({ queryKey: ['friendRequests', userId] });
        },
    });
}
