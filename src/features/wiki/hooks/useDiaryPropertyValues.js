import { useQuery } from '@tanstack/react-query';
import {
    fetchDiaryPropertyValues,
    fetchDiaryPropertyValuesByPropertyIds,
} from '../../../lib/wikiApi';
import { useAuthStore } from '../../../store/authStore';

export function useDiaryPropertyValues(diaryDate) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;

    return useQuery({
        queryKey: ['diaryPropertyValues', userId, diaryDate],
        queryFn: () => fetchDiaryPropertyValues({ userId, diaryDate }),
        enabled: !!userId && !!diaryDate,
    });
}

export function useDiaryPropertyValuesByPropertyIds(propertyIds = [], enabled = true) {
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const propertyIdKey = propertyIds.join(',');

    return useQuery({
        queryKey: ['diaryPropertyValuesByPropertyIds', userId, propertyIdKey],
        queryFn: () => fetchDiaryPropertyValuesByPropertyIds({ userId, propertyIds }),
        enabled: !!userId && propertyIds.length > 0 && enabled,
    });
}
