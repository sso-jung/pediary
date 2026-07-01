// src/features/wiki/ActivityCalendar.jsx
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useAuthStore } from '../../store/authStore';
import { upsertDiaryPropertyValue } from '../../lib/wikiApi';

const VIEW_LABEL = {
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    timeline: 'TIMELINE',
};

const TIMELINE_GROUP_GAP_DAYS = 31;
const TIMELINE_LANE_GAP = 38;
const TIMELINE_MOBILE_LANE_GAP = 30;
const TIMELINE_MIN_VISUAL_DAYS = 22;
const TIMELINE_TEXT_MIN_WIDTH = 50;
const TIMELINE_PROPERTY_TYPES = ['select', 'multi_select'];
const CALENDAR_VIEW_STORAGE_KEY_PREFIX = 'pediary.diaryCalendar.viewState';
const CALENDAR_VIEWS = ['weekly', 'monthly', 'timeline'];
const MOBILE_MEDIA_QUERY = '(max-width: 639px)';
const MOBILE_TIMELINE_MONTH_COUNT = 4;
const MOBILE_EDGE_TAP_RATIO = 0.24;

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

function getTimelineWindowStartMonth(month) {
    return Math.floor((month - 1) / MOBILE_TIMELINE_MONTH_COUNT) * MOBILE_TIMELINE_MONTH_COUNT + 1;
}

function getMobileTimelineStartDate(date) {
    return new Date(date.getFullYear(), date.getMonth() - 2, 1);
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

function hasInternalLinkValue(value) {
    if (!value) return false;
    if (typeof value === 'string') return value.includes('[[');
    if (Array.isArray(value)) return value.some(hasInternalLinkValue);
    if (typeof value === 'object') return Object.values(value).some(hasInternalLinkValue);
    return false;
}

function isWhiteColor(color) {
    return String(color || '').trim().toLowerCase() === '#ffffff';
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

function parseDateKey(dateKey) {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    return new Date(year, month - 1, day);
}

function getDayOfYear(dateKey) {
    const date = parseDateKey(dateKey);
    const start = new Date(date.getFullYear(), 0, 1);

    return Math.floor((date - start) / 86400000) + 1;
}

function getDaysInYear(year) {
    return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function formatShortDate(dateKey) {
    const [, month, day] = String(dateKey || '').split('-');
    return `${Number(month)}/${Number(day)}`;
}

function getDateDiffDays(fromDateKey, toDateKey) {
    const from = parseDateKey(fromDateKey);
    const to = parseDateKey(toDateKey);

    return Math.floor((to - from) / 86400000);
}

function getTimelineDisplayValues(property, value, optionMetaMap) {
    if (!value) return [];

    if (property?.type === 'select') {
        const option = mergeLatestOptionMeta(value.option, optionMetaMap);
        return option ? [{ text: option.name, option }] : [];
    }

    if (property?.type === 'multi_select') {
        return normalizeOptionValues(value.options)
            .map((option) => mergeLatestOptionMeta(option, optionMetaMap))
            .filter(Boolean)
            .map((option) => ({ text: option.name, option }));
    }

    const text = String(getPropertyValueText(property, value) || '').trim();
    return text ? [{ text }] : [];
}

function getTimelineOptionLink(option) {
    return String(option?.link || '').trim();
}

function getPopupLinkHref(link) {
    const value = String(link || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value)) return value;
    return `https://${value}`;
}

function setTimelineOptionLink(value, propertyType, optionName, link) {
    const nextLink = String(link || '').trim();

    const updateOption = (option) => {
        const normalized = normalizeOptionValue(option);
        if (!normalized) return option;
        if (normalized.name !== optionName) return option;

        const nextOption = { ...normalized };

        if (nextLink) {
            nextOption.link = nextLink;
        } else {
            delete nextOption.link;
        }

        return nextOption;
    };

    if (propertyType === 'select') {
        return {
            ...(value || {}),
            option: updateOption(value?.option),
        };
    }

    if (propertyType === 'multi_select') {
        return {
            ...(value || {}),
            options: normalizeOptionValues(value?.options).map(updateOption),
        };
    }

    return value;
}

function buildTimelineSegments({
                                   diaries = [],
                                   diaryValueMapByDate = new Map(),
                                   property,
                                   propertyId,
                                   optionMetaMap,
                               }) {
    const points = (diaries || [])
        .flatMap((diary) => {
            const value = diaryValueMapByDate.get(diary.diary_date)?.get(propertyId);
            const displayValues = getTimelineDisplayValues(property, value, optionMetaMap);

            if (displayValues.length === 0) return [];

            return displayValues.map((display) => ({
                dateKey: diary.diary_date,
                text: display.text,
                option: display.option,
                link: getTimelineOptionLink(display.option),
                propertyId,
                propertyType: property?.type,
            }));
        })
        .sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));

    const segmentsByText = new Map();

    points.forEach((point) => {
        const key = point.text;
        const segments = segmentsByText.get(key) || [];
        const last = segments[segments.length - 1];

        if (
            last &&
            getDateDiffDays(last.lastSeenDateKey, point.dateKey) < TIMELINE_GROUP_GAP_DAYS
        ) {
            last.endDateKey = point.dateKey;
            last.lastSeenDateKey = point.dateKey;
            last.dateKeys = [...(last.dateKeys || []), point.dateKey];
            last.link = last.link || point.link;
            return;
        }

        segments.push({
            text: point.text,
            option: point.option,
            link: point.link,
            propertyId: point.propertyId,
            propertyType: point.propertyType,
            startDateKey: point.dateKey,
            endDateKey: point.dateKey,
            lastSeenDateKey: point.dateKey,
            dateKeys: [point.dateKey],
        });

        segmentsByText.set(key, segments);
    });

    return [...segmentsByText.values()]
        .flat()
        .sort(
            (a, b) =>
                String(a.startDateKey).localeCompare(String(b.startDateKey)) ||
                String(a.endDateKey).localeCompare(String(b.endDateKey)),
        );
}
function assignTimelineLanes(segments = []) {
    const lanes = [];

    return segments.map((segment) => {
        const startDay = getDayOfYear(segment.startDateKey);
        const endDay = getDayOfYear(segment.endDateKey);
        const isSingleDay = segment.startDateKey === segment.endDateKey;
        const visualEndDay = isSingleDay ? startDay + 4 : Math.max(endDay, startDay + TIMELINE_MIN_VISUAL_DAYS);

        let laneIndex = lanes.findIndex((laneEndDay) => startDay > laneEndDay);

        if (laneIndex < 0) {
            laneIndex = lanes.length;
            lanes.push(visualEndDay);
        } else {
            lanes[laneIndex] = visualEndDay;
        }

        return {
            ...segment,
            laneIndex,
            startDay,
            endDay,
        };
    });
}

