// src/features/wiki/ActivityCalendar.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DiaryEditor from './DiaryEditor';
import DiarySettings from './DiarySettings';
import { PropertyIcon } from './DiaryPropertyUtils';
import { useDiariesByDateRange } from './hooks/useDiariesByDateRange';
import { useDiaryProperties } from './hooks/useDiaryProperties';
import { useDiaryViewLayout, useDiaryViewSetting } from './hooks/useDiaryViewLayout';
import { useHolidays } from './hooks/useHolidays';
import { useAllDocuments } from './hooks/useAllDocuments';
import { useCategories } from './hooks/useCategories';
import OptionBadge from './OptionBadge';
import {
    buildOptionMetaMap,
    mergeLatestOptionMeta,
    normalizeOptionValue,
    normalizeOptionValues,
} from './DiarySelectUtils';
import { useDiaryPropertyOptions } from './hooks/useDiaryPropertyOptions';
import { parseInternalLinks } from '../../lib/internalLinkParser';
import { useWikiLinkTooltip, WikiLinkTooltip } from './WikiLinkTooltip';

const VIEW_LABEL = {
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    timeline: 'TIMELINE',
};

function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
}

function getWeekStart(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - start.getDay());
    return start;
}

function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNextDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return getDateKey(new Date(year, month - 1, day + 1));
}

function getPropertyDisplayName(name) {
    const displayName = String(name || '').trim();
    return displayName === '새 속성' ? '' : displayName;
}

function LinkedDiaryText({ text, documents = [], categories = [] }) {
    const value = String(text ?? '');
    const html = value.includes('[[')
        ? parseInternalLinks(value, documents, categories)
        : value;

    if (!value.includes('[[')) return <>{value}</>;

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function getInternalLinkHref(target) {
    return target?.closest?.('a.wiki-internal-link')?.getAttribute('href') || '';
}

function isInternalLinkClick(e) {
    return !!getInternalLinkHref(e.target);
}

function getPropertyValueText(property, value) {
    if (!value) return '';

    if (property?.type === 'period') {
        return [value.start, value.end].filter(Boolean).join(' ~ ');
    }

    if (property?.type === 'multi_select') {
        return normalizeOptionValues(value.options)
            .map((option) => option.name)
            .join(', ');
    }

    if (property?.type === 'select') {
        return normalizeOptionValue(value.option)?.name || '';
    }

    if (property?.type === 'number_list') {
        return Array.isArray(value.numbers)
            ? value.numbers.filter((item) => item !== null && item !== undefined && item !== '').join(', ')
            : '';
    }

    if (property?.type === 'check_list') {
        return Array.isArray(value.items)
            ? value.items
                .map((item) => {
                    const text = typeof item === 'string' ? item : item.text;
                    if (!String(text || '').trim()) return '';
                    return item.checked ? `✓ ${text}` : text;
                })
                .filter(Boolean)
                .join(', ')
            : '';
    }

    if (property?.type === 'number') return value.number ?? '';
    if (property?.type === 'date') return value.date || '';
    return value.text || '';
}

function getPropertyValueLines(property, value, optionMetaMap) {
    if (!value) return [];

    if (property?.type === 'select') {
        const option = mergeLatestOptionMeta(value.option, optionMetaMap);
        return option ? [{ ...option, type: 'option' }] : [];
    }

    if (property?.type === 'multi_select') {
        return normalizeOptionValues(value.options)
            .map((option) => mergeLatestOptionMeta(option, optionMetaMap))
            .filter(Boolean)
            .map((option) => ({
                ...option,
                type: 'option',
            }));
    }

    if (property?.type === 'number_list') {
        return Array.isArray(value.numbers)
            ? value.numbers
                .filter((item) => item !== null && item !== undefined && item !== '')
                .map((item) => String(item))
            : [];
    }

    if (property?.type === 'check_list') {
        return Array.isArray(value.items)
            ? value.items
                .map((item) => {
                    const text = typeof item === 'string' ? item : item.text;
                    if (!String(text || '').trim()) return null;

                    return {
                        checked: typeof item === 'string' ? false : !!item.checked,
                        text,
                    };
                })
                .filter(Boolean)
            : [];
    }

    const text = getPropertyValueText(property, value);
    return String(text || '').trim() ? [text] : [];
}

function buildViewItems(properties = [], viewLayout = []) {
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
                property,
                propertyId: property.id,
                visibility: layoutItem?.visibility || 'hidden',
                displayMode: layoutItem?.displayMode || 'icon_name',
                sortOrder: property.sort_order ?? index,
            };
        })
        .filter((item) => item.visibility === 'visible')
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getDiaryValueMap(diary) {
    return new Map(
        (diary?.diary_property_values || []).map((item) => [
            item.property_id,
            item.value,
        ]),
    );
}

