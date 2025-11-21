// src/features/friends/hooks/useFriends.js
import { useQuery } from '@tanstack/react-query';
import {
    fetchFriends,
    fetchIncomingFriendRequests,
    searchProfiles,
} from '../../../lib/wikiApi';
import {supabase} from "../../../lib/supabaseClient.js";

export function useFriends(userId) {
    return useQuery({
        queryKey: ['friends', userId],
        queryFn: () => fetchFriends(userId),
        enabled: !!userId,
    });
}

export function useIncomingFriendRequests(userId) {
    return useQuery({
        queryKey: ['incomingFriendRequests', userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('friends')
                .select(
                    `
                    id,
                    user_id,
                    status,
                    created_at,
                    requester_profile:profiles!friends_user_id_fkey ( id, email, nickname )
                `,
                )
                .eq('friend_id', userId)
                .eq('status', 'pending');

            if (error) throw error;
            return data ?? [];
        },
    });
}

export function useProfileSearch(keyword) {
    return useQuery({
        queryKey: ['profileSearch', keyword],
        queryFn: () => searchProfiles(keyword),
        enabled: !!keyword,
    });
}

export function useOutgoingFriendRequests(userId) {
    return useQuery({
        queryKey: ['outgoingFriendRequests', userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('friends')
                .select(
                    `
                    id,
                    friend_id,
                    status,
                    created_at,
                    friend_profile:profiles!friends_friend_id_fkey ( id, email, nickname )
                `,
                )
                .eq('user_id', userId)
                .eq('status', 'pending');

            if (error) throw error;
            return data ?? [];
        },
    });
}