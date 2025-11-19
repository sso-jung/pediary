import {fetchTodayActivity} from "../../../lib/wikiApi.js";
import {useAuthStore} from "../../../store/authStore.js";
import {useQuery} from "@tanstack/react-query";

export function useTodayActivity() {
    const user = useAuthStore((s) => s.user);

    return useQuery({
        queryKey: ['activity', 'today', user?.id],
        queryFn: () => fetchTodayActivity(user.id),
        enabled: !!user,
    });
}