function getTimelineLaneOffset(laneIndex = 0) {
    if (laneIndex === 0) return 0;

    const distance = Math.ceil(laneIndex / 2);
    return laneIndex % 2 === 1 ? -distance : distance;
}

function TimelineTooltip({ tooltip }) {
    if (!tooltip) return null;

    const margin = 12;
    const maxWidth = Math.min(260, window.innerWidth - margin * 2);
    const x = Math.min(Math.max(tooltip.x, margin + maxWidth / 2), window.innerWidth - margin - maxWidth / 2);
    const y = Math.min(Math.max(tooltip.y, margin), window.innerHeight - margin - 48);

    return createPortal(
        <div
            className="diary-timeline-tooltip pointer-events-none fixed z-[9999] rounded-lg px-3 py-2 text-[11px] font-semibold leading-snug text-white shadow-xl"
            style={{
                left: x,
                top: y,
                transform: 'translate(-50%, 13px)',
                backgroundColor: tooltip.backgroundColor || 'rgb(30 41 59)',
                color: tooltip.color || '#fff',
                whiteSpace: 'normal',
                maxWidth,
            }}
        >
            {tooltip.text}
            <span
                aria-hidden
                className="diary-timeline-tooltip-arrow absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45"
                style={{
                    top: -4,
                    backgroundColor: tooltip.backgroundColor || 'rgb(30 41 59)',
                }}
            />
        </div>,
        document.body,
    );
}

