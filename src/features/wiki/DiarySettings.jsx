import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROPERTY_ICON_PRESETS, PROPERTY_TYPES, PropertyIcon } from './DiaryPropertyUtils';
import {
    useCreateDiaryProperty,
    useCreateDiaryPropertySection,
    useDeleteDiaryProperty,
    useDeleteDiaryPropertySection,
    useDiaryProperties,
    useDiaryPropertySections,
    useUpdateDiaryPropertySection,
    useUpdateDiaryPropertySectionOrder,
    useUpdateDiaryProperty,
} from './hooks/useDiaryProperties';
import { useDiaryLayout, useUpdateDiaryLayout } from './hooks/useDiaryLayout';
import {
    useDiaryViewLayout,
    useDiaryViewSetting,
    useUpdateDiaryViewLayout,
    useUpdateDiaryViewSetting,
} from './hooks/useDiaryViewLayout';
import PropertyOptionsDialog from './PropertyOptionsDialog';
import {
    useCreateDiaryPropertyOption,
    useDeleteDiaryPropertyOption,
    useDiaryPropertyOptions,
    useUpdateDiaryPropertyOption,
} from './hooks/useDiaryPropertyOptions';

const AUTO_SAVE_DELAY = 500;
const VISIBILITY_OPTIONS = [
    { value: 'always', label: '항상 표시' },
    { value: 'when_filled', label: '값 있을 때' },
    { value: 'hidden', label: '숨김' },
];
const VIEW_OPTIONS = [
    { value: 'weekly', label: 'WEEKLY' },
    { value: 'monthly', label: 'MONTHLY' },
    { value: 'timeline', label: 'TIMELINE' },
    { value: 'patchwork', label: 'PATCHWORK' },
    { value: 'strata', label: 'STRATA' },
];
const SETTINGS_TABS = [
    { value: 'properties', label: '속성 편집' },
    { value: 'weekly', label: 'WEEKLY' },
    { value: 'monthly', label: 'MONTHLY' },
    { value: 'timeline', label: 'TIMELINE' },
    { value: 'patchwork', label: 'PATCHWORK' },
    { value: 'strata', label: 'STRATA' },
];
const VIEW_VISIBILITY_OPTIONS = [
    { value: 'visible', label: '내용 표시' },
    { value: 'hidden', label: '내용 숨김' },
];
const DISPLAY_MODE_OPTIONS = [
    { value: 'icon_name', label: '아이콘+속성명' },
    { value: 'icon', label: '아이콘만' },
    { value: 'name', label: '속성명만' },
    { value: 'content', label: '내용만' },
];
const TIMELINE_PROPERTY_TYPES = ['select', 'multi_select'];

function getPropertyDraftName(name) {
    const draftName = String(name || '').trim();
    return draftName === '새 속성' ? '' : draftName;
}

function getDraftFromProperty(property) {
    return {
        name: getPropertyDraftName(property?.name),
        type: property?.type || 'text',
        icon: property?.icon || '',
    };
}

function getDraftFromSection(section) {
    return {
        name: section?.name || '',
    };
}

