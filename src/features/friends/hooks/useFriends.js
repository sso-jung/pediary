// src/features/friends/hooks/useFriends.js
import { useQuery } from '@tanstack/react-query';
import {
    fetchFriends,
    fetchIncomingFriendRequests,
    fetchOutgoingFriendRequests,
    searchProfiles,
} from '../../../lib/wikiApi';

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
        queryFn: () => fetchIncomingFriendRequests(userId),
    });
}

export function useOutgoingFriendRequests(userId) {
    return useQuery({
        queryKey: ['outgoingFriendRequests', userId],
        enabled: !!userId,
        queryFn: () => fetchOutgoingFriendRequests(userId),
    });
}

export function useProfileSearch(keyword) {
    return useQuery({
        queryKey: ['profileSearch', keyword],
        queryFn: () => searchProfiles(keyword),
        enabled: !!keyword,
    });
}