function TimelineSegmentBar({ segment, year, timelineWidth, timelineRange, isMobileView, onOpenLink, onOpenLinkDialog, onTooltipShow, onTooltipHide }) {
    const longPressTimerRef = useRef(null);
    const longPressTriggeredRef = useRef(false);
    const daysInYear = getDaysInYear(year);
    const rangeStartKey = timelineRange?.startKey;
    const rangeEndKey = timelineRange?.endKey;
    const rangeDays = rangeStartKey && rangeEndKey
        ? getDateDiffDays(rangeStartKey, rangeEndKey)
        : daysInYear;

    const startDay = rangeStartKey
        ? Math.max(getDateDiffDays(rangeStartKey, segment.startDateKey), 0)
        : segment.startDay ?? getDayOfYear(segment.startDateKey);
    const endDay = rangeStartKey && rangeEndKey
        ? Math.min(getDateDiffDays(rangeStartKey, segment.endDateKey), rangeDays)
        : segment.endDay ?? getDayOfYear(segment.endDateKey);

    if (rangeStartKey && rangeEndKey) {
        const segmentEndBeforeRange = getDateDiffDays(segment.endDateKey, rangeStartKey) > 0;
        const segmentStartAfterRange = getDateDiffDays(rangeEndKey, segment.startDateKey) >= 0;

        if (segmentEndBeforeRange || segmentStartAfterRange) return null;
    }

    const isSingleDay = segment.startDateKey === segment.endDateKey;
    const left = rangeStartKey
        ? ((startDay + 0.5) / rangeDays) * 100
        : ((startDay - 0.5) / daysInYear) * 100;
    const width = Math.max(((endDay - startDay) / rangeDays) * 100, 0.25);
    const segmentWidth = timelineWidth * width / 100;
    const showText = segmentWidth >= TIMELINE_TEXT_MIN_WIDTH;

    const dateText = isSingleDay
        ? formatShortDate(segment.startDateKey)
        : `${formatShortDate(segment.startDateKey)}~${formatShortDate(segment.endDateKey)}`;
    const segmentColor = segment.option?.color || 'var(--color-page-surface-2)';
    const segmentTextColor =
        segment.option?.textColor ||
        segment.option?.text_color ||
        'var(--color-text-main)';
    const hasTextColorBorder = isWhiteColor(segmentColor);
    const laneOffset = getTimelineLaneOffset(segment.laneIndex || 0);
    const laneGap = isMobileView ? TIMELINE_MOBILE_LANE_GAP : TIMELINE_LANE_GAP;
    const laneY = `calc(50% + ${laneOffset * laneGap}px)`;
    const handleTooltipShow = (target) => {
        const rect = target.getBoundingClientRect();

        onTooltipShow?.({
            text: `${dateText} · ${segment.text}`,
            x: rect.left + rect.width / 2,
            y: rect.bottom + (isSingleDay ? 8 : 0),
            backgroundColor: segmentColor,
            color: segmentTextColor,
        });
    };
    const handleTouchStart = (e) => {
        if (!isMobileView) return;

        longPressTriggeredRef.current = false;
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            onTooltipHide?.();
            onOpenLink?.(segment);
        }, 520);
    };
    const handleTouchEnd = () => {
        if (!isMobileView) return;

        window.clearTimeout(longPressTimerRef.current);
    };
    const handleSegmentClick = (e) => {
        e.stopPropagation();

        if (isMobileView) {
            if (longPressTriggeredRef.current) {
                longPressTriggeredRef.current = false;
                return;
            }

            handleTooltipShow(e.currentTarget);
            return;
        }

        onOpenLink?.(segment);
    };
    const handleSegmentContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isMobileView) {
            onOpenLink?.(segment);
            return;
        }

        onOpenLinkDialog?.(segment);
    };

    if (isSingleDay) {
        return (
            <button
                type="button"
                className="diary-timeline-segment diary-timeline-segment-dot absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition hover:scale-125"
                style={{
                    left: `${left}%`,
                    top: laneY,
                    backgroundColor: segmentColor,
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onMouseEnter={(e) => !isMobileView && handleTooltipShow(e.currentTarget)}
                onMouseLeave={onTooltipHide}
                onClick={handleSegmentClick}
                onContextMenu={handleSegmentContextMenu}
                aria-label={`${dateText} ${segment.text}`}
            >
                <span className="sr-only">{segment.text}</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            className={[
                'diary-timeline-segment absolute flex min-w-0 items-center justify-center overflow-hidden rounded-full border text-[11px] font-semibold transition hover:-translate-y-px hover:brightness-95',
                'h-6',
                showText ? 'px-2' : 'px-0',
            ].join(' ')}
            style={{
                left: `${left}%`,
                top: `calc(50% + ${laneOffset * laneGap}px - 12px)`,
                width: `${width}%`,
                minWidth: showText ? undefined : 6,
                backgroundColor: segmentColor,
                borderColor: hasTextColorBorder ? segmentTextColor : 'transparent',
                color: segmentTextColor,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onMouseEnter={(e) => !isMobileView && handleTooltipShow(e.currentTarget)}
            onMouseLeave={onTooltipHide}
            onClick={handleSegmentClick}
            onContextMenu={handleSegmentContextMenu}
        >
            {showText && (
                <span className="truncate">
                    {segment.text}
                </span>
            )}
        </button>
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
    const textValueTypes = ['text', 'textarea', 'long_text', 'longText', 'text_area'];
    const blockTextTypes = ['textarea', 'long_text', 'longText', 'text_area'];
    const titleTextClass = isWeekly ? 'text-[14px]' : 'text-[11px]';
    const propertyTextClass = isWeekly ? 'text-[12px]' : 'text-[11px]';

    const iconBoxClass = isWeekly
        ? 'mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center'
        : 'mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center';

    const listItemGapClass = isWeekly ? 'gap-1' : 'gap-1';
    const blockTextBottomPaddingPx = isWeekly ? 7 : 4;
    const checkedListBottomPaddingPx = isWeekly ? 7 : 4;

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
                    <div className="diary-calendar-title-divider mb-[18px] border-b border-border-subtle pb-[10px]">
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
                const isTextProperty = textValueTypes.includes(propertyType);
                const isBlockTextProperty = blockTextTypes.includes(propertyType);
                const hasCheckListItem =
                    item.property?.type === 'check_list' &&
                    item.lines.length > 0;
                const hasPropertyHeader = (showIcon && item.property?.icon) || (showName && name);
                const shouldRenderTextAsBlock = isBlockTextProperty && hasPropertyHeader;
                const hasVisibleName = showName && !!name;
                const isMonthlyIconOnlyText =
                    !isWeekly &&
                    showIcon &&
                    item.property?.icon &&
                    !hasVisibleName &&
                    isTextProperty &&
                    !isBlockTextProperty;
                const textContentClass = isTextProperty
                    ? isWeekly
                        ? isBlockTextProperty
                            ? 'whitespace-pre-wrap leading-[1.7] text-justify'
                            : 'leading-[1.65] text-justify'
                        : 'leading-[1.55] text-justify'
                    : '';

                const blockTextIndentClass =
                    showIcon && item.property?.icon
                        ? isWeekly
                            ? 'px-[1px]'
                            : 'px-[1px]'
                        : '';
                const listWrapperClass = isWeekly
                    ? hasPropertyHeader
                        ? 'mt-1 space-y-1'
                        : 'mt-0 space-y-1'
                    : hasPropertyHeader
                        ? 'mt-0.5 space-y-0'
                        : 'mt-0 space-y-0';

                return (
                    <Fragment key={item.propertyId}>
                        {hasSectionSeparator && isWeekly && (
                            <div className="pt-2 pb-3" aria-hidden="true">
                                <div className="diary-calendar-section-divider border-t border-dashed border-[rgba(127,127,127,0.22)]" />
                            </div>
                        )}

                        <div
                            className={[
                                'min-w-0 break-words text-[var(--color-text-muted)]',
                                propertyTextClass,
                                propertyLineClass,
                                !isWeekly && isOptionProperty ? 'pb-1' : '',
                                isWeekly && !isOptionProperty ? 'pb-[2px]' : '' ,
                                !isWeekly && !isOptionProperty ? 'pb-[1px]' : '',
                                isMonthlyIconOnlyText ? 'mb-1' : '',
                            ].join(' ')}
                            style={
                                isBlockTextProperty
                                    ? { paddingBottom: blockTextBottomPaddingPx }
                                    : hasCheckListItem
                                        ? { paddingBottom: checkedListBottomPaddingPx }
                                        : undefined
                            }
                        >
                        <div className={['flex min-w-0 items-start',
                            isWeekly && isOptionProperty ? 'mb-2' : '',
                            isWeekly ? 'gap-[5px]' : 'gap-[3px]',
                        ].join(' ')}
                        >
                            {showIcon && item.property?.icon && (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                                    <PropertyIcon icon={item.property.icon}/>
                                </span>
                            )}

                            <span
                                className={[
                                    'min-w-0 break-words',
                                    isOptionProperty
                                        ? isWeekly
                                            ? 'relative -top-[2.5px]'
                                            : ''
                                        : isMonthlyIconOnlyText
                                            ? 'relative -top-[1px]'
                                        : isWeekly && isTextProperty
                                            ? 'relative -top-[1px]'
                                            : 'mt-[2px]',
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
                                            'inline-flex max-w-full flex-wrap items-center overflow-hidden align-middle',
                                            isWeekly ? 'gap-x-0.5 gap-y-0.5 sm:gap-x-1 sm:gap-y-1.5' : 'gap-[3px]',
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
                                    isWeekly ? 'mt-0 relative top-[4px] min-w-0 break-words' : 'mt-[3px] min-w-0 break-words',
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
                                                    className="diary-check-empty-icon h-[18px] w-[18px]"
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
                                                    ? 'diary-check-unchecked-text rounded bg-red-100 px-1 py-[1px]'
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
                    </Fragment>
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

function TimelineMonthHeader({ year, startMonth = 1, monthCount = 12 }) {
    const rangeStartKey = getDateKey(new Date(year, startMonth - 1, 1));
    const rangeEndKey = getDateKey(new Date(year, startMonth - 1 + monthCount, 1));
    const rangeDays = getDateDiffDays(rangeStartKey, rangeEndKey);

    return (
        <div className="relative h-9">
            {Array.from({ length: monthCount }).map((_, index) => {
                const month = startMonth + index;
                const monthStart = new Date(year, index, 1);
                monthStart.setMonth(month - 1);
                const monthEnd = new Date(year, month, 1);
                const displayMonth = monthStart.getMonth() + 1;
                const monthDays = getDateDiffDays(getDateKey(monthStart), getDateKey(monthEnd));
                const startDay = getDateDiffDays(rangeStartKey, getDateKey(monthStart));

                const left = (startDay / rangeDays) * 100;
                const width = (monthDays / rangeDays) * 100;

                return (
                    <div
                        key={month}
                        className="absolute top-0 flex h-full items-center justify-center text-[11px] font-semibold"
                        style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            color: 'color-mix(in_srgb,var(--color-text-muted)_78%,transparent)',
                        }}
                    >
                        {displayMonth}월
                    </div>
                );
            })}
        </div>
    );
}

function TimelineMonthGuides({ year, startMonth = 1, monthCount = 12 }) {
    const rangeStartKey = getDateKey(new Date(year, startMonth - 1, 1));
    const rangeEndKey = getDateKey(new Date(year, startMonth - 1 + monthCount, 1));
    const rangeDays = getDateDiffDays(rangeStartKey, rangeEndKey);

    return (
        <>
            {Array.from({ length: monthCount }).map((_, index) => {
                const month = startMonth + index;
                const monthStart = new Date(year, index, 1);
                monthStart.setMonth(month - 1);
                const startDay = getDateDiffDays(rangeStartKey, getDateKey(monthStart));
                const left = (startDay / rangeDays) * 100;

                return (
                    <span
                        key={index}
                        aria-hidden
                        className="diary-timeline-month-guide pointer-events-none absolute bottom-0 top-0 border-l border-dashed"
                        style={{
                            left: `${left}%`,
                            borderLeftColor: 'rgba(100, 116, 139, 0.24)',
                        }}
                    />
                );
            })}
            <span
                aria-hidden
                className="diary-timeline-month-guide pointer-events-none absolute bottom-0 top-0 border-l border-dashed"
                style={{
                    left: 'calc(100% - 1px)',
                    borderLeftColor: 'rgba(100, 116, 139, 0.24)',
                }}
            />
        </>
    );
}

function TimelineTodayGuide({ year, showMarker = false, startMonth = 1, monthCount = 12 }) {
    const today = new Date();

    if (today.getFullYear() !== year) return null;

    const rangeStartKey = getDateKey(new Date(year, startMonth - 1, 1));
    const rangeEndKey = getDateKey(new Date(year, startMonth - 1 + monthCount, 1));
    const todayKey = getDateKey(today);
    const todayOffset = getDateDiffDays(rangeStartKey, todayKey);
    const rangeDays = getDateDiffDays(rangeStartKey, rangeEndKey);

    if (todayOffset < 0 || todayOffset >= rangeDays) return null;

    const left = ((todayOffset + 0.5) / rangeDays) * 100;

    return (
        <span
            aria-hidden
            className="diary-timeline-today-guide pointer-events-none absolute bottom-0 top-0 z-30 w-3 -translate-x-1/2"
            style={{
                left: `${left}%`,
            }}
        >
            <span
                className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2"
                style={{
                    background: 'repeating-linear-gradient(to bottom, rgba(226, 154, 170, 1) 0px, rgba(202, 95, 120, 0.92) 64px, rgba(226, 154, 170, 1) 128px, rgba(202, 95, 120, 0.92) 192px, rgba(226, 154, 170, 1) 256px)',
                }}
            />
            {showMarker && (
                <span
                    className="absolute left-1/2 top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 bg-white"
                    style={{
                        borderColor: 'rgba(226, 154, 170, 1)',
                        boxShadow: '0 0 0 4px rgba(226, 154, 170, 0.24)',
                    }}
                />
            )}
        </span>
    );
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
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const userId = user?.id;
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1~12
    const [calendarView, setCalendarView] = useState('weekly');
    const [editorDate, setEditorDate] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [weekDate, setWeekDate] = useState(
        () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const viewStorageLoadedRef = useRef(false);
    const skipViewStorageSaveRef = useRef(false);
    const viewStorageKey = userId ? `${CALENDAR_VIEW_STORAGE_KEY_PREFIX}.${userId}` : null;
    const { data: holidays } = useHolidays(year);
    const { data: properties } = useDiaryProperties();
    const { data: viewLayout } = useDiaryViewLayout(calendarView);
    const { data: viewSetting } = useDiaryViewSetting(calendarView);
    const { data: propertyOptions } = useDiaryPropertyOptions();
    const [timelineTooltip, setTimelineTooltip] = useState(null);
    const [timelineLinkDialog, setTimelineLinkDialog] = useState(null);
    const [timelineLinkInput, setTimelineLinkInput] = useState('');
    const [timelineWidth, setTimelineWidth] = useState(0);
    const [timelineStartDate, setTimelineStartDate] = useState(() =>
        getMobileTimelineStartDate(today),
    );
    const [isMobileView, setIsMobileView] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    });
    const rootRef = useRef(null);
    const timelineAreaRef = useRef(null);
    const swipeTouchRef = useRef(null);
    const swipeBlockClickRef = useRef(false);
    const getRoot = useCallback(() => rootRef.current, []);
    const wikiLinkTooltip = useWikiLinkTooltip(getRoot, true);
    const handleInternalLinkClickCapture = useCallback((e) => {
        const href = getInternalLinkHref(e.target);
        if (!href) return;

        e.preventDefault();
        e.stopPropagation();
        if (calendarView === 'weekly' || calendarView === 'monthly') {
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
        }

        navigate(href);
    }, [calendarView, navigate]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const media = window.matchMedia(MOBILE_MEDIA_QUERY);
        const handleChange = () => {
            setIsMobileView(media.matches);
        };

        handleChange();
        media.addEventListener('change', handleChange);

        return () => media.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        if (calendarView !== 'timeline') return;
        const element = timelineAreaRef.current;
        if (!element) return;

        const updateTimelineWidth = () => {
            setTimelineWidth(element.getBoundingClientRect().width);
        };

        updateTimelineWidth();

        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(updateTimelineWidth);
        observer.observe(element);

        return () => observer.disconnect();
    }, [calendarView]);

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

    useEffect(() => {
        viewStorageLoadedRef.current = false;
        skipViewStorageSaveRef.current = false;

        if (!viewStorageKey) return;

        try {
            const saved = JSON.parse(localStorage.getItem(viewStorageKey) || 'null');
            skipViewStorageSaveRef.current = !!saved;
            if (CALENDAR_VIEWS.includes(saved?.calendarView)) {
                setCalendarView(saved.calendarView);
            }
            if (Number.isInteger(saved?.year)) {
                setYear(saved.year);
            }
            if (Number.isInteger(saved?.month) && saved.month >= 1 && saved.month <= 12) {
                setMonth(saved.month);
            }
            if (saved?.weekDate) {
                const nextWeekDate = parseDateKey(saved.weekDate);
                if (!Number.isNaN(nextWeekDate.getTime())) {
                    setWeekDate(nextWeekDate);
                }
            }
        } catch {
            // 저장값이 깨졌을 때는 기본 WEEKLY 상태로 둔다.
        } finally {
            viewStorageLoadedRef.current = true;
        }
    }, [viewStorageKey]);

    useEffect(() => {
        if (!viewStorageKey || !viewStorageLoadedRef.current) return;

        if (skipViewStorageSaveRef.current) {
            skipViewStorageSaveRef.current = false;
            return;
        }

        try {
            localStorage.setItem(viewStorageKey, JSON.stringify({
                calendarView,
                year,
                month,
                weekDate: getDateKey(weekDate),
            }));
        } catch {
            // 저장할 수 없는 환경이면 현재 화면 상태만 유지한다.
        }
    }, [calendarView, month, viewStorageKey, weekDate, year]);

    const handleChangeCalendarView = (nextView) => {
        if (nextView === 'weekly' && calendarView !== 'weekly') {
            const isThisMonth =
                year === today.getFullYear() &&
                month === today.getMonth() + 1;
            const day = isThisMonth ? today.getDate() : 1;
            setWeekDate(new Date(year, month - 1, day));
        }

        if (nextView === 'timeline' && calendarView !== 'timeline' && isMobileView) {
            const next = getMobileTimelineStartDate(today);
            setYear(next.getFullYear());
            setTimelineStartDate(next);
        }

        setCalendarView(nextView);
    };

    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0(일)~6(토)
    const monthCalendarStart = addDays(firstDay, -startWeekday);
    const weeks = [];
    let currentDate = monthCalendarStart;

    for (let w = 0; w < 6; w++) {
        const week = [];
        for (let i = 0; i < 7; i += 1) {
            week.push(currentDate);
            currentDate = addDays(currentDate, 1);
        }
        weeks.push(week);
    }
    const visibleWeeks = weeks.filter((week) =>
        week.some((date) => date.getFullYear() === year && date.getMonth() === month - 1),
    );
    const monthCalendarEndKey = getNextDateKey(getDateKey(visibleWeeks[visibleWeeks.length - 1][6]));

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

    const handleMoveTimelineWindow = (amount) => {
        const next = new Date(timelineStartDate.getFullYear(), timelineStartDate.getMonth() + amount, 1);
        setYear(next.getFullYear());
        setTimelineStartDate(next);
    };

    const handlePrev = () => {
        if (calendarView === 'weekly') {
            handleMoveWeek(isMobileView ? -1 : -7);
            return;
        }
        if (calendarView === 'timeline') {
            if (isMobileView) {
                handleMoveTimelineWindow(-1);
                return;
            }
            setYear((y) => y - 1);
            return;
        }
        handlePrevMonth();
    };

    const handleNext = () => {
        if (calendarView === 'weekly') {
            handleMoveWeek(isMobileView ? 1 : 7);
            return;
        }
        if (calendarView === 'timeline') {
            if (isMobileView) {
                handleMoveTimelineWindow(1);
                return;
            }
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
        setTimelineStartDate(getMobileTimelineStartDate(next));
    };

    const handleCalendarTouchStart = (e) => {
        if (!isMobileView) return;
        if (calendarView !== 'weekly' && calendarView !== 'monthly' && calendarView !== 'timeline') return;

        const touch = e.touches?.[0];
        if (!touch) return;

        swipeTouchRef.current = {
            x: touch.clientX,
            y: touch.clientY,
        };
    };

    const handleCalendarTouchEnd = (e) => {
        if (!isMobileView) return;
        if (calendarView !== 'weekly' && calendarView !== 'monthly' && calendarView !== 'timeline') return;

        const start = swipeTouchRef.current;
        swipeTouchRef.current = null;
        const touch = e.changedTouches?.[0];
        if (!start || !touch) return;

        const diffX = touch.clientX - start.x;
        const diffY = touch.clientY - start.y;
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);

        if (absX < 54 || absX < absY * 1.3) return;

        swipeBlockClickRef.current = true;
        window.setTimeout(() => {
            swipeBlockClickRef.current = false;
        }, 0);

        const currentIndex = CALENDAR_VIEWS.indexOf(calendarView);
        const nextIndex = diffX > 0
            ? Math.max(currentIndex - 1, 0)
            : Math.min(currentIndex + 1, CALENDAR_VIEWS.length - 1);

        if (nextIndex !== currentIndex) {
            handleChangeCalendarView(CALENDAR_VIEWS[nextIndex]);
        }
    };

    const handleCalendarClickCapture = (e) => {
        if (!swipeBlockClickRef.current) return;

        e.preventDefault();
        e.stopPropagation();
    };

    const handleCalendarEdgeTapCapture = (e) => {
        if (!isMobileView) return;
        if (calendarView !== 'monthly' && calendarView !== 'timeline') return;
        if (swipeBlockClickRef.current) return;
        if (isInternalLinkClick(e)) return;
        if (e.target.closest?.('.diary-timeline-segment')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const edgeWidth = rect.width * MOBILE_EDGE_TAP_RATIO;

        if (x < edgeWidth) {
            e.preventDefault();
            e.stopPropagation();
            handlePrev();
            return;
        }

        if (x > rect.width - edgeWidth) {
            e.preventDefault();
            e.stopPropagation();
            handleNext();
        }
    };

    const handleOpenDiary = (dateKey) => {
        setEditorDate(dateKey);
    };

    const saveTimelineLinkMutation = useMutation({
        mutationFn: async ({ segment, link }) => {
            const dateKeys = segment?.dateKeys?.length
                ? segment.dateKeys
                : [segment?.startDateKey].filter(Boolean);

            await Promise.all(
                dateKeys.map((dateKey) => {
                    const value = diaryValueMapByDate.get(dateKey)?.get(segment.propertyId);
                    const nextValue = setTimelineOptionLink(
                        value,
                        segment.propertyType,
                        segment.text,
                        link,
                    );

                    return upsertDiaryPropertyValue({
                        userId,
                        diaryDate: dateKey,
                        propertyId: segment.propertyId,
                        value: nextValue,
                    });
                }),
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diaries', userId] });
        },
    });

    const handleOpenTimelineLink = (segment) => {
        const href = getPopupLinkHref(segment?.link);
        if (!href) return;

        window.open(href, '_blank', 'noopener,noreferrer');
    };

    const handleOpenTimelineLinkDialog = (segment) => {
        setTimelineTooltip(null);
        setTimelineLinkDialog(segment);
        setTimelineLinkInput(segment?.link || '');
    };

    const handleSaveTimelineLink = async () => {
        if (!timelineLinkDialog) return;

        try {
            await saveTimelineLinkMutation.mutateAsync({
                segment: timelineLinkDialog,
                link: timelineLinkInput,
            });

            setTimelineLinkDialog(null);
            setTimelineLinkInput('');
        } catch (err) {
            console.error(err);
        }
    };

    const weekStart = getWeekStart(weekDate);
    const weekDays = Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
    const todayKey = getDateKey(today);
    const yearStartKey = `${year}-01-01`;
    const yearEndKey = `${year + 1}-01-01`;
    const weekStartKey = getDateKey(weekStart);
    const weekEndKey = getNextDateKey(getDateKey(weekDays[6]));
    const timelineMonthCount = isMobileView ? MOBILE_TIMELINE_MONTH_COUNT : 12;
    const timelineRangeStartDate = isMobileView
        ? timelineStartDate
        : new Date(year, 0, 1);
    const timelineRangeEndDate = new Date(
        timelineRangeStartDate.getFullYear(),
        timelineRangeStartDate.getMonth() + timelineMonthCount,
        1,
    );
    const timelineRangeStartMonth = timelineRangeStartDate.getMonth() + 1;
    const timelineRange = useMemo(() => ({
        startKey: getDateKey(timelineRangeStartDate),
        endKey: getDateKey(timelineRangeEndDate),
    }), [timelineRangeEndDate, timelineRangeStartDate]);
    const timelineRangeEndMonthDate = addDays(timelineRangeEndDate, -1);
    const timelineRangeLabel = isMobileView
        ? timelineRangeStartDate.getFullYear() === timelineRangeEndMonthDate.getFullYear()
            ? `${timelineRangeStartDate.getFullYear()}년 ${timelineRangeStartMonth}월~${timelineRangeEndMonthDate.getMonth() + 1}월`
            : `${timelineRangeStartDate.getFullYear()}년 ${timelineRangeStartMonth}월~${timelineRangeEndMonthDate.getFullYear()}년 ${timelineRangeEndMonthDate.getMonth() + 1}월`
        : `${year}년`;
    const rangeStartKey =
        calendarView === 'weekly'
            ? weekStartKey
            : calendarView === 'timeline'
                ? timelineRange.startKey
                : getDateKey(visibleWeeks[0][0]);
    const rangeEndKey =
        calendarView === 'weekly'
            ? weekEndKey
            : calendarView === 'timeline'
                ? timelineRange.endKey
                : monthCalendarEndKey;
    const viewItems = useMemo(
        () => {
            const items = buildViewItems(properties || [], viewLayout || []);

            if (calendarView !== 'timeline') return items;

            return items.filter((item) => TIMELINE_PROPERTY_TYPES.includes(item.property?.type));
        },
        [calendarView, properties, viewLayout],
    );
    const visiblePropertyIds = useMemo(
        () => viewItems.map((item) => item.propertyId),
        [viewItems],
    );
    const { data: diaries } = useDiariesByDateRange(
        rangeStartKey,
        rangeEndKey,
        calendarView === 'weekly' || calendarView === 'monthly' || calendarView === 'timeline',
        visiblePropertyIds,
    );
    const hasDiaryInternalLinks = (diaries || []).some(hasInternalLinkValue);
    const { data: allDocs } = useAllDocuments(hasDiaryInternalLinks);
    const { data: categories } = useCategories(hasDiaryInternalLinks);
    const diaryMap = useMemo(
        () => new Map((diaries || []).map((diary) => [diary.diary_date, diary])),
        [diaries],
    );
    const diaryValueMapByDate = useMemo(
        () => new Map((diaries || []).map((diary) => [diary.diary_date, getDiaryValueMap(diary)])),
        [diaries],
    );
    const showDiaryTitle = ['weekly', 'monthly'].includes(calendarView) && !!viewSetting?.show_title;
    const timelineSegmentsByPropertyId = useMemo(() => {
        if (calendarView !== 'timeline') return new Map();

        return new Map(
            viewItems.map((item) => {
                const rawSegments = buildTimelineSegments({
                    diaries: diaries || [],
                    diaryValueMapByDate,
                    property: item.property,
                    propertyId: item.propertyId,
                    optionMetaMap: optionMapByPropertyId.get(item.propertyId),
                });

                return [item.propertyId, assignTimelineLanes(rawSegments)];
            }),
        );
    }, [calendarView, diaries, diaryValueMapByDate, optionMapByPropertyId, viewItems]);

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
                <div className="diary-calendar-toolbar-divider shrink-0 border-b border-border-subtle pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-nowrap items-center gap-1 sm:gap-2">
                            {['weekly', 'monthly', 'timeline'].map((view) => (
                                <button
                                    key={view}
                                    type="button"
                                    onClick={() => handleChangeCalendarView(view)}
                                    className={
                                        'rounded-full border px-2.5 py-1 text-[12px] font-semibold tracking-[0.02em] transition sm:px-3.5 sm:text-[13px] ' +
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
                                    {view === 'weekly' && isMobileView ? 'TODAY' : VIEW_LABEL[view]}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => handleOpenDiary(todayKey)}
                                className="ui-control flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8"
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
                                className="ui-control flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8"
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
                                    {calendarView === 'timeline' ? timelineRangeLabel : `${year}년 ${month}월`}
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
                        <div
                            className="min-h-0 flex-1 overflow-x-hidden pb-2 text-[12px] sm:overflow-x-auto"
                            onTouchStart={handleCalendarTouchStart}
                            onTouchEnd={handleCalendarTouchEnd}
                            onClickCapture={(e) => {
                                handleCalendarEdgeTapCapture(e);
                                handleCalendarClickCapture(e);
                            }}
                        >
                            <div className="relative min-w-0 sm:min-w-[1080px]">
                                <div className="pointer-events-none absolute bottom-[-10px] left-[70px] right-0 top-0 z-30 overflow-hidden sm:left-[118px] sm:overflow-visible">
                                    <TimelineTodayGuide
                                        year={year}
                                        showMarker
                                        startMonth={timelineRangeStartMonth}
                                        monthCount={timelineMonthCount}
                                    />
                                </div>
                                <div className="grid grid-cols-[60px_minmax(0,1fr)] sm:grid-cols-[118px_minmax(900px,1fr)]">
                                    <div className="py-2 pr-1 sm:px-2" />
                                    <div ref={timelineAreaRef} className="relative ml-2.5 sm:ml-0">
                                        <TimelineMonthHeader
                                            year={year}
                                            startMonth={timelineRangeStartMonth}
                                            monthCount={timelineMonthCount}
                                        />
                                    </div>

                                    {viewItems.map((item, index) => {
                                        const name = getPropertyDisplayName(item.property?.name);
                                        const showIcon = ['icon_name', 'icon'].includes(item.displayMode);
                                        const showName = ['icon_name', 'name'].includes(item.displayMode);
                                        const timelineLaneGap = isMobileView ? TIMELINE_MOBILE_LANE_GAP : TIMELINE_LANE_GAP;

                                        const segments = timelineSegmentsByPropertyId.get(item.propertyId) || [];
                                        const visibleSegments = segments.filter((segment) => {
                                            const segmentEndBeforeRange = getDateDiffDays(segment.endDateKey, timelineRange.startKey) > 0;
                                            const segmentStartAfterRange = getDateDiffDays(timelineRange.endKey, segment.startDateKey) >= 0;

                                            return !segmentEndBeforeRange && !segmentStartAfterRange;
                                        });
                                        const maxLaneOffset = Math.max(
                                            0,
                                            ...visibleSegments.map((segment) => Math.abs(getTimelineLaneOffset(segment.laneIndex || 0))),
                                        );
                                        const baseRowHeight = isMobileView ? 30 : 54;
                                        const rowHeight = Math.max(baseRowHeight, baseRowHeight + maxLaneOffset * timelineLaneGap * 2);

                                        return (
                                            <div key={item.propertyId} className="contents">
                                                <div
                                                    className="diary-timeline-section-divider flex min-w-0 items-center gap-1 py-1 pr-1 font-semibold text-[var(--color-text-main)] sm:px-2 sm:py-2"
                                                    style={{
                                                        height: rowHeight,
                                                        borderTop: index > 0 ? '3px double rgba(232, 184, 194, 0) ' : undefined,
                                                    }}
                                                >
                                                    {showIcon && item.property?.icon && (
                                                        <span
                                                            className="flex h-4 w-4 shrink-0 items-center justify-center">
                                        <PropertyIcon icon={item.property.icon}/>
                                    </span>
                                                    )}

                                                    {showName && (
                                                        <span className="min-w-0 break-keep text-[11px] leading-tight sm:break-words sm:text-[12px]">
                                        {name || '속성명 없음'}
                                    </span>
                                                    )}
                                                </div>

                                                <div
                                                    className="diary-timeline-row diary-timeline-section-divider relative ml-2.5 rounded-lg sm:ml-0"
                                                    style={{
                                                        height: rowHeight,
                                                        borderTop: index > 0 ? '3px double rgba(232, 184, 194, 0) ' : undefined,
                                                    }}
                                                >
                                                    <TimelineMonthGuides
                                                        year={year}
                                                        startMonth={timelineRangeStartMonth}
                                                        monthCount={timelineMonthCount}
                                                    />
                                                    <span
                                                        aria-hidden
                                                        className="diary-timeline-line pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
                                                        style={{
                                                            backgroundColor: 'rgba(100, 116, 139, 0.18)',
                                                        }}
                                                    />
                                                    {visibleSegments.length === 0 ? (
                                                        <span
                                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--color-text-muted)] opacity-50">
            기록 없음
        </span>
                                                    ) : (
                                                        visibleSegments.map((segment, index) => (
                                                            <TimelineSegmentBar
                                                                key={`${segment.startDateKey}-${segment.endDateKey}-${segment.text}-${index}`}
                                                                segment={segment}
                                                                year={year}
                                                                timelineWidth={timelineWidth}
                                                                timelineRange={timelineRange}
                                                                isMobileView={isMobileView}
                                                                onOpenLink={handleOpenTimelineLink}
                                                                onOpenLinkDialog={handleOpenTimelineLinkDialog}
                                                                onTooltipShow={setTimelineTooltip}
                                                                onTooltipHide={() => setTimelineTooltip(null)}
                                                            />
                                                        ))
                                                    )}
                                                </div>
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
                        </div>
                    ) : (
                        <div
                            className="min-h-0 flex-1 overflow-x-auto pb-2"
                            onTouchStart={handleCalendarTouchStart}
                            onTouchEnd={handleCalendarTouchEnd}
                            onClickCapture={(e) => {
                                handleCalendarEdgeTapCapture(e);
                                handleCalendarClickCapture(e);
                            }}
                        >
                            <div className={calendarView === 'weekly' ? (isMobileView ? 'flex h-full min-w-0 flex-col' : 'flex h-full min-w-[720px] flex-col sm:min-w-0') : 'min-w-0'}>
                                {calendarView === 'weekly' && isMobileView ? (
                                    (() => {
                                        const key = getDateKey(weekDate);
                                        const isCurrentMonth = weekDate.getFullYear() === year && weekDate.getMonth() === month - 1;
                                        const isToday = key === todayKey;
                                        const isHoliday = holidayDateSet.has(key);
                                        const diary = diaryMap.get(key);
                                        const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][weekDate.getDay()];

                                        return (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    if (isInternalLinkClick(e)) return;

                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const x = e.clientX - rect.left;
                                                    const edgeWidth = rect.width * 0.24;

                                                    if (x < edgeWidth) {
                                                        handlePrev();
                                                        return;
                                                    }

                                                    if (x > rect.width - edgeWidth) {
                                                        handleNext();
                                                        return;
                                                    }

                                                    handleOpenDiary(key);
                                                }}
                                                className="diary-calendar-cell flex min-h-[28rem] flex-col overflow-hidden border border-border-subtle px-3 py-3 text-left transition sm:hidden"
                                                style={isCurrentMonth ? undefined : { backgroundColor: 'rgba(148, 163, 184, 0.08)' }}
                                            >
                                                <div className="mb-1 flex items-center justify-between pb-0">
                                                    <span
                                                        className="text-[13px] font-semibold"
                                                        style={{ color: isCurrentMonth ? getDayTextColor(weekDate.getDay(), isHoliday) : 'color-mix(in_srgb,var(--color-text-muted)_64%,transparent)' }}
                                                    >
                                                        {`${weekDate.getFullYear()}년 ${weekDate.getMonth() + 1}월 ${weekDate.getDate()}일 (${dayLabel})`}
                                                    </span>
                                                    <span
                                                        className={
                                                            'diary-today-marker inline-flex h-[24px] w-[24px] items-center justify-center rounded-full text-[12px] leading-none ' +
                                                            (isToday ? 'bg-red-500 text-white' : '')
                                                        }
                                                        style={
                                                            isToday
                                                                ? undefined
                                                                : {
                                                                    color: isCurrentMonth
                                                                        ? getDayTextColor(weekDate.getDay(), isHoliday)
                                                                        : 'color-mix(in_srgb,var(--color-text-muted)_64%,transparent)',
                                                                }
                                                        }
                                                    >
                                                        {weekDate.getDate()}
                                                    </span>
                                                </div>
                                                {diary ? (
                                                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
                                                        {renderDiaryProperties(diary, viewItems, showDiaryTitle, 'weekly', optionMapByPropertyId, allDocs || [], categories || [])}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-1 items-center justify-center text-[12px] text-[var(--color-text-muted)]">
                                                        작성된 다이어리가 없어.
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })()
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
                                        'diary-calendar-grid grid grid-cols-7 border-l border-t border-border-subtle text-[11px] ' +
                                        (calendarView === 'weekly' ? 'min-h-0 flex-1' : '')
                                    }
                                >
                                {calendarView === 'monthly' ? (
                                    visibleWeeks.map((week, wi) =>
                                        week.map((date, di) => {
                                            const key = getDateKey(date);
                                            const isCurrentMonth = date.getFullYear() === year && date.getMonth() === month - 1;
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
                                                    className="diary-calendar-cell flex h-[64px] flex-col overflow-hidden border-b border-r border-border-subtle px-1 py-1 text-left transition hover:bg-[var(--color-panel-bg)] sm:h-[146px] sm:px-2 sm:py-1.5"
                                                    style={isCurrentMonth ? undefined : { backgroundColor: 'rgba(148, 163, 184, 0.08)' }}
                                                >
                                                    <div className="flex items-start justify-end">
                                                        <span
                                                            className={
                                                                'diary-today-marker inline-flex h-[20px] w-[20px] items-center justify-center rounded-full text-[12px] leading-none ' +
                                                                (isToday ? 'bg-red-500 text-white' : '')
                                                            }
                                                            style={
                                                                isToday
                                                                    ? undefined
                                                                    : {
                                                                        color: isCurrentMonth
                                                                            ? getDayTextColor(di, isHoliday)
                                                                            : 'color-mix(in_srgb,var(--color-text-muted)_64%,transparent)',
                                                                    }
                                                            }
                                                        >
                                                            {date.getDate()}
                                                        </span>
                                                    </div>
                                                    {diary && (
                                                        <>
                                                            {diary.title ? (
                                                                <p
                                                                    className="mt-1 line-clamp-2 min-w-0 break-words text-[9px] font-semibold leading-tight text-[var(--color-text-main)] sm:hidden"
                                                                    title={diary.title}
                                                                >
                                                                    {diary.title}
                                                                </p>
                                                            ) : (
                                                                <div
                                                                    className="mx-auto mt-2 h-1.5 w-1.5 rounded-full sm:hidden"
                                                                    style={{ backgroundColor: 'var(--color-accent)' }}
                                                                />
                                                            )}
                                                            <div className="diary-monthly-cell-scroll mt-2 hidden min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 sm:block">
                                                                {renderDiaryProperties(diary, viewItems, showDiaryTitle, 'monthly', optionMapByPropertyId, allDocs || [], categories || [])}
                                                            </div>
                                                        </>
                                                    )}
                                                </button>
                                            );
                                        }),
                                    )
                                ) : (
                                    weekDays.map((date) => {
                                        const key = getDateKey(date);
                                        const isCurrentMonth = date.getFullYear() === year && date.getMonth() === month - 1;
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
                                                className="diary-calendar-cell flex min-h-[34rem] flex-col overflow-hidden border-b border-r border-border-subtle px-2 py-2 text-left transition hover:bg-[var(--color-panel-bg)]"
                                                style={isCurrentMonth ? undefined : { backgroundColor: 'rgba(148, 163, 184, 0.08)' }}
                                            >
                                                <div className="flex items-start justify-end">
                                                    <span
                                                        className={
                                                            'diary-today-marker inline-flex h-[24px] w-[24px] items-center justify-center rounded-full text-[12px] leading-none ' +
                                                            (isToday ? 'bg-red-500 text-white' : '')
                                                        }
                                                        style={
                                                            isToday
                                                                ? undefined
                                                                : {
                                                                    color: isCurrentMonth
                                                                        ? getDayTextColor(date.getDay(), isHoliday)
                                                                        : 'color-mix(in_srgb,var(--color-text-muted)_64%,transparent)',
                                                                }
                                                        }
                                                    >
                                                        {date.getDate()}
                                                    </span>
                                                </div>
                                                {diary && (
                                                    <div className="mt-3 min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
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
            {timelineLinkDialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center ui-dialog-backdrop px-4"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setTimelineLinkDialog(null);
                            setTimelineLinkInput('');
                        }
                    }}
                >
                    <form
                        className="ui-dialog w-full max-w-[22rem] rounded-2xl border border-border-subtle p-4 shadow-xl"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveTimelineLink();
                        }}
                    >
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-[var(--color-text-main)]">
                                링크 저장
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                {timelineLinkDialog.text} · {formatShortDate(timelineLinkDialog.startDateKey)}~{formatShortDate(timelineLinkDialog.endDateKey)}
                            </p>
                        </div>

                        <input
                            type="text"
                            className="ui-input h-8 w-full !rounded-md !px-2 text-xs"
                            value={timelineLinkInput}
                            onChange={(e) => setTimelineLinkInput(e.target.value)}
                            placeholder="https://..."
                            autoFocus
                        />

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                className="ui-control h-7 rounded-md px-3 text-[11px]"
                                onClick={() => {
                                    setTimelineLinkDialog(null);
                                    setTimelineLinkInput('');
                                }}
                                disabled={saveTimelineLinkMutation.isPending}
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className="ui-btn-success h-7 rounded-md px-3 text-[11px]"
                                disabled={saveTimelineLinkMutation.isPending}
                            >
                                {saveTimelineLinkMutation.isPending ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            <WikiLinkTooltip tooltip={wikiLinkTooltip} />
            <TimelineTooltip tooltip={timelineTooltip} />
        </div>
    );
}