function buildLayoutItems(properties = [], layout = []) {
    const layoutMap = new Map(
        layout.map((item) => [
            item.property_id,
            {
                sortOrder: item.sort_order ?? 0,
                visibility: item.visibility || 'always',
            },
        ]),
    );

    return properties
        .map((property, index) => {
            const layoutItem = layoutMap.get(property.id);

            return {
                propertyId: property.id,
                property,
                sectionId: property.section_id ?? null,
                visibility: layoutItem?.visibility || 'always',
                sortOrder: layoutItem ? layoutItem.sortOrder : 10000 + (property.sort_order ?? index),
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function buildViewLayoutItems(properties = [], viewLayout = []) {
    const layoutMap = new Map(
        (viewLayout || []).map((item) => [
            item.property_id,
            {
                visibility: item.visibility || 'hidden',
                displayMode: item.display_mode || (item.show_name === false ? 'content' : 'icon_name'),
                sortOrder: item.sort_order ?? 0,
            },
        ]),
    );

    return (properties || [])
        .map((property, index) => {
            const layoutItem = layoutMap.get(property.id);

            return {
                propertyId: property.id,
                property,
                visibility: layoutItem?.visibility || 'hidden',
                displayMode: layoutItem?.displayMode || 'icon_name',
                sortOrder: property.sort_order ?? index,
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function sortSections(sections = []) {
    return [...sections].sort(
        (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            (a.created_at || '').localeCompare(b.created_at || ''),
    );
}

function moveSectionItem(sections, sourceSectionId, targetSectionId, position = 'before') {
    if (!sourceSectionId || !targetSectionId || sourceSectionId === targetSectionId) {
        return sections;
    }

    const sourceSection = sections.find((section) => section.id === sourceSectionId);
    const targetSection = sections.find((section) => section.id === targetSectionId);

    if (!sourceSection || !targetSection) return sections;
    if ((sourceSection.parent_section_id ?? null) !== (targetSection.parent_section_id ?? null)) {
        return sections;
    }

    const parentSectionId = sourceSection.parent_section_id ?? null;
    const siblings = sortSections(
        sections.filter(
            (section) => (section.parent_section_id ?? null) === parentSectionId,
        ),
    );
    const nextSiblings = siblings.filter((section) => section.id !== sourceSectionId);
    const targetIndex = nextSiblings.findIndex((section) => section.id === targetSectionId);

    if (targetIndex < 0) return sections;

    const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
    nextSiblings.splice(insertIndex, 0, sourceSection);

    const orderMap = new Map(
        nextSiblings.map((section, index) => [section.id, index]),
    );

    return sections.map((section) =>
        orderMap.has(section.id)
            ? {
                ...section,
                sort_order: orderMap.get(section.id),
            }
            : section,
    );
}

function getDropPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;

    return offsetY < rect.height / 2 ? 'before' : 'after';
}

function moveLayoutItem(items, sourcePropertyId, targetPropertyId, position = 'before') {
    if (!sourcePropertyId || !targetPropertyId || sourcePropertyId === targetPropertyId) {
        return items;
    }

    const sourceIndex = items.findIndex((item) => item.propertyId === sourcePropertyId);

    if (sourceIndex < 0) return items;

    const sourceItem = items[sourceIndex];
    const next = items.filter((item) => item.propertyId !== sourcePropertyId);
    const targetIndex = next.findIndex((item) => item.propertyId === targetPropertyId);

    if (targetIndex < 0) return items;

    const targetItem = next[targetIndex];
    const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
    next.splice(insertIndex, 0, {
        ...sourceItem,
        sectionId: targetItem.sectionId ?? null,
    });

    return next;
}

function SettingsDropdown({ value, options, onChange }) {
    const dropdownId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const [menuRect, setMenuRect] = useState(null);
    const selected = options.find((option) => option.value === value);

    const updateMenuRect = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;

        const gap = 4;
        const maxHeight = 288;
        const estimatedHeight = Math.min(maxHeight, Math.max(40, (options.length * 32) + 8));
        const bottomTop = rect.bottom + gap;
        const top = bottomTop + estimatedHeight > window.innerHeight
            ? Math.max(8, rect.top - estimatedHeight - gap)
            : bottomTop;

        setMenuRect({
            left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
            top,
            width: rect.width,
            maxHeight,
        });
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            const isButtonClick = buttonRef.current?.contains(e.target);
            const isMenuClick = menuRef.current?.contains(e.target);

            if (!isButtonClick && !isMenuClick) {
                setIsOpen(false);
            }
        };

        const handleWindowChange = () => updateMenuRect();

        document.addEventListener('mousedown', handleClickOutside, true);
        window.addEventListener('scroll', handleWindowChange, true);
        window.addEventListener('resize', handleWindowChange);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            window.removeEventListener('scroll', handleWindowChange, true);
            window.removeEventListener('resize', handleWindowChange);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleOpenDropdown = (e) => {
            if (e.detail !== dropdownId) {
                setIsOpen(false);
            }
        };

        window.addEventListener('diary-settings-dropdown-open', handleOpenDropdown);
        return () =>
            window.removeEventListener('diary-settings-dropdown-open', handleOpenDropdown);
    }, [dropdownId]);

    return (
        <div className="relative w-[calc(100%-16px)]">
            <button
                ref={buttonRef}
                type="button"
                className="diary-settings-input ui-input flex h-[30px] w-full items-center justify-between gap-2 !rounded-md !px-2.5 !py-0 !text-left !text-[12px]"
                onClick={(e) => {
                    e.stopPropagation();
                    updateMenuRect();
                    setIsOpen((prev) => {
                        const next = !prev;

                        if (next) {
                            window.dispatchEvent(
                                new CustomEvent('diary-settings-dropdown-open', {
                                    detail: dropdownId,
                                }),
                            );
                        }

                        return next;
                    });
                }}
            >
                <span className="min-w-0 truncate">{selected?.label || ''}</span>
                <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5 shrink-0 page-text-muted"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M5.5 7.5L10 12l4.5-4.5" />
                </svg>
            </button>

            {isOpen && menuRect && createPortal(
                <div
                    ref={menuRef}
                    className="diary-settings-menu fixed z-50 max-h-72 overflow-y-auto rounded-md border py-1 text-[12px] shadow-lg"
                    style={{
                        left: menuRect.left,
                        top: menuRect.top,
                        width: menuRect.width,
                        maxHeight: menuRect.maxHeight,
                        borderColor: 'var(--color-border-subtle)',
                        backgroundColor: 'var(--color-page-surface)',
                        color: 'var(--color-text-main)',
                    }}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={
                                'block w-full whitespace-normal break-keep px-2 py-1.5 text-left leading-snug ui-side-subitem ' +
                                (option.value === value ? 'ui-side-subitem-active' : '')
                            }
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </div>
    );
}

function PropertyIconPicker({ icon, onChange, onUpload }) {
    const pickerId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const [menuRect, setMenuRect] = useState(null);

    const updateMenuRect = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;

        const width = 236;
        const height = 288;
        const gap = 4;
        const left = Math.min(rect.left, window.innerWidth - width - 8);
        const bottomTop = rect.bottom + gap;
        const top = bottomTop + height > window.innerHeight
            ? Math.max(8, rect.top - height - gap)
            : bottomTop;

        setMenuRect({
            left: Math.max(8, left),
            top,
            width,
        });
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            const isButtonClick = buttonRef.current?.contains(e.target);
            const isMenuClick = menuRef.current?.contains(e.target);

            if (!isButtonClick && !isMenuClick) {
                setIsOpen(false);
            }
        };

        const handleWindowChange = () => updateMenuRect();

        document.addEventListener('mousedown', handleClickOutside, true);
        window.addEventListener('scroll', handleWindowChange, true);
        window.addEventListener('resize', handleWindowChange);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            window.removeEventListener('scroll', handleWindowChange, true);
            window.removeEventListener('resize', handleWindowChange);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleOpenDropdown = (e) => {
            if (e.detail !== pickerId) {
                setIsOpen(false);
            }
        };

        window.addEventListener('diary-settings-dropdown-open', handleOpenDropdown);
        return () =>
            window.removeEventListener('diary-settings-dropdown-open', handleOpenDropdown);
    }, [pickerId]);

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)]"
                onClick={(e) => {
                    e.stopPropagation();
                    updateMenuRect();
                    setIsOpen((prev) => {
                        const next = !prev;

                        if (next) {
                            window.dispatchEvent(
                                new CustomEvent('diary-settings-dropdown-open', {
                                    detail: pickerId,
                                }),
                            );
                        }

                        return next;
                    });
                }}
                aria-label="아이콘 선택"
                title="아이콘 선택"
            >
                {icon ? (
                    <PropertyIcon icon={icon} />
                ) : (
                    <svg
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M10 13V4"/>
                        <path d="M6.5 7.5 10 4l3.5 3.5"/>
                        <path d="M4 13.5V15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5"/>
                    </svg>
                )}
            </button>

            {isOpen && menuRect && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-50 max-h-72 overflow-y-auto rounded-md border p-2 text-[12px] shadow-lg"
                    style={{
                        left: menuRect.left,
                        top: menuRect.top,
                        width: menuRect.width,
                        borderColor: 'var(--color-border-subtle)',
                        backgroundColor: 'var(--color-page-surface)',
                        color: 'var(--color-text-main)',
                    }}
                >
                    <div className="grid grid-cols-6 gap-1">
                        {PROPERTY_ICON_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                className={[
                                    "flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[rgba(127,127,127,0.08)]",
                                    preset.icon === icon ? "bg-[rgba(127,127,127,0.10)]" : "",
                                ].join(" ")}
                                onClick={() => {
                                    onChange(preset.icon);
                                    setIsOpen(false);
                                }}
                                aria-label={preset.label}
                                title={preset.label}
                            >
                                <PropertyIcon icon={preset.icon} />
                            </button>
                        ))}
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
                        <label className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)]">
                            업로드
                            <input
                                type="file"
                                accept="image/svg+xml,image/webp,.svg,.webp"
                                className="hidden"
                                onChange={(e) =>
                                    onUpload(e.target.files?.[0], (nextIcon) => {
                                        onChange(nextIcon);
                                        setIsOpen(false);
                                    })
                                }
                            />
                        </label>
                        {icon && (
                            <button
                                type="button"
                                className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-red-500"
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                            >
                                제거
                            </button>
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

function DiarySettingsTooltip({ tooltip }) {
    const tooltipRef = useRef(null);
    const [position, setPosition] = useState({
        left: 0,
        top: 0,
        arrowLeft: 0,
    });

    useLayoutEffect(() => {
        if (!tooltip) return;

        const el = tooltipRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const margin = 8;

        let left = tooltip.x - rect.width / 2;
        left = Math.max(
            margin,
            Math.min(left, window.innerWidth - rect.width - margin),
        );

        let top = tooltip.y - rect.height - 12;
        top = Math.max(margin, top);

        const arrowLeft = Math.max(
            10,
            Math.min(tooltip.x - left, rect.width - 10),
        );

        setPosition({
            left,
            top,
            arrowLeft,
        });
    }, [tooltip]);

    if (!tooltip) return null;

    return createPortal(
        <div
            ref={tooltipRef}
            className="pointer-events-none fixed z-[9999] rounded-lg px-3 py-2 text-[11px] font-semibold leading-snug text-white shadow-xl"
            style={{
                left: position.left,
                top: position.top,
                backgroundColor: 'rgb(30 41 59)',
                whiteSpace: 'nowrap',
                maxWidth: 'calc(100vw - 24px)',
            }}
        >
            {tooltip.text}

            <span
                aria-hidden
                className="absolute h-2 w-2 rotate-45"
                style={{
                    left: position.arrowLeft,
                    bottom: -4,
                    marginLeft: -4,
                    backgroundColor: 'rgb(30 41 59)',
                }}
            />
        </div>,
        document.body,
    );
}

export default function DiarySettings({ open, onClose }) {
    const { data: properties } = useDiaryProperties();
    const { data: sections } = useDiaryPropertySections();
    const { data: layout } = useDiaryLayout();
    const { data: weeklyViewLayout } = useDiaryViewLayout('weekly');
    const { data: monthlyViewLayout } = useDiaryViewLayout('monthly');
    const { data: timelineViewLayout } = useDiaryViewLayout('timeline');
    const { data: patchworkViewLayout } = useDiaryViewLayout('patchwork');
    const { data: strataViewLayout } = useDiaryViewLayout('strata');
    const { data: weeklyViewSetting } = useDiaryViewSetting('weekly');
    const { data: monthlyViewSetting } = useDiaryViewSetting('monthly');
    const { data: propertyOptions } = useDiaryPropertyOptions();
    const createPropertyOption = useCreateDiaryPropertyOption();
    const updatePropertyOption = useUpdateDiaryPropertyOption();
    const deletePropertyOption = useDeleteDiaryPropertyOption();
    const createProperty = useCreateDiaryProperty();
    const updateProperty = useUpdateDiaryProperty();
    const deleteProperty = useDeleteDiaryProperty();
    const createSection = useCreateDiaryPropertySection();
    const updateSection = useUpdateDiaryPropertySection();
    const deleteSection = useDeleteDiaryPropertySection();
    const updateSectionOrder = useUpdateDiaryPropertySectionOrder();
    const updateLayout = useUpdateDiaryLayout();
    const updateWeeklyViewLayout = useUpdateDiaryViewLayout('weekly');
    const updateMonthlyViewLayout = useUpdateDiaryViewLayout('monthly');
    const updateTimelineViewLayout = useUpdateDiaryViewLayout('timeline');
    const updatePatchworkViewLayout = useUpdateDiaryViewLayout('patchwork');
    const updateStrataViewLayout = useUpdateDiaryViewLayout('strata');
    const updateWeeklyViewSetting = useUpdateDiaryViewSetting('weekly');
    const updateMonthlyViewSetting = useUpdateDiaryViewSetting('monthly');

    const [propertyDrafts, setPropertyDrafts] = useState({});
    const [sectionDrafts, setSectionDrafts] = useState({});
    const [layoutItems, setLayoutItems] = useState([]);
    const [draggingPropertyId, setDraggingPropertyId] = useState(null);
    const [draggingSectionId, setDraggingSectionId] = useState(null);
    const [dropIndicator, setDropIndicator] = useState(null);
    const [sectionDropIndicator, setSectionDropIndicator] = useState(null);
    const [titleTooltip, setTitleTooltip] = useState(null);
    const [activeSettingsTab, setActiveSettingsTab] = useState('properties');
    const saveTimersRef = useRef({});
    const latestDraftsRef = useRef({});
    const tooltipTargetRef = useRef(null);
    const [editingOptionProperty, setEditingOptionProperty] = useState(null);

    const optionsByPropertyId = useMemo(() => {
        const map = new Map();

        (propertyOptions || []).forEach((option) => {
            const propertyId = option.property_id;
            map.set(propertyId, [...(map.get(propertyId) || []), option]);
        });

        return map;
    }, [propertyOptions]);

    useEffect(() => {
        if (!open || !properties) return;

        setPropertyDrafts((prev) => {
            const next = {};

            properties.forEach((property) => {
                next[property.id] = prev[property.id] || getDraftFromProperty(property);
            });

            latestDraftsRef.current = next;
            return next;
        });
    }, [open, properties]);

    useEffect(() => {
        if (!open || !properties) return;
        setLayoutItems(buildLayoutItems(properties, layout || []));
    }, [open, properties, layout]);

    useEffect(() => {
        if (!open || !sections) return;

        setSectionDrafts((prev) => {
            const next = {};

            sections.forEach((section) => {
                next[section.id] = prev[section.id] || getDraftFromSection(section);
            });

            return next;
        });
    }, [open, sections]);

    useEffect(() => {
        latestDraftsRef.current = propertyDrafts;
    }, [propertyDrafts]);

    useEffect(() => {
        if (!open) {
            setActiveSettingsTab('properties');
        }
    }, [open]);

    useEffect(() => {
        return () => {
            Object.values(saveTimersRef.current).forEach((timerId) => {
                window.clearTimeout(timerId);
            });
        };
    }, []);

    if (!open) return null;

    const busy =
        createProperty.isPending ||
        updateProperty.isPending ||
        deleteProperty.isPending ||
        createPropertyOption.isPending ||
        updatePropertyOption.isPending ||
        deletePropertyOption.isPending ||
        createSection.isPending ||
        updateSection.isPending ||
        deleteSection.isPending ||
        updateSectionOrder.isPending ||
        updateLayout.isPending ||
        updateWeeklyViewLayout.isPending ||
        updateMonthlyViewLayout.isPending ||
        updateTimelineViewLayout.isPending ||
        updatePatchworkViewLayout.isPending ||
        updateWeeklyViewSetting.isPending ||
        updateMonthlyViewSetting.isPending;

    const getOriginalProperty = (propertyId) =>
        (properties || []).find((property) => property.id === propertyId);

    const savePropertyDraft = (propertyId, draft) => {
        const name = String(draft?.name || '').trim() || '새 속성';
        const type = draft?.type || 'text';
        const icon = draft?.icon || '';

        const original = getOriginalProperty(propertyId);

        if (
            original &&
            (original.name || '') === name &&
            (original.type || 'text') === type &&
            (original.icon || '') === icon
        ) {
            return;
        }

        updateProperty.mutate({
            propertyId,
            name,
            type,
            icon,
        });
    };

    const schedulePropertySave = (propertyId, draft, delay = AUTO_SAVE_DELAY) => {
        if (saveTimersRef.current[propertyId]) {
            window.clearTimeout(saveTimersRef.current[propertyId]);
        }

        if (delay === 0) {
            savePropertyDraft(propertyId, draft);
            return;
        }

        saveTimersRef.current[propertyId] = window.setTimeout(() => {
            const latestDraft = latestDraftsRef.current[propertyId] || draft;
            savePropertyDraft(propertyId, latestDraft);
        }, delay);
    };

    const flushPropertySave = (propertyId) => {
        if (saveTimersRef.current[propertyId]) {
            window.clearTimeout(saveTimersRef.current[propertyId]);
        }

        const draft = latestDraftsRef.current[propertyId];
        savePropertyDraft(propertyId, draft);
    };

    const handleChangePropertyDraft = (propertyId, field, value, delay = AUTO_SAVE_DELAY) => {
        const currentDraft = latestDraftsRef.current[propertyId] || {};
        const nextDraft = {
            ...currentDraft,
            [field]: value,
        };

        latestDraftsRef.current = {
            ...latestDraftsRef.current,
            [propertyId]: nextDraft,
        };

        setPropertyDrafts((prev) => ({
            ...prev,
            [propertyId]: nextDraft,
        }));

        schedulePropertySave(propertyId, nextDraft, delay);
    };

    const handleUploadIcon = async (file, onChange) => {
        if (!file) return;

        if (file.type === 'image/webp') {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    onChange(reader.result);
                }
            };
            reader.readAsDataURL(file);
            return;
        }

        if (file.type && file.type !== 'image/svg+xml') return;

        const text = await file.text();
        const trimmed = text.trim();
        if (!trimmed.startsWith('<svg')) return;

        onChange(trimmed);
    };

    const handleCreateProperty = async (sectionId = null) => {
        await createProperty.mutateAsync({
            name: '새 속성',
            type: 'text',
            icon: '',
            sectionId,
        });
    };

    const handleCreatePropertyOption = async ({ propertyId, name, color, textColor, sortOrder }) => {
        return createPropertyOption.mutateAsync({
            propertyId,
            name,
            color,
            textColor,
            sortOrder,
        });
    };

    const handleUpdatePropertyOption = async ({ optionId, name, color, textColor, sortOrder }) => {
        return updatePropertyOption.mutateAsync({
            optionId,
            name,
            color,
            textColor,
            sortOrder,
        });
    };

    const handleDeletePropertyOption = async ({ optionId }) => {
        if (!window.confirm('이 옵션을 삭제할까? 기존 다이어리 기록에서는 삭제되지 않아.')) return;

        return deletePropertyOption.mutateAsync({ optionId });
    };

    const handleCreateSection = async (parentSectionId = null) => {
        await createSection.mutateAsync({
            name: parentSectionId ? '하위 섹션' : '새 섹션',
            parentSectionId,
        });
    };

    const handleChangeSectionDraft = (sectionId, name) => {
        setSectionDrafts((prev) => ({
            ...prev,
            [sectionId]: {
                ...(prev[sectionId] || {}),
                name,
            },
        }));
    };

    const flushSectionSave = (sectionId) => {
        const original = (sections || []).find((section) => section.id === sectionId);
        const draft = sectionDrafts[sectionId] || getDraftFromSection(original);
        const name = String(draft?.name || '').trim();

        if (!original || !name || original.name === name) return;

        updateSection.mutate({
            sectionId,
            name,
        });
    };

    const handleDeleteSection = async (sectionId) => {
        if (!window.confirm('이 섹션과 하위 섹션을 삭제할까? \n섹션에 포함된 속성은 미분류로 돌아가.')) return;

        await deleteSection.mutateAsync({ sectionId });
    };

    const saveLayoutItems = (nextItems) => {
        updateLayout.mutate({
            items: nextItems.map((item) => ({
                propertyId: item.propertyId,
                sectionId: item.sectionId ?? null,
                visibility: item.visibility,
            })),
        });
    };

    const handleChangeVisibility = (propertyId, visibility) => {
        setLayoutItems((prev) => {
            const next = prev.map((item) =>
                item.propertyId === propertyId
                    ? {
                        ...item,
                        visibility,
                    }
                    : item,
            );

            saveLayoutItems(next);
            return next;
        });
    };

    const handleDragStart = (e, propertyId) => {
        setDraggingPropertyId(propertyId);
        setDraggingSectionId(null);
        setDropIndicator(null);
        setSectionDropIndicator(null);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', propertyId);
    };

    const handleDragOverProperty = (e, targetPropertyId) => {
        if (!draggingPropertyId || draggingPropertyId === targetPropertyId) return;

        e.preventDefault();

        setDropIndicator({
            targetId: targetPropertyId,
            position: getDropPosition(e),
        });
    };

    const handleDropProperty = (e, targetPropertyId) => {
        e.preventDefault();

        const sourcePropertyId = draggingPropertyId || e.dataTransfer.getData('text/plain');
        const position =
            dropIndicator?.targetId === targetPropertyId
                ? dropIndicator.position
                : getDropPosition(e);

        setLayoutItems((prev) => {
            const next = moveLayoutItem(prev, sourcePropertyId, targetPropertyId, position);
            if (next === prev) return prev;

            saveLayoutItems(next);
            return next;
        });

        setDraggingPropertyId(null);
        setDropIndicator(null);
    };

    const handleDropPropertyOnSection = (e, sectionId) => {
        if (!draggingPropertyId) return;

        e.preventDefault();

        setLayoutItems((prev) => {
            const targetItems = prev.filter((item) => (item.sectionId ?? null) === sectionId);
            const sourceItem = prev.find((item) => item.propertyId === draggingPropertyId);

            if (!sourceItem) return prev;

            const next = prev
                .filter((item) => item.propertyId !== draggingPropertyId)
                .map((item) => ({ ...item }));

            const lastTargetIndex = next.findLastIndex(
                (item) => (item.sectionId ?? null) === sectionId,
            );
            const nextSourceItem = {
                ...sourceItem,
                sectionId,
            };

            if (targetItems.length === 0 || lastTargetIndex < 0) {
                next.push(nextSourceItem);
            } else {
                next.splice(lastTargetIndex + 1, 0, nextSourceItem);
            }

            saveLayoutItems(next);
            return next;
        });

        setDraggingPropertyId(null);
        setDropIndicator(null);
    };

    const handleSectionDragStart = (e, sectionId) => {
        setDraggingSectionId(sectionId);
        setDraggingPropertyId(null);
        setDropIndicator(null);
        setSectionDropIndicator(null);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(sectionId));
    };

    const handleDragOverSection = (e, sectionId) => {
        if (!draggingSectionId || draggingSectionId === sectionId) return;

        e.preventDefault();

        setSectionDropIndicator({
            targetId: sectionId,
            position: getDropPosition(e),
        });
    };

    const saveSectionOrder = (nextSections) => {
        updateSectionOrder.mutate({
            sections: nextSections.map((section) => ({
                sectionId: section.id,
                parentSectionId: section.parent_section_id ?? null,
                sortOrder: section.sort_order ?? 0,
            })),
        });
    };

    const handleDropSection = (e, sectionId) => {
        if (!draggingSectionId) return;

        e.preventDefault();

        const position =
            sectionDropIndicator?.targetId === sectionId
                ? sectionDropIndicator.position
                : getDropPosition(e);
        const nextSections = moveSectionItem(
            sections || [],
            draggingSectionId,
            sectionId,
            position,
        );

        if (nextSections !== sections) {
            saveSectionOrder(nextSections);
        }

        setDraggingSectionId(null);
        setSectionDropIndicator(null);
    };

    const handleDeleteProperty = async (propertyId) => {
        if (saveTimersRef.current[propertyId]) {
            window.clearTimeout(saveTimersRef.current[propertyId]);
        }

        if (!window.confirm('이 속성을 삭제할까? 저장된 속성값도 함께 삭제돼.')) return;

        await deleteProperty.mutateAsync({ propertyId });
    };

    const handleBackdropMouseDown = (e) => {
        if (e.target !== e.currentTarget) return;
        if (busy) return;
        onClose();
    };

    const getTooltipTarget = (target) => target?.closest?.('[title], [data-diary-title-tooltip]');

    const handleTooltipMouseMove = (e) => {
        const target = getTooltipTarget(e.target);
        if (!target) {
            setTitleTooltip(null);
            tooltipTargetRef.current = null;
            return;
        }

        const title = target.getAttribute('title');
        const tooltipText = title || target.getAttribute('data-diary-title-tooltip');

        if (!tooltipText) return;

        if (title) {
            target.setAttribute('data-diary-title-tooltip', title);
            target.removeAttribute('title');
        }

        tooltipTargetRef.current = target;
        setTitleTooltip({
            text: tooltipText,
            x: e.clientX,
            y: e.clientY,
        });
    };

    const handleTooltipMouseLeave = (e) => {
        const target = tooltipTargetRef.current;
        if (!target) return;
        if (target.contains(e.relatedTarget)) return;

        setTitleTooltip(null);
        tooltipTargetRef.current = null;
    };

    const rootSections = sortSections(
        (sections || []).filter((section) => !section.parent_section_id),
    );
    const childSectionMap = new Map();

    (sections || []).forEach((section) => {
        const parentSectionId = section.parent_section_id ?? null;
        if (!parentSectionId) return;

        childSectionMap.set(parentSectionId, [
            ...(childSectionMap.get(parentSectionId) || []),
            section,
        ]);
    });

    const getItemsBySection = (sectionId) =>
        layoutItems.filter((item) => (item.sectionId ?? null) === sectionId);
    const unclassifiedItems = getItemsBySection(null);
    const viewLayouts = {
        weekly: weeklyViewLayout || [],
        monthly: monthlyViewLayout || [],
        timeline: timelineViewLayout || [],
        patchwork: patchworkViewLayout || [],
        strata: strataViewLayout || [],
    };
    const viewSettings = {
        weekly: weeklyViewSetting || null,
        monthly: monthlyViewSetting || null,
    };
    const updateViewLayouts = {
        weekly: updateWeeklyViewLayout,
        monthly: updateMonthlyViewLayout,
        timeline: updateTimelineViewLayout,
        patchwork: updatePatchworkViewLayout,
        strata: updateStrataViewLayout,
    };
    const updateViewSettings = {
        weekly: updateWeeklyViewSetting,
        monthly: updateMonthlyViewSetting,
    };

    const handleChangeViewLayout = (viewType, propertyId, field, value) => {
        const viewItems = buildViewLayoutItems(properties || [], viewLayouts[viewType]).map((item) =>
            item.propertyId === propertyId
                ? {
                    ...item,
                    [field]: value,
                }
                : item,
        );

        updateViewLayouts[viewType].mutate({
            items: viewItems.map((item) => ({
                propertyId: item.propertyId,
                visibility: item.visibility,
                displayMode: item.displayMode,
            })),
        });
    };

    const handleChangeViewSetting = (viewType, field, value) => {
        if (field !== 'showTitle') return;

        updateViewSettings[viewType]?.mutate({
            showTitle: value,
        });
    };

    const renderViewSettings = (viewOption) => {
        const viewItems = buildViewLayoutItems(properties || [], viewLayouts[viewOption.value])
            .filter((item) =>
                viewOption.value === 'strata'
                    ? item.property?.type === 'random_pick'
                    : (viewOption.value !== 'timeline' && viewOption.value !== 'patchwork') ||
                    TIMELINE_PROPERTY_TYPES.includes(item.property?.type),
            );
        const canShowTitle = viewOption.value === 'weekly' || viewOption.value === 'monthly';

        return (
            <div key={viewOption.value}>
                {canShowTitle && (
                    <div className="grid grid-cols-[minmax(0,1fr)_112px_132px] items-center border-b border-border-subtle px-2 py-1.5 text-xs">
                        <div className="min-w-0 break-words font-medium text-[var(--color-text-main)]">
                            다이어리 제목
                        </div>

                        <SettingsDropdown
                            value={viewSettings[viewOption.value]?.show_title ? 'visible' : 'hidden'}
                            options={VIEW_VISIBILITY_OPTIONS}
                            onChange={(value) =>
                                handleChangeViewSetting(
                                    viewOption.value,
                                    'showTitle',
                                    value === 'visible',
                                )
                            }
                        />

                        <div />
                    </div>
                )}

                {viewItems.map((item) => (
                    <div
                        key={item.propertyId}
                        className="diary-settings-row grid grid-cols-[minmax(0,1fr)_112px_132px] items-center border-b border-border-subtle px-2 py-1.5 text-xs last:border-b-0"
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                                <PropertyIcon icon={item.property?.icon} />
                            </span>
                            <span className="min-w-0 break-words font-medium text-[var(--color-text-main)]">
                                {getPropertyDraftName(item.property?.name) || '속성명 없음'}
                            </span>
                        </div>

                        <SettingsDropdown
                            value={item.visibility}
                            options={VIEW_VISIBILITY_OPTIONS}
                            onChange={(value) =>
                                handleChangeViewLayout(
                                    viewOption.value,
                                    item.propertyId,
                                    'visibility',
                                    value,
                                )
                            }
                        />

                        {viewOption.value === 'strata' ? (
                            <div />
                        ) : (
                            <SettingsDropdown
                                value={item.displayMode}
                                options={DISPLAY_MODE_OPTIONS}
                                onChange={(value) =>
                                    handleChangeViewLayout(
                                        viewOption.value,
                                        item.propertyId,
                                        'displayMode',
                                        value,
                                    )
                                }
                            />
                        )}
                    </div>
                ))}

                {viewItems.length === 0 && (
                    <p className="px-2 py-4 text-xs ui-dialog-message">
                        {viewOption.value === 'strata'
                            ? '랜덤 뽑기 속성을 이 뷰에서 관리할 수 있어.'
                            : viewOption.value === 'timeline' || viewOption.value === 'patchwork'
                                ? '선택/다중선택 속성을 이 뷰에서 관리할 수 있어.'
                                : '아직 추가된 속성이 없어.'}
                    </p>
                )}
            </div>
        );
    };

    const renderPropertyRow = (layoutItem) => {
        const property = layoutItem.property;
        const draft = propertyDrafts[property.id] || getDraftFromProperty(property);

        return (
            <div
                key={property.id}
                className={[
                    "diary-settings-row relative grid grid-cols-[28px_40px_repeat(3,minmax(0,1fr))_32px] items-center border-b border-border-subtle px-2 py-1 text-xs hover:bg-[rgba(127,127,127,0.06)]",
                    draggingPropertyId === property.id ? "opacity-60" : "",
                ].join(" ")}
                onDragOver={(e) => handleDragOverProperty(e, property.id)}
                onDragLeave={() => {
                    setDropIndicator((prev) =>
                        prev?.targetId === property.id ? null : prev
                    );
                }}
                onDrop={(e) => handleDropProperty(e, property.id)}
            >
                {dropIndicator?.targetId === property.id && dropIndicator.position === 'before' && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute left-2 right-2 top-0 z-10 border-t border-dashed"
                        style={{
                            borderTopWidth: '1px',
                            borderTopColor: 'rgba(124, 140, 167, 0.55)',
                        }}
                    />
                )}

                <button
                    type="button"
                    className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => handleDragStart(e, property.id)}
                    onDragEnd={() => {
                        setDraggingPropertyId(null);
                        setDropIndicator(null);
                    }}
                    aria-label="순서 변경"
                    title="속성 순서 변경"
                >
                    <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <circle cx="7" cy="5" r="1.2" />
                        <circle cx="13" cy="5" r="1.2" />
                        <circle cx="7" cy="10" r="1.2" />
                        <circle cx="13" cy="10" r="1.2" />
                        <circle cx="7" cy="15" r="1.2" />
                        <circle cx="13" cy="15" r="1.2" />
                    </svg>
                </button>

                <div className="flex min-w-0 items-center">
                    <PropertyIconPicker
                        icon={draft.icon}
                        onChange={(icon) =>
                            handleChangePropertyDraft(
                                property.id,
                                'icon',
                                icon,
                                0,
                            )
                        }
                        onUpload={handleUploadIcon}
                    />
                </div>

                <div className="flex min-w-0 items-center gap-1 pr-2">
                    <input
                        className="diary-settings-input h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 outline-none hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
                        value={draft.name}
                        onChange={(e) =>
                            handleChangePropertyDraft(
                                property.id,
                                'name',
                                e.target.value,
                            )
                        }
                        onBlur={() => flushPropertySave(property.id)}
                        placeholder="속성명"
                        maxLength={10}
                    />

                    {['select', 'multi_select', 'random_pick'].includes(draft.type) && (
                        <button
                            type="button"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)]"
                            onClick={() => setEditingOptionProperty(property)}
                            aria-label="옵션 관리"
                            title="옵션 관리"
                        >
                            <svg
                                viewBox="0 0 20 20"
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path
                                    d="M8.8 2.8h2.4l.4 1.8a5.8 5.8 0 0 1 1.3.5l1.6-1 1.7 1.7-1 1.6c.2.4.4.8.5 1.3l1.8.4v2.4l-1.8.4a5.8 5.8 0 0 1-.5 1.3l1 1.6-1.7 1.7-1.6-1a5.8 5.8 0 0 1-1.3.5l-.4 1.8H8.8l-.4-1.8a5.8 5.8 0 0 1-1.3-.5l-1.6 1-1.7-1.7 1-1.6a5.8 5.8 0 0 1-.5-1.3l-1.8-.4V9.1l1.8-.4c.1-.5.3-.9.5-1.3l-1-1.6 1.7-1.7 1.6 1c.4-.2.8-.4 1.3-.5l.4-1.8Z"/>
                                <circle cx="10" cy="10" r="2.4"/>
                            </svg>
                        </button>
                    )}
                </div>

                <SettingsDropdown
                    value={draft.type}
                    options={PROPERTY_TYPES}
                    onChange={(value) =>
                        handleChangePropertyDraft(
                            property.id,
                            'type',
                            value,
                            0,
                        )
                    }
                />

                <SettingsDropdown
                    value={layoutItem.visibility}
                    options={VISIBILITY_OPTIONS}
                    onChange={(value) =>
                        handleChangeVisibility(property.id, value)
                    }
                />

                <button
                    type="button"
                    className="diary-settings-delete flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-red-500 disabled:opacity-30"
                    onClick={() => handleDeleteProperty(property.id)}
                    disabled={deleteProperty.isPending}
                    aria-label="속성 삭제"
                    title="속성 삭제"
                >
                    <svg
                        viewBox="0 0 20 20"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        aria-hidden="true"
                    >
                        <path d="M5 5l10 10M15 5L5 15"/>
                    </svg>
                </button>

                {dropIndicator?.targetId === property.id && dropIndicator.position === 'after' && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute bottom-0 left-2 right-2 z-10 border-t border-dashed"
                        style={{
                            borderTopWidth: '1px',
                            borderTopColor: 'rgba(124, 140, 167, 0.55)',
                        }}
                    />
                )}
            </div>
        );
    };

    const renderSection = (section, depth = 0) => {
        const sectionItems = getItemsBySection(section.id);
        const childSections = sortSections(childSectionMap.get(section.id) || []);
        const draft = sectionDrafts[section.id] || getDraftFromSection(section);

        return (
            <div key={section.id} className={depth > 0 ? "ml-6" : ""}>
                <div
                    className={[
                        "diary-settings-row relative mt-0 flex items-center gap-1 border-b border-border-subtle px-2 py-1.5 text-xs",
                        draggingSectionId === section.id ? "opacity-60" : "",
                    ].join(" ")}
                    onDragOver={(e) => {
                        handleDragOverSection(e, section.id);
                        if (draggingPropertyId) {
                            e.preventDefault();
                        }
                    }}
                    onDragLeave={() => {
                        setSectionDropIndicator((prev) =>
                            prev?.targetId === section.id ? null : prev
                        );
                    }}
                    onDrop={(e) => {
                        if (draggingSectionId) {
                            handleDropSection(e, section.id);
                            return;
                        }
                        handleDropPropertyOnSection(e, section.id);
                    }}
                >
                    {sectionDropIndicator?.targetId === section.id && sectionDropIndicator.position === 'before' && (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute left-2 right-2 top-0 z-10 border-t border-dashed"
                            style={{
                                borderTopWidth: '1px',
                                borderTopColor: 'rgba(124, 140, 167, 0.55)',
                            }}
                        />
                    )}

                    <button
                        type="button"
                        className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => handleSectionDragStart(e, section.id)}
                        onDragEnd={() => {
                            setDraggingSectionId(null);
                            setSectionDropIndicator(null);
                        }}
                        aria-label="섹션 순서 변경"
                        title="섹션 순서 변경"
                    >
                        <svg
                            viewBox="0 0 20 20"
                            className="h-4 w-4"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <circle cx="7" cy="5" r="1.2" />
                            <circle cx="13" cy="5" r="1.2" />
                            <circle cx="7" cy="10" r="1.2" />
                            <circle cx="13" cy="10" r="1.2" />
                            <circle cx="7" cy="15" r="1.2" />
                            <circle cx="13" cy="15" r="1.2" />
                        </svg>
                    </button>

                    <input
                        className="diary-settings-input h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 font-semibold outline-none hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
                        value={draft.name}
                        onChange={(e) => handleChangeSectionDraft(section.id, e.target.value)}
                        onBlur={() => flushSectionSave(section.id)}
                        placeholder="섹션명"
                    />

                    {/*{depth === 0 && (*/}
                    {/*    <button*/}
                    {/*        type="button"*/}
                    {/*        className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)] disabled:opacity-40"*/}
                    {/*        onClick={() => handleCreateSection(section.id)}*/}
                    {/*        disabled={createSection.isPending}*/}
                    {/*        aria-label="하위 섹션 추가"*/}
                    {/*        title="하위 섹션 추가"*/}
                    {/*    >*/}
                    {/*        하위섹션추가*/}
                    {/*    </button>*/}
                    {/*)}*/}

                    <button
                        type="button"
                        className="diary-settings-delete rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-red-500 disabled:opacity-30"
                        onClick={() => handleDeleteSection(section.id)}
                        disabled={deleteSection.isPending}
                        aria-label="섹션 삭제"
                    >
                        섹션삭제
                    </button>

                    {sectionDropIndicator?.targetId === section.id && sectionDropIndicator.position === 'after' && (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute bottom-0 left-2 right-2 z-10 border-t border-dashed"
                            style={{
                                borderTopWidth: '1px',
                                borderTopColor: 'rgba(124, 140, 167, 0.55)',
                            }}
                        />
                    )}
                </div>

                {sectionItems.map(renderPropertyRow)}
                {childSections.map((childSection) => renderSection(childSection, depth + 1))}
            </div>
        );
    };

    const dialog = (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 ui-dialog-backdrop"
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                className="diary-settings-dialog ui-dialog flex max-h-[86vh] w-[min(760px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl p-0"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseMove={handleTooltipMouseMove}
                onMouseLeave={() => setTitleTooltip(null)}
                onMouseOut={handleTooltipMouseLeave}
            >
                <div className="diary-settings-divider flex items-center justify-between border-b border-border-subtle px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                        {SETTINGS_TABS.map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                className={[
                                    "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                                    activeSettingsTab === tab.value
                                        ? "bg-[rgba(127,127,127,0.10)] text-[var(--color-text-main)]"
                                        : "text-[var(--color-text-muted)] hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)]",
                                ].join(" ")}
                                onClick={() => setActiveSettingsTab(tab.value)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
                    {activeSettingsTab === 'properties' ? (
                        <>
                            <div
                                className="diary-settings-panel mt-1 rounded-md border border-dashed border-border-subtle"
                                onDragOver={(e) => {
                                    if (!draggingPropertyId) return;
                                    e.preventDefault();
                                }}
                                onDrop={(e) => handleDropPropertyOnSection(e, null)}
                            >
                                <div
                                    className={[
                                        "diary-settings-divider flex items-center justify-between border-border-subtle px-2 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]",
                                        unclassifiedItems.length > 0 ? "border-b" : "",
                                    ].join(" ")}
                                >
                                    <span>미분류</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            className="rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
                                            onClick={() => handleCreateSection(null)}
                                            disabled={createSection.isPending}
                                        >
                                            섹션추가
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
                                            onClick={() => handleCreateProperty(null)}
                                            disabled={createProperty.isPending}
                                        >
                                            속성추가
                                        </button>
                                    </div>
                                </div>
                                {unclassifiedItems.map(renderPropertyRow)}
                            </div>

                            {rootSections.map((section) => renderSection(section))}

                            {(properties || []).length === 0 && (
                                <p className="px-2 py-5 text-xs ui-dialog-message">
                                    아직 추가된 속성이 없어.
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="mt-1">
                            {renderViewSettings(
                                VIEW_OPTIONS.find((option) => option.value === activeSettingsTab),
                            )}
                        </div>
                    )}
                </div>
            </div>
            <DiarySettingsTooltip tooltip={titleTooltip} />
            {editingOptionProperty && (
                <PropertyOptionsDialog
                    property={editingOptionProperty}
                    options={optionsByPropertyId.get(editingOptionProperty.id) || []}
                    onCreate={handleCreatePropertyOption}
                    onUpdate={handleUpdatePropertyOption}
                    onDelete={handleDeletePropertyOption}
                    onClose={() => setEditingOptionProperty(null)}
                />
            )}
        </div>
    );

    if (typeof document === 'undefined') return dialog;

    const portalRoot = document.getElementById('portal-root');
    return createPortal(dialog, portalRoot ?? document.body);
}