function renderDiaryProperties(
    diary,
    viewItems,
    showTitle = false,
    viewType = 'monthly',
    optionMapByPropertyId = new Map(),
    documents = [],
    categories = [],
    className = '',
) {
    if (!diary || (viewItems.length === 0 && !showTitle)) return null;

    const valueMap = getDiaryValueMap(diary);
    const rows = viewItems
        .map((item) => ({
            ...item,
            lines: getPropertyValueLines(
                item.property,
                valueMap.get(item.propertyId),
                optionMapByPropertyId.get(item.propertyId),
            ),
        }))
        .filter((item) => item.lines.length > 0);

    if (rows.length === 0 && !showTitle) return null;

    const isWeekly = viewType === 'weekly';

    const wrapperGapClass = isWeekly ? 'space-y-2' : 'space-y-[1px]';
    const propertyLineClass = isWeekly ? 'leading-[1.45]' : 'leading-[1.25]';

    const contentTextClass = '[color:color-mix(in_srgb,var(--color-text-main)_74%,var(--color-text-muted))]';
    const blockTextTypes = ['textarea', 'long_text', 'text_area'];
    const titleTextClass = isWeekly ? 'text-[14px]' : 'text-[11px]';
    const propertyTextClass = isWeekly ? 'text-[12px]' : 'text-[11px]';

    const iconBoxClass = isWeekly
        ? 'mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center'
        : 'mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center';

    const listItemGapClass = isWeekly ? 'gap-1' : 'gap-1';

    return (
        <div
            className={[
                wrapperGapClass,
                isWeekly ? 'diary-calendar-link-weekly' : 'diary-calendar-link-monthly',
                className,
            ].join(" ")}
        >
            {showTitle && diary.title && (
                isWeekly ? (
                    <div className="mb-3 border-b border-border-subtle pb-2">
                        <p
                            className={[
                                "flex items-center line-clamp-2 min-h-[38px] break-words font-semibold leading-snug text-[var(--color-text-main)]",
                                titleTextClass,
                            ].join(" ")}
                            title={diary.title}
                        >
                            {diary.title}
                        </p>
                    </div>
                ) : (
                    <p
                        className={[
                            "break-words font-semibold leading-snug text-[var(--color-text-main)]",
                            titleTextClass,
                        ].join(" ")}
                    >
                        {diary.title}
                    </p>
                )
            )}
            {rows.map((item, index) => {
                const name = getPropertyDisplayName(item.property?.name);
                const showIcon = ['icon_name', 'icon'].includes(item.displayMode);
                const showName = ['icon_name', 'name'].includes(item.displayMode);
                const isListProperty = ['check_list', 'number_list'].includes(item.property?.type);
                const isOptionProperty = ['select', 'multi_select'].includes(item.property?.type);
                const prevSectionId = rows[index - 1]?.property?.section_id ?? null;
                const currentSectionId = item.property?.section_id ?? null;
                const hasSectionSeparator = index > 0 && prevSectionId !== currentSectionId;

                const propertyType = item.property?.type;
                const isTextProperty = blockTextTypes.includes(propertyType);
                const hasPropertyHeader = (showIcon && item.property?.icon) || (showName && name);
                const shouldRenderTextAsBlock = isTextProperty && hasPropertyHeader;
                const textContentClass = isTextProperty
                    ? isWeekly
                        ? 'leading-[1.65] text-justify'
                        : 'leading-[1.55] text-justify'
                    : '';

                const blockTextIndentClass =
                    showIcon && item.property?.icon
                        ? isWeekly
                            ? 'pl-[2px]'
                            : 'pl-[2px]'
                        : '';
                const listWrapperClass = isWeekly
                    ? hasPropertyHeader
                        ? 'mt-1 space-y-1'
                        : 'mt-0 space-y-1'
                    : hasPropertyHeader
                        ? 'mt-0.5 space-y-0'
                        : 'mt-0 space-y-0';

                return (
                    <div
                        key={item.propertyId}
                        className={[
                            'min-w-0 break-words text-[var(--color-text-muted)]',
                            propertyTextClass,
                            propertyLineClass,
                            hasSectionSeparator
                                ? isWeekly
                                    ? 'border-t border-dashed border-[rgba(82,154,246,0.42)] pt-2'
                                    : 'border-t border-dashed border-[rgba(82,154,246,0.22)] pt-1'
                                : '',
                            !isWeekly && isOptionProperty ? 'pb-1' : '',
                        ].join(' ')}
                    >
                        <div className="flex min-w-0 items-start gap-[3px]">
                            {showIcon && item.property?.icon && (
                                <span className={iconBoxClass}>
                                    <PropertyIcon icon={item.property.icon}/>
                                </span>
                            )}

                            <span
                                className={[
                                    'min-w-0 break-words',
                                    isOptionProperty ? 'mt-[1px]' : 'mt-[2px]',
                                ].join(' ')}
                            >
                                {showName && name && (
                                    <span className="font-semibold text-[var(--color-text-main)]">
                                        {name}
                                    </span>
                                )}

                                {isOptionProperty && (
                                    <span
                                        className={[
                                            showName && name ? 'ml-1.5' : '',
                                            'inline-flex flex-wrap items-center align-middle',
                                            isWeekly ? 'gap-x-1 gap-y-1.5' : 'gap-[3px]',
                                        ].join(' ')}
                                    >
                                    {item.lines.map((option, index) => (
                                        <OptionBadge
                                            key={`${option.name}-${index}`}
                                            option={option}
                                            compact={!isWeekly}
                                        />
                                    ))}
                                </span>
                                )}

                                {!isListProperty && !isOptionProperty && !shouldRenderTextAsBlock && (
                                    <span
                                        className={[
                                            showName && name ? 'ml-1.5' : '',
                                            contentTextClass,
                                            textContentClass,
                                        ].join(' ')}
                                    >
                                            <LinkedDiaryText
                                                text={item.lines[0]}
                                                documents={documents}
                                                categories={categories}
                                            />
                                        </span>
                                )}
                                </span>
                        </div>

                        {shouldRenderTextAsBlock && (
                            <div
                                className={[
                                    'mt-[3px] min-w-0 break-words',
                                    blockTextIndentClass,
                                    contentTextClass,
                                    textContentClass,
                                ].join(' ')}
                            >
                                <LinkedDiaryText
                                    text={item.lines[0]}
                                    documents={documents}
                                    categories={categories}
                                />
                            </div>
                        )}

                        {isListProperty && (
                            <div className={listWrapperClass}>
                                {item.lines.map((line, index) => (
                                    <div
                                        key={index}
                                        className={['flex min-w-0 items-start break-words', listItemGapClass].join(' ')}
                                    >
                                        {item.property?.type === 'check_list' ? (
                                            <span
                                                className="mt-[1px] ml-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                                            {line.checked ? (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    className="h-[18px] w-[18px]"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        clipRule="evenodd"
                                                        d="M6.2 4.2h11.6a2 2 0 0 1 2 2v11.6a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2Zm10.2 5.6-1.5-1.3-4.2 4.8-1.7-1.7-1.4 1.4 3.2 3.2 5.6-6.4Z"
                                                    />
                                                </svg>
                                            ) : (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    className="h-[18px] w-[18px]"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.6"
                                                    aria-hidden="true"
                                                >
                                                    <rect
                                                        x="5"
                                                        y="5"
                                                        width="14"
                                                        height="14"
                                                        rx="1.2"
                                                    />
                                                </svg>
                                            )}
                                        </span>
                                        ) : (
                                            <span
                                                className={[
                                                    'w-4 shrink-0 text-right text-[var(--color-text-main)]',
                                                    isWeekly ? '' : 'mt-[2px]',
                                                ].join(' ')}
                                            >
                                                {index + 1}.
                                            </span>
                                        )}
                                        <span
                                            className={[
                                                'min-w-0 break-words',
                                                contentTextClass,
                                                item.property?.type === 'check_list' && line.checked === false
                                                    ? 'rounded bg-red-100 px-1 py-[1px]'
                                                    : '',
                                                isWeekly ? '' : 'mt-[2px]',
                                            ].join(' ')}
                                        >
                                            <LinkedDiaryText
                                                text={line.text ?? line}
                                                documents={documents}
                                                categories={categories}
                                            />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function getDayTextColor(dayIndex, isHoliday = false) {
    if (isHoliday) return '#ef4444';
    if (dayIndex === 0) return '#ef4444';
    if (dayIndex === 6) return '#3b82f6';
    return 'var(--color-text-main)';
}

function CalendarDropdown({ value, label, options, onChange, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={'relative ' + className} ref={menuRef}>
            <button
                type="button"
                className="ui-input flex h-[30px] w-full items-center justify-between gap-2 !rounded-md !px-2.5 !py-0 !text-left !text-[12px]"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
            >
                <span className="min-w-0 truncate">{label}</span>
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

            {isOpen && (
                <div
                    className="absolute right-0 top-[34px] z-30 max-h-72 w-full overflow-y-auto rounded-md border py-1 text-[12px] shadow-lg"
                    style={{
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
                </div>
            )}
        </div>
    );
}

export default function ActivityCalendar() {
    const navigate = useNavigate();
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1~12
    const [calendarView, setCalendarView] = useState('monthly');
    const [editorDate, setEditorDate] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [weekDate, setWeekDate] = useState(
        () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const { data: holidays } = useHolidays(year);
    const { data: properties } = useDiaryProperties();
    const { data: viewLayout } = useDiaryViewLayout(calendarView);
    const { data: viewSetting } = useDiaryViewSetting(calendarView);
    const { data: propertyOptions } = useDiaryPropertyOptions();
    const { data: allDocs } = useAllDocuments();
    const { data: categories } = useCategories();
    const rootRef = useRef(null);
    const getRoot = useCallback(() => rootRef.current, []);
    const wikiLinkTooltip = useWikiLinkTooltip(getRoot, true);
    const handleInternalLinkClickCapture = useCallback((e) => {
        const href = getInternalLinkHref(e.target);
        if (!href) return;

        e.preventDefault();
        e.stopPropagation();
        navigate(href);
    }, [navigate]);

    const optionMapByPropertyId = useMemo(() => {
        const grouped = new Map();

        (propertyOptions || []).forEach((option) => {
            const propertyId = option.property_id;
            grouped.set(propertyId, [...(grouped.get(propertyId) || []), option]);
        });

        return new Map(
            [...grouped.entries()].map(([propertyId, options]) => [
                propertyId,
                buildOptionMetaMap(options),
            ]),
        );
    }, [propertyOptions]);

    const holidayDateSet = new Set((holidays || []).map((holiday) => holiday.holiday_date));

    const handleChangeCalendarView = (nextView) => {
        if (nextView === 'weekly' && calendarView !== 'weekly') {
            const isThisMonth =
                year === today.getFullYear() &&
                month === today.getMonth() + 1;
            const day = isThisMonth ? today.getDate() : 1;
            setWeekDate(new Date(year, month - 1, day));
        }

        setCalendarView(nextView);
    };

    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0(일)~6(토)
    const daysInMonth = new Date(year, month, 0).getDate();

    const weeks = [];
    let day = 1 - startWeekday;

    for (let w = 0; w < 6; w++) {
        const week = [];
        for (let i = 0; i < 7; i += 1, day += 1) {
            if (day < 1 || day > daysInMonth) week.push(null);
            else week.push(day);
        }
        weeks.push(week);
    }
    const visibleWeeks = weeks.filter((week) => week.some((d) => d));

    const handlePrevMonth = () => {
        setMonth((m) => {
            if (m === 1) {
                setYear((y) => y - 1);
                return 12;
            }
            return m - 1;
        });
    };

    const handleNextMonth = () => {
        setMonth((m) => {
            if (m === 12) {
                setYear((y) => y + 1);
                return 1;
            }
            return m + 1;
        });
    };

    const handleMoveWeek = (amount) => {
        const next = addDays(weekDate, amount);
        setWeekDate(next);
        setYear(next.getFullYear());
        setMonth(next.getMonth() + 1);
    };

    const handlePrev = () => {
        if (calendarView === 'weekly') {
            handleMoveWeek(-7);
            return;
        }
        if (calendarView === 'timeline') {
            setYear((y) => y - 1);
            return;
        }
        handlePrevMonth();
    };

    const handleNext = () => {
        if (calendarView === 'weekly') {
            handleMoveWeek(7);
            return;
        }
        if (calendarView === 'timeline') {
            setYear((y) => y + 1);
            return;
        }
        handleNextMonth();
    };

    const handleToday = () => {
        const next = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        setYear(next.getFullYear());
        setMonth(next.getMonth() + 1);
        setWeekDate(next);
    };

    const handleOpenDiary = (dateKey) => {
        setEditorDate(dateKey);
    };

    const weekStart = getWeekStart(weekDate);
    const weekDays = Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
    const todayKey = getDateKey(today);
    const monthStartKey = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndKey = getDateKey(new Date(year, month, 1));
    const yearStartKey = `${year}-01-01`;
    const yearEndKey = `${year + 1}-01-01`;
    const weekStartKey = getDateKey(weekStart);
    const weekEndKey = getNextDateKey(getDateKey(weekDays[6]));
    const rangeStartKey =
        calendarView === 'weekly'
            ? weekStartKey
            : calendarView === 'timeline'
                ? yearStartKey
                : monthStartKey;
    const rangeEndKey =
        calendarView === 'weekly'
            ? weekEndKey
            : calendarView === 'timeline'
                ? yearEndKey
                : monthEndKey;
    const { data: diaries } = useDiariesByDateRange(
        rangeStartKey,
        rangeEndKey,
        calendarView === 'weekly' || calendarView === 'monthly' || calendarView === 'timeline',
    );
    const diaryMap = new Map((diaries || []).map((diary) => [diary.diary_date, diary]));
    const viewItems = buildViewItems(properties || [], viewLayout || []);
    const showDiaryTitle = ['weekly', 'monthly'].includes(calendarView) && !!viewSetting?.show_title;

    const yearOptions = [];
    const baseYear = today.getFullYear();
    for (let y = baseYear - 3; y <= baseYear + 1; y += 1) {
        yearOptions.push(y);
    }
    const monthOptions = Array.from({ length: 12 }).map((_, i) => i + 1);

    return (
        <div
            ref={rootRef}
            className="h-full min-h-0 text-xs"
            onMouseDownCapture={handleInternalLinkClickCapture}
            onClickCapture={handleInternalLinkClickCapture}
        >
            <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 border-b border-border-subtle pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {['weekly', 'monthly', 'timeline'].map((view) => (
                                <button
                                    key={view}
                                    type="button"
                                    onClick={() => handleChangeCalendarView(view)}
                                    className={
                                        'rounded-full border px-3.5 py-1 text-[13px] font-semibold tracking-[0.02em] transition ' +
                                        (calendarView === view
                                            ? 'text-[var(--color-text-main)]'
                                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-panel-bg)]')
                                    }
                                    style={
                                        calendarView === view
                                            ? {
                                                backgroundColor: 'var(--color-page-surface-2)',
                                                borderColor: 'var(--color-border-subtle)',
                                            }
                                            : {
                                                borderColor: 'transparent',
                                            }
                                    }
                                >
                                    {VIEW_LABEL[view]}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => handleOpenDiary(todayKey)}
                                className="ui-control flex h-8 w-8 items-center justify-center rounded-full"
                                aria-label="작성"
                                title="작성"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M15.8 4.8l3.4 3.4" />
                                    <path d="M6.2 17.8l3.5-.7 9.1-9.1a2.4 2.4 0 0 0-3.4-3.4l-9.1 9.1-.7 3.5a.5.5 0 0 0 .6.6z" />
                                    <path d="M5 20h14" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(true)}
                                className="ui-control flex h-8 w-8 items-center justify-center rounded-full"
                                aria-label="다이어리 설정"
                                title="다이어리 설정"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" />
                                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 0 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8a2 2 0 0 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 .9-1.6V2.8a2 2 0 0 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6.9h.2a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1z" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {calendarView === 'monthly' ? (
                                <>
                                    <CalendarDropdown
                                        className="w-[86px]"
                                        value={year}
                                        label={`${year}년`}
                                        options={yearOptions.map((y) => ({ value: y, label: `${y}년` }))}
                                        onChange={setYear}
                                    />
                                    <CalendarDropdown
                                        className="w-[70px]"
                                        value={month}
                                        label={`${month}월`}
                                        options={monthOptions.map((m) => ({ value: m, label: `${m}월` }))}
                                        onChange={setMonth}
                                    />
                                </>
                            ) : (
                                <span
                                    className="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
                                    style={{
                                        backgroundColor: 'var(--color-page-surface-2)',
                                        borderColor: 'var(--color-border-subtle)',
                                        color: 'var(--color-text-main)',
                                    }}
                                >
                                    {calendarView === 'timeline' ? `${year}년` : `${year}년 ${month}월`}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="ui-control h-6 w-6 rounded-full"
                                aria-label="이전"
                            >
                                <svg
                                    viewBox="0 0 20 20"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M12.5 5L7.5 10l5 5" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={handleToday}
                                className="rounded px-1.5 py-1 text-[12px] font-medium"
                                style={{ color: 'var(--color-text-main)' }}
                            >
                                오늘
                            </button>
                            <button
                                type="button"
                                onClick={handleNext}
                                className="ui-control h-6 w-6 rounded-full"
                                aria-label="다음"
                            >
                                <svg
                                    viewBox="0 0 20 20"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M7.5 5l5 5-5 5" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-auto pt-3">
                    {calendarView === 'timeline' ? (
                        <div className="min-h-0 flex-1 overflow-x-auto pb-2 text-[12px]">
                            <div className="grid min-w-[980px] grid-cols-[120px_repeat(12,minmax(72px,1fr))] border-l border-t border-border-subtle">
                                <div className="border-b border-r border-border-subtle px-2 py-2" />
                                {monthOptions.map((timelineMonth) => (
                                    <div
                                        key={timelineMonth}
                                        className="border-b border-r border-border-subtle px-2 py-2 text-center font-semibold"
                                        style={{
                                            color: 'var(--color-text-main)',
                                        }}
                                    >
                                        {timelineMonth}월
                                    </div>
                                ))}

                                {viewItems.map((item) => {
                                    const name = getPropertyDisplayName(item.property?.name);
                                    const showIcon = ['icon_name', 'icon'].includes(item.displayMode);
                                    const showName = ['icon_name', 'name'].includes(item.displayMode);

                                    return (
                                        <div key={item.propertyId} className="contents">
                                            <div className="flex min-w-0 items-start gap-1 break-words border-b border-r border-border-subtle px-2 py-2 font-semibold text-[var(--color-text-main)]">
                                                {showIcon && item.property?.icon && (
                                                    <span className={iconBoxClass}>
                                                        <PropertyIcon icon={item.property.icon}/>
                                                    </span>
                                                )}
                                                {showName && (
                                                    <span className="min-w-0 break-words">
                                                        {name || '속성명 없음'}
                                                    </span>
                                                )}
                                            </div>
                                            {monthOptions.map((timelineMonth) => {
                                                const monthDiaries = (diaries || []).filter((diary) => {
                                                    const [, diaryMonth] = String(diary.diary_date || '').split('-');
                                                    return Number(diaryMonth) === timelineMonth;
                                                });
                                                const values = monthDiaries
                                                    .map((diary) => {
                                                        const value = getDiaryValueMap(diary).get(item.propertyId);
                                                        const text = getPropertyValueText(item.property, value);

                                                        if (!String(text || '').trim()) return null;

                                                        return {
                                                            date: String(diary.diary_date || '').slice(8, 10),
                                                            text,
                                                        };
                                                    })
                                                    .filter(Boolean);

                                                return (
                                                    <div
                                                        key={`${item.propertyId}-${timelineMonth}`}
                                                        className="min-h-[72px] space-y-1 border-b border-r border-border-subtle px-2 py-2"
                                                    >
                                                        {values.map((value, index) => (
                                                            <p
                                                                key={`${value.date}-${index}`}
                                                                className="break-words text-[11px] leading-snug text-[var(--color-text-muted)]"
                                                            >
                                                                <span className="font-semibold text-[var(--color-text-main)]">
                                                                    {value.date}: {' '}
                                                                </span>
                                                                <span>{value.text}</span>
                                                            </p>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>

                            {viewItems.length === 0 && (
                                <p className="px-2 py-5 text-xs ui-dialog-message">
                                    TIMELINE에 표시할 속성이 없어.
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid shrink-0 grid-cols-7 pb-[7px] text-[11.5px]">
                                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                                    <div
                                        key={d}
                                        className="px-2 py-1 text-center font-medium"
                                        style={{ color: 'var(--color-text-main)' }}
                                    >
                                        {d}
                                    </div>
                                ))}
                            </div>

                            <div
                                className={
                                    'grid grid-cols-7 border-l border-t border-border-subtle text-[11px] ' +
                                    (calendarView === 'weekly' ? 'min-h-0 flex-1' : '')
                                }
                            >
                                {calendarView === 'monthly' ? (
                                    visibleWeeks.map((week, wi) =>
                                        week.map((d, di) => {
                                            if (!d) {
                                                return (
                                                    <div
                                                        key={`${wi}-${di}`}
                                                        className="h-[146px] border-b border-r border-border-subtle bg-transparent"
                                                    />
                                                );
                                            }

                                            const key = `${year}-${String(month).padStart(
                                                2,
                                                '0',
                                            )}-${String(d).padStart(2, '0')}`;
                                            const isToday = key === todayKey;
                                            const isHoliday = holidayDateSet.has(key);
                                            const diary = diaryMap.get(key);

                                            return (
                                                <button
                                                    type="button"
                                                    key={`${wi}-${di}`}
                                                    onClick={(e) => {
                                                        if (isInternalLinkClick(e)) return;
                                                        handleOpenDiary(key);
                                                    }}
                                                    className="flex h-[146px] flex-col overflow-hidden border-b border-r border-border-subtle px-2 py-1.5 text-left transition hover:bg-[var(--color-panel-bg)]"
                                                >
                                                    <div className="flex items-start justify-end">
                                                        <span
                                                            className={
                                                                'inline-flex h-[20px] w-[20px] items-center justify-center rounded-full text-[12px] leading-none ' +
                                                                (isToday ? 'bg-red-500 text-white' : '')
                                                            }
                                                            style={isToday ? undefined : { color: getDayTextColor(di, isHoliday) }}
                                                        >
                                                            {d}
                                                        </span>
                                                    </div>
                                                    {diary && (
                                                        <div className="mt-2 min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
                                                            {renderDiaryProperties(diary, viewItems, showDiaryTitle, 'monthly', optionMapByPropertyId, allDocs || [], categories || [])}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        }),
                                    )
                                ) : (
                                    weekDays.map((date) => {
                                        const key = getDateKey(date);
                                        const isToday = key === todayKey;
                                        const isHoliday = holidayDateSet.has(key);
                                        const diary = diaryMap.get(key);

                                        return (
                                            <button
                                                type="button"
                                                key={key}
                                                onClick={(e) => {
                                                    if (isInternalLinkClick(e)) return;
                                                    handleOpenDiary(key);
                                                }}
                                                className="flex min-h-[34rem] flex-col border-b border-r border-border-subtle px-2 py-2 text-left transition hover:bg-[var(--color-panel-bg)]"
                                            >
                                                <div className="flex items-start justify-end">
                                                    <span
                                                        className={
                                                            'inline-flex h-[24px] w-[24px] items-center justify-center rounded-full text-[12px] leading-none ' +
                                                            (isToday ? 'bg-red-500 text-white' : '')
                                                        }
                                                        style={isToday ? undefined : { color: getDayTextColor(date.getDay(), isHoliday) }}
                                                    >
                                                        {date.getDate()}
                                                    </span>
                                                </div>
                                                {diary && (
                                                    <div className="mt-3 min-w-0">
                                                        {renderDiaryProperties(diary, viewItems, showDiaryTitle, 'weekly', optionMapByPropertyId, allDocs || [], categories || [])}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <DiaryEditor
                open={!!editorDate}
                diaryDate={editorDate}
                onClose={() => setEditorDate(null)}
            />
            <DiarySettings
                open={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
            <WikiLinkTooltip tooltip={wikiLinkTooltip} />
        </div>
    );
}
