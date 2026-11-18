export const DIARY_VIEW_TABS = [
    { value: 'weekly', label: 'WEEKLY', description: '한 주의 일지를 날짜별로 봅니다.' },
    { value: 'monthly', label: 'MONTHLY', description: '한 달의 일지를 달력에서 봅니다.' },
    { value: 'timeline', label: 'TIMELINE', description: '같은 선택·다중선택 값의 기록 간격이 31일 미만이면 기간으로 이어 보여줍니다.' },
    { value: 'patchwork', label: 'PATCHWORK', description: '날짜 칸마다 그날 기록한 값을 색상 구획으로 보여줍니다.' },
    { value: 'strata', label: 'STRATA', description: '기록된 랜덤 선택 결과의 횟수와 최초·최근 날짜를 모아 봅니다.' },
    { value: 'gradient', label: 'GRADIENT', description: '날짜별 목표 달성률을 색으로 보여줍니다.' },
    { value: 'blossom', label: 'BLOSSOM', description: '가꿈의 하루 기록을 봅니다.' },
];

export const MOBILE_DIARY_VIEW_TABS = DIARY_VIEW_TABS
    .filter((tab) => tab.value !== 'strata')
    .map((tab) => ({
        ...tab,
        label: { weekly: 'DAILY', patchwork: 'PATCH', gradient: 'GRAD' }[tab.value] || tab.label,
    }));

export function getDiaryViewTabs(settings = []) {
    const settingsByView = new Map(settings.map((setting) => [setting.view_type, setting]));
    const blossomOrder = Math.max(DIARY_VIEW_TABS.length - 2, ...settings.filter((setting) => setting.view_type !== 'blossom').map((setting) => setting.sort_order ?? -1)) + 1;
    const tabs = DIARY_VIEW_TABS.map((tab, index) => ({
        ...tab,
        sortOrder: settingsByView.get(tab.value)?.sort_order ?? (tab.value === 'blossom' ? blossomOrder : index),
        isVisible: settingsByView.get(tab.value)?.is_visible !== false,
        customTitle: settingsByView.get(tab.value)?.custom_title || '',
    })).sort((a, b) => a.sortOrder - b.sortOrder || DIARY_VIEW_TABS.findIndex((tab) => tab.value === a.value) - DIARY_VIEW_TABS.findIndex((tab) => tab.value === b.value));
    if (!tabs.some((tab) => tab.isVisible)) {
        return tabs.map((tab) => tab.value === 'weekly' ? { ...tab, isVisible: true } : tab);
    }
    return tabs;
}

export function getMobileDiaryViewTabs(settings = []) {
    const settingsByView = new Map(settings.map((setting) => [setting.view_type, setting]));
    const blossomOrder = Math.max(MOBILE_DIARY_VIEW_TABS.length - 2, ...settings.filter((setting) => setting.view_type !== 'blossom').map((setting) => setting.mobile_sort_order ?? -1)) + 1;
    const tabs = MOBILE_DIARY_VIEW_TABS.map((tab, index) => ({
        ...tab,
        sortOrder: settingsByView.get(tab.value)?.mobile_sort_order ?? (tab.value === 'blossom' ? blossomOrder : index),
        isVisible: settingsByView.get(tab.value)?.mobile_is_visible !== false,
        customTitle: settingsByView.get(tab.value)?.mobile_custom_title || '',
    })).sort((a, b) => a.sortOrder - b.sortOrder || MOBILE_DIARY_VIEW_TABS.findIndex((tab) => tab.value === a.value) - MOBILE_DIARY_VIEW_TABS.findIndex((tab) => tab.value === b.value));
    if (!tabs.some((tab) => tab.isVisible)) {
        return tabs.map((tab) => tab.value === 'weekly' ? { ...tab, isVisible: true } : tab);
    }
    return tabs;
}
