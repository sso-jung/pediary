import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PropertyIcon } from './DiaryPropertyUtils';
import { useDiary } from './hooks/useDiary';
import { useDeleteDiary } from './hooks/useDeleteDiary';
import { useDiaryLayout } from './hooks/useDiaryLayout';
import { useDiaryProperties, useDiaryPropertySections } from './hooks/useDiaryProperties';
import { useDiaryPropertyValues } from './hooks/useDiaryPropertyValues';
import { useSaveDiary } from './hooks/useSaveDiary';
import { useAllDocuments } from './hooks/useAllDocuments';
import { useCategories } from './hooks/useCategories';
import DiaryOptionSelectField from './DiaryOptionSelectField';
import { buildInternalLink } from '../../lib/internalLinkFormat';
import { parseInternalLinks } from '../../lib/internalLinkParser';
import { extractSectionsFromMarkdown } from '../../lib/wikiSectionUtils';
import { useWikiLinkTooltip, WikiLinkTooltip } from './WikiLinkTooltip';
import {
    DEFAULT_OPTION_COLOR,
    DEFAULT_OPTION_TEXT_COLOR,
    getOptionName,
    makeOptionValue,
    normalizeOptionValue,
    normalizeOptionValues,
} from './DiarySelectUtils';
import {
    useCreateDiaryPropertyOption,
    useDiaryPropertyOptions,
} from './hooks/useDiaryPropertyOptions';

const AUTO_SAVE_DELAY = 500;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function getDiaryDateText(dateKey) {
    if (!dateKey) return '';

    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = WEEKDAY_LABELS[date.getDay()] || '';

    return `${dateKey}(${weekday})`;
}

function getInitialPropertyValue(property) {
    const value = property?.default_value;
   if (!value) {
       if (property.type === 'multi_select') return [];
       if (property.type === 'select') return null;
       return '';
   }

    if (property.type === 'period') {
        return {
            start: value.start || '',
            end: value.end || '',
        };
    }

    if (property.type === 'multi_select') {
        return normalizeOptionValues(value.options);
    }

    if (property.type === 'select') {
        return normalizeOptionValue(value.option);
    }

    if (property.type === 'number_list') {
        return Array.isArray(value.numbers)
            ? value.numbers.map((item) => item ?? '').join('\n')
            : '';
    }

    if (property.type === 'check_list') {
        return Array.isArray(value.items)
            ? value.items.map((item) =>
                typeof item === 'string'
                    ? { checked: false, text: item }
                    : {
                        checked: !!item.checked,
                        text: item.text || '',
                    },
            )
            : [{ checked: false, text: '' }];
    }

    if (property.type === 'number') return value.number ?? '';
    if (property.type === 'date') return value.date || '';
    return value.text || '';
}

function getValueForInput(property, savedValues) {
    const saved = savedValues.find((item) => item.property_id === property.id)?.value;
    if (!saved) return getInitialPropertyValue(property);

    if (property.type === 'period') {
        return {
            start: saved.start || '',
            end: saved.end || '',
        };
    }

    if (property.type === 'multi_select') {
        return normalizeOptionValues(saved.options);
    }

    if (property.type === 'select') {
        return normalizeOptionValue(saved.option);
    }

    if (property.type === 'number_list') {
        return Array.isArray(saved.numbers)
            ? saved.numbers.map((item) => item ?? '').join('\n')
            : '';
    }

    if (property.type === 'check_list') {
        return Array.isArray(saved.items)
            ? saved.items.map((item) =>
                typeof item === 'string'
                    ? { checked: false, text: item }
                    : {
                        checked: !!item.checked,
                        text: item.text || '',
                    },
            )
            : [{ checked: false, text: '' }];
    }

    if (property.type === 'number') return saved.number ?? '';
    if (property.type === 'date') return saved.date || '';
    return saved.text || '';
}

function buildPropertyValue(property, rawValue) {
    if (property.type === 'period') {
        return {
            start: rawValue?.start || '',
            end: rawValue?.end || '',
        };
    }

    if (property.type === 'multi_select') {
        return {
            options: Array.isArray(rawValue)
                ? rawValue.map(normalizeOptionValue).filter(Boolean)
                : String(rawValue || '')
                    .split(',')
                    .map((name) => normalizeOptionValue(name))
                    .filter(Boolean),
        };
    }

    if (property.type === 'select') {
        return {
            option: normalizeOptionValue(rawValue),
        };
    }

    if (property.type === 'number_list') {
        return {
            numbers: String(rawValue || '')
                .split('\n')
                .map((item) => item.trim()),
        };
    }

    if (property.type === 'check_list') {
        if (Array.isArray(rawValue)) {
            return {
                items: rawValue
                    .map((item) => ({
                        checked: !!item.checked,
                        text: String(item.text || ''),
                    }))
            };
        }

        return {
            items: String(rawValue || '')
                .split('\n')
                .map((item) => item)
                .map((text) => ({
                    checked: false,
                    text,
                })),
        };
    }

    if (property.type === 'number') {
        const value = String(rawValue ?? '').trim();
        return { number: value === '' ? null : Number(value) };
    }

    if (property.type === 'date') return { date: rawValue || '' };
    return { text: rawValue || '' };
}

function hasPropertyValue(property, rawValue) {
    if (property.type === 'period') {
        return !!rawValue?.start || !!rawValue?.end;
    }

    if (property.type === 'multi_select') {
        if (Array.isArray(rawValue)) {
            return rawValue.some((item) => getOptionName(item));
        }

        return String(rawValue || '').split(',').some((item) => item.trim());
    }

    if (property.type === 'select') {
        return !!getOptionName(rawValue);
    }

    if (property.type === 'check_list') {
        if (Array.isArray(rawValue)) {
            return rawValue.some((item) => String(item.text || '').trim());
        }

        return String(rawValue || '').split('\n').some((item) => item.trim());
    }

    if (property.type === 'number_list') {
        return String(rawValue || '').split('\n').some((item) => item.trim());
    }

    return String(rawValue ?? '').trim() !== '';
}

function hasDraftContent({ title, properties = [], propertyValues = {}, contentMarkdown = '' }) {
    const titleText = String(title || '').trim();
    if (titleText && titleText !== '다이어리') return true;
    if (String(contentMarkdown || '').trim()) return true;

    return (properties || []).some((property) =>
        hasPropertyValue(property, propertyValues[property.id]),
    );
}

function getDiaryPropertyItems(properties = [], layout = [], propertyValues = {}) {
    const layoutMap = new Map((layout || []).map((item) => [item.property_id, item]));

    return (properties || [])
        .map((property) => {
            const layoutItem = layoutMap.get(property.id);
            return {
                property,
                sortOrder: layoutItem?.sort_order ?? property.sort_order ?? 0,
                visibility: layoutItem?.visibility || 'always',
                sectionId: property.section_id ?? null,
            };
        })
        .sort(
            (a, b) =>
                (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                (a.property?.created_at || '').localeCompare(b.property?.created_at || ''),
        );
}

function getVisibleProperties(
    properties = [],
    layout = [],
    propertyValues = {},
    forceVisiblePropertyIds = new Set(),
    forceCollapsedPropertyIds = new Set(),
) {
    return getDiaryPropertyItems(properties, layout, propertyValues)
        .filter(({ property, visibility }) => {
            if (visibility === 'hidden') return false;
            if (visibility === 'when_filled') {
                if (forceVisiblePropertyIds.has(property.id)) return true;
                if (forceCollapsedPropertyIds.has(property.id)) return false;
                return hasPropertyValue(property, propertyValues[property.id]);
            }
            return true;
        })
        .map((item) => item.property);
}

function getCollapsedProperties(
    properties = [],
    layout = [],
    propertyValues = {},
    forceVisiblePropertyIds = new Set(),
    forceCollapsedPropertyIds = new Set(),
) {
    return getDiaryPropertyItems(properties, layout, propertyValues)
        .filter(({ property, visibility }) => {
            if (visibility === 'hidden') return true;
            if (visibility === 'when_filled') {
                if (forceVisiblePropertyIds.has(property.id)) return false;
                if (forceCollapsedPropertyIds.has(property.id)) return true;
                return !hasPropertyValue(property, propertyValues[property.id]);
            }
            return false;
        })
        .map((item) => item.property);
}

function sortSections(sections = []) {
    return [...sections].sort(
        (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            (a.created_at || '').localeCompare(b.created_at || ''),
    );
}

function getPropertyDisplayName(name) {
    const displayName = String(name || '').trim();
    return displayName === '새 속성' ? '' : displayName;
}

function isTextareaProperty(property) {
    return ['textarea', 'long_text', 'longText'].includes(property?.type);
}

function buildDiaryLinkCandidates(allDocs = []) {
    if (!Array.isArray(allDocs)) return [];

    const result = [];

    for (const doc of allDocs) {
        if (!doc?.title || !doc?.slug) continue;

        result.push({
            type: 'doc',
            docId: doc.id,
            docTitle: doc.title,
            slug: doc.slug,
        });

        const sections = extractSectionsFromMarkdown(doc.content_markdown || '');
        for (const section of sections) {
            result.push({
                type: 'section',
                docId: doc.id,
                docTitle: doc.title,
                slug: doc.slug,
                sectionNumber: section.number,
                headingText: section.text,
                level: section.level,
            });
        }
    }

    return result;
}

function filterDiaryLinkCandidates(candidates = [], query = '') {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return candidates;

    return candidates.filter((item) => {
        const title = String(item.docTitle || '').toLowerCase();

        if (item.type === 'doc') {
            return title.includes(q);
        }

        const heading = String(item.headingText || '').toLowerCase();
        const sectionNumber = String(item.sectionNumber || '').toLowerCase();
        return title.includes(q) || heading.includes(q) || sectionNumber.includes(q);
    });
}

function buildDiaryInternalLink(item) {
    if (!item) return '';

    if (item.type === 'doc') {
        return buildInternalLink({
            docId: item.docId,
            section: null,
            label: item.docTitle,
        });
    }

    return buildInternalLink({
        docId: item.docId,
        section: item.sectionNumber,
        label: item.headingText,
    });
}

function findDiaryLinkTrigger(value = '', cursor = 0) {
    const beforeCursor = String(value || '').slice(0, cursor);
    const start = beforeCursor.lastIndexOf('[[');
    if (start < 0) return null;

    const query = beforeCursor.slice(start + 2);
    if (query.includes(']]') || query.includes('\n\n')) return null;

    return {
        start,
        query,
    };
}

function getScrollParent(element) {
    let parent = element?.parentElement;

    while (parent) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;

        if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            parent.scrollHeight > parent.clientHeight
        ) {
            return parent;
        }

        parent = parent.parentElement;
    }

    return document.scrollingElement || document.documentElement;
}

function getDiaryInternalLinkHref(target) {
    return target?.closest?.('a.wiki-internal-link')?.getAttribute('href') || '';
}

function DiaryInternalLinkField({
                                    value,
                                    onChangeValue,
                                    onBlur,
                                    disabled,
                                    linkCandidates,
                                    documents = [],
                                    categories = [],
                                    onNavigateLink,
                                    multiline = false,
                                    inputClassName,
                                    wrapperClassName = '',
                                }) {
    const fieldRef = useRef(null);
    const rootRef = useRef(null);
    const paletteListRef = useRef(null);
    const [linkState, setLinkState] = useState({
        open: false,
        start: 0,
        query: '',
        highlightedIndex: 0,
    });
    const [isFocused, setIsFocused] = useState(false);

    const filteredCandidates = useMemo(
        () => filterDiaryLinkCandidates(linkCandidates, linkState.query),
        [linkCandidates, linkState.query],
    );
    const linkPreviewHtml = useMemo(() => {
        const text = String(value || '');
        if (!text.includes('[[')) return '';
        return parseInternalLinks(text, documents, categories);
    }, [categories, documents, value]);

    useLayoutEffect(() => {
        if (!multiline) return;

        const field = fieldRef.current;
        if (!field) return;

        const scrollParent = getScrollParent(field);
        const scrollTop = scrollParent?.scrollTop ?? 0;
        const shouldKeepFieldVisible = document.activeElement === field;

        field.style.height = 'auto';
        field.style.height = `${field.scrollHeight}px`;

        if (scrollParent && shouldKeepFieldVisible) {
            requestAnimationFrame(() => {
                const parentRect = scrollParent.getBoundingClientRect();
                const fieldRect = field.getBoundingClientRect();
                const bottomOffset = fieldRect.bottom - parentRect.bottom + 12;
                const topOffset = fieldRect.top - parentRect.top - 12;

                if (bottomOffset > 0) {
                    scrollParent.scrollTop += bottomOffset;
                } else if (topOffset < 0) {
                    scrollParent.scrollTop += topOffset;
                }
            });
            return;
        }

        if (scrollParent) {
            scrollParent.scrollTop = scrollTop;
            requestAnimationFrame(() => {
                scrollParent.scrollTop = scrollTop;
            });
        }
    }, [isFocused, multiline, value]);

    useEffect(() => {
        if (!linkState.open) return;

        setLinkState((prev) => {
            if (filteredCandidates.length === 0 && prev.highlightedIndex === 0) return prev;
            const nextIndex = Math.min(prev.highlightedIndex, Math.max(filteredCandidates.length - 1, 0));

            if (nextIndex === prev.highlightedIndex) return prev;
            return {
                ...prev,
                highlightedIndex: nextIndex,
            };
        });
    }, [filteredCandidates.length, linkState.open]);

    useEffect(() => {
        if (!linkState.open) return;

        const handleMouseDown = (e) => {
            if (!rootRef.current) return;
            if (rootRef.current.contains(e.target)) return;

            setLinkState((prev) => ({
                ...prev,
                open: false,
            }));
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [linkState.open]);

    useEffect(() => {
        if (!linkState.open) return;
        const container = paletteListRef.current;
        if (!container) return;

        const itemEl = container.children[linkState.highlightedIndex];
        itemEl?.scrollIntoView?.({ block: 'nearest' });
    }, [linkState.highlightedIndex, linkState.open]);

    const updateLinkStateFromCursor = (nextValue, cursor) => {
        const trigger = findDiaryLinkTrigger(nextValue, cursor);

        if (!trigger) {
            setLinkState((prev) => ({
                ...prev,
                open: false,
            }));
            return;
        }

        setLinkState((prev) => ({
            open: true,
            start: trigger.start,
            query: trigger.query,
            highlightedIndex: prev.query === trigger.query ? prev.highlightedIndex : 0,
        }));
    };

    const applyLinkCandidate = (item) => {
        if (!item) return;

        const field = fieldRef.current;
        const cursor = field?.selectionStart ?? String(value || '').length;
        const trigger = findDiaryLinkTrigger(value, cursor) || linkState;
        const insertion = buildDiaryInternalLink(item);
        const nextValue = String(value || '').slice(0, trigger.start) + insertion + String(value || '').slice(cursor);
        const nextCursor = trigger.start + insertion.length;

        onChangeValue(nextValue);
        setLinkState((prev) => ({
            ...prev,
            open: false,
        }));

        requestAnimationFrame(() => {
            fieldRef.current?.focus();
            fieldRef.current?.setSelectionRange?.(nextCursor, nextCursor);
        });
    };

    const focusField = () => {
        if (disabled) return;

        setIsFocused(true);
        requestAnimationFrame(() => {
            const field = fieldRef.current;
            const cursor = String(value || '').length;
            field?.focus();
            field?.setSelectionRange?.(cursor, cursor);
        });
    };

    const handlePreviewMouseDown = (e) => {
        if (e.target?.closest?.('a.wiki-internal-link')) return;

        e.preventDefault();
        focusField();
    };

    const handlePreviewClick = (e) => {
        const link = e.target?.closest?.('a.wiki-internal-link');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        e.preventDefault();
        onNavigateLink?.(href);
    };

    const handleChange = (e) => {
        const nextValue = e.target.value;
        const cursor = e.target.selectionStart ?? nextValue.length;

        onChangeValue(nextValue);
        updateLinkStateFromCursor(nextValue, cursor);
    };

    const handleKeyDown = (e) => {
        if (!linkState.open) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            setLinkState((prev) => ({
                ...prev,
                open: false,
            }));
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setLinkState((prev) => ({
                ...prev,
                highlightedIndex:
                    filteredCandidates.length === 0
                        ? 0
                        : (prev.highlightedIndex + 1) % filteredCandidates.length,
            }));
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setLinkState((prev) => ({
                ...prev,
                highlightedIndex:
                    filteredCandidates.length === 0
                        ? 0
                        : (prev.highlightedIndex - 1 + filteredCandidates.length) % filteredCandidates.length,
            }));
            return;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
            const item = filteredCandidates[linkState.highlightedIndex];
            if (!item) return;

            e.preventDefault();
            applyLinkCandidate(item);
        }
    };

    const handleBlur = (e) => {
        setIsFocused(false);
        onBlur?.(e);
    };

    const FieldTag = multiline ? 'textarea' : 'input';
    const showLinkPreview = !!linkPreviewHtml && !isFocused && !linkState.open;

    return (
        <div ref={rootRef} className={'relative ' + wrapperClassName}>
            {showLinkPreview ? (
                <div
                    className={[
                        inputClassName,
                        multiline ? 'whitespace-pre-wrap' : 'block overflow-hidden text-ellipsis leading-7 whitespace-pre',
                        disabled ? '' : 'cursor-text',
                    ].join(' ')}
                    onMouseDown={handlePreviewMouseDown}
                    onClick={handlePreviewClick}
                    dangerouslySetInnerHTML={{ __html: linkPreviewHtml }}
                />
            ) : (
                <FieldTag
                    ref={fieldRef}
                    type={multiline ? undefined : 'text'}
                    className={inputClassName}
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleBlur}
                    disabled={disabled}
                    placeholder=""
                />
            )}

            {linkState.open && (
                <div
                    className="absolute left-0 top-[calc(100%+4px)] z-[70] w-[min(360px,calc(100vw-72px))] rounded-xl border border-border-subtle bg-[var(--color-page-surface)] p-2 text-[12px] shadow-xl"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[11px] text-[var(--color-text-muted)]">
                        <span className="font-semibold text-[var(--color-text-main)]">내부 링크 추가</span>
                        <span className="rounded-full bg-[rgba(127,127,127,0.10)] px-2 py-[2px] text-[10px]">
                            [[
                        </span>
                    </div>

                    {filteredCandidates.length === 0 ? (
                        <div className="rounded-lg bg-[rgba(127,127,127,0.06)] px-2 py-2 text-[11px] text-[var(--color-text-muted)]">
                            일치하는 문서가 없어.
                        </div>
                    ) : (
                        <div ref={paletteListRef} className="max-h-64 overflow-y-auto">
                            {filteredCandidates.map((item, index) => (
                                <button
                                    key={
                                        item.type === 'doc'
                                            ? `doc-${item.docId}`
                                            : `section-${item.docId}-${item.sectionNumber}-${item.headingText}`
                                    }
                                    type="button"
                                    className={[
                                        "block w-full rounded-md px-2 py-1 text-left transition",
                                        index === linkState.highlightedIndex
                                            ? "bg-[rgba(127,127,127,0.12)] text-[var(--color-text-main)]"
                                            : "text-[var(--color-text-muted)] hover:bg-[rgba(127,127,127,0.08)]",
                                    ].join(" ")}
                                    onMouseEnter={() =>
                                        setLinkState((prev) => ({
                                            ...prev,
                                            highlightedIndex: index,
                                        }))
                                    }
                                    onClick={() => applyLinkCandidate(item)}
                                >
                                    {item.type === 'doc' ? (
                                        <span className="block truncate font-medium">
                                            {item.docTitle}
                                        </span>
                                    ) : (
                                        <span className="block truncate font-medium">
                                            {item.docTitle}
                                            <span className="mx-1 opacity-40">&gt;</span>
                                            <span className="opacity-70">{item.sectionNumber}</span>
                                            <span className="ml-1">{item.headingText}</span>
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function DiaryTextField({ value, onChangeValue, onBlur, disabled, linkCandidates, documents, categories, onNavigateLink }) {
    return (
        <DiaryInternalLinkField
            value={value}
            onChangeValue={onChangeValue}
            onBlur={onBlur}
            disabled={disabled}
            linkCandidates={linkCandidates}
            documents={documents}
            categories={categories}
            onNavigateLink={onNavigateLink}
            inputClassName="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
        />
    );
}

function DiaryTextareaField({ value, onChangeValue, onBlur, disabled, linkCandidates, documents, categories, onNavigateLink }) {
    return (
        <DiaryInternalLinkField
            value={value}
            onChangeValue={onChangeValue}
            onBlur={onBlur}
            disabled={disabled}
            linkCandidates={linkCandidates}
            documents={documents}
            categories={categories}
            onNavigateLink={onNavigateLink}
            multiline
            wrapperClassName="diary-editor-textarea-wrap rounded-lg border border-border-subtle bg-[rgba(255,255,255,0.55)] p-1 shadow-sm focus-within:border-[rgba(120,145,255,0.55)] focus-within:ring-2 focus-within:ring-[rgba(120,145,255,0.18)] sm:p-1.5"
            inputClassName="diary-editor-textarea block min-h-[28px] w-full resize-none overflow-hidden rounded-md bg-transparent px-1 py-1 text-xs leading-5 outline-none sm:min-h-[68px]"
        />
    );
}

function getListItems(value) {
    return String(value || '').split('\n');
}

function updateListItem(value, index, nextValue) {
    const items = getListItems(value);
    items[index] = nextValue;
    return items.join('\n');
}

function addListItem(value) {
    const items = getListItems(value);
    return [...items, ''].join('\n');
}

function deleteListItem(value, index) {
    const items = getListItems(value).filter((_, itemIndex) => itemIndex !== index);
    return (items.length > 0 ? items : ['']).join('\n');
}

function getCheckItems(value) {
    if (Array.isArray(value)) {
        return value.length > 0 ? value : [{ checked: false, text: '' }];
    }

    const items = String(value || '')
        .split('\n')
        .map((item) => ({
            checked: false,
            text: item,
        }));

    return items.length > 0 ? items : [{ checked: false, text: '' }];
}

function updateCheckItem(value, index, nextItem) {
    const items = getCheckItems(value);
    items[index] = {
        ...items[index],
        ...nextItem,
    };
    return items;
}

function addCheckItem(value) {
    return [...getCheckItems(value), { checked: false, text: '' }];
}

function deleteCheckItem(value, index) {
    const items = getCheckItems(value).filter((_, itemIndex) => itemIndex !== index);
    return items.length > 0 ? items : [{ checked: false, text: '' }];
}

function ListActionButton({ type, onClick, disabled }) {
    return (
        <button
            type="button"
            className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] disabled:opacity-30",
                type === 'delete' ? "hover:text-red-500" : "hover:text-[var(--color-text-primary)]",
            ].join(" ")}
            onClick={onClick}
            disabled={disabled}
            aria-label={type === 'delete' ? '항목 삭제' : '항목 추가'}
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
                {type === 'delete' ? (
                    <path d="M5 10h10"/>
                ) : (
                    <path d="M10 4v12M4 10h12"/>
                )}
            </svg>
        </button>
    );
}

export default function DiaryEditor({ open, diaryDate, onClose }) {
    const navigate = useNavigate();
    const { data: diary, isLoading } = useDiary(open ? diaryDate : null);
    const { data: properties } = useDiaryProperties();
    const { data: sections } = useDiaryPropertySections();
    const { data: layout } = useDiaryLayout();
    const { data: savedPropertyValues, isLoading: valuesLoading } = useDiaryPropertyValues(
        open ? diaryDate : null,
    );
    const { data: propertyOptions } = useDiaryPropertyOptions();
    const { data: allDocs } = useAllDocuments();
    const { data: categories } = useCategories();
    const createPropertyOption = useCreateDiaryPropertyOption();
    const saveDiary = useSaveDiary();
    const deleteDiary = useDeleteDiary();

    const [propertyValues, setPropertyValues] = useState({});
    const [title, setTitle] = useState('다이어리');
    const [isCollapsedPropertiesOpen, setIsCollapsedPropertiesOpen] = useState(false);
    const [forceVisiblePropertyIds, setForceVisiblePropertyIds] = useState(() => new Set());
    const [forceCollapsedPropertyIds, setForceCollapsedPropertyIds] = useState(() => new Set());

    const saveTimerRef = useRef(null);
    const latestDraftRef = useRef({
        title: '다이어리',
        propertyValues: {},
    });
    const hydratedRef = useRef(false);
    const dirtyRef = useRef(false);
    const dialogRootRef = useRef(null);

    const getDialogRoot = useCallback(() => dialogRootRef.current, []);
    const wikiLinkTooltip = useWikiLinkTooltip(getDialogRoot, open);
    const handleNavigateLink = useCallback((href) => {
        if (!href) return;

        onClose?.();
        navigate(href);
    }, [navigate, onClose]);
    const handleInternalLinkClickCapture = useCallback((e) => {
        const href = getDiaryInternalLinkHref(e.target);
        if (!href) return;

        e.preventDefault();
        e.stopPropagation();
        handleNavigateLink(href);
    }, [handleNavigateLink]);

    const loading = isLoading || valuesLoading;
    const linkCandidates = useMemo(() => buildDiaryLinkCandidates(allDocs || []), [allDocs]);
    const visibleProperties = getVisibleProperties(
        properties || [],
        layout || [],
        propertyValues,
        forceVisiblePropertyIds,
        forceCollapsedPropertyIds,
    );
    const optionsByPropertyId = useMemo(() => {
        const map = new Map();

        (propertyOptions || []).forEach((option) => {
            const propertyId = option.property_id;
            map.set(propertyId, [...(map.get(propertyId) || []), option]);
        });

        return map;
    }, [propertyOptions]);
    const collapsedProperties = getCollapsedProperties(
        properties || [],
        layout || [],
        propertyValues,
        forceVisiblePropertyIds,
        forceCollapsedPropertyIds,
    );

    useEffect(() => {
        if (!open) {
            hydratedRef.current = false;
            dirtyRef.current = false;
            setIsCollapsedPropertiesOpen(false);
            setForceVisiblePropertyIds(new Set());
            setForceCollapsedPropertyIds(new Set());
            latestDraftRef.current = {
                title: '다이어리',
                propertyValues: {},
            };

            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        }
    }, [open, diaryDate]);

    useEffect(() => {
        if (!open || !diaryDate) return;
        if (loading) return;
        if (!properties || !savedPropertyValues) return;
        if (hydratedRef.current) return;

        const nextPropertyValues = {};
        properties.forEach((property) => {
            nextPropertyValues[property.id] = getValueForInput(property, savedPropertyValues);
        });

        const nextTitle = diary?.title || '다이어리';

        setTitle(nextTitle);
        setPropertyValues(nextPropertyValues);

        latestDraftRef.current = {
            title: nextTitle,
            propertyValues: nextPropertyValues,
        };

        hydratedRef.current = true;
        dirtyRef.current = false;
    }, [open, diaryDate, loading, diary, properties, savedPropertyValues]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    if (!open || !diaryDate) return null;

    const saveDraft = async () => {
        if (!diaryDate || !properties || !hydratedRef.current) return;
        if (!dirtyRef.current) return;

        const draft = latestDraftRef.current;
        if (
            !diary &&
            !hasDraftContent({
                title: draft.title,
                properties,
                propertyValues: draft.propertyValues,
                contentMarkdown: diary?.content_markdown || '',
            })
        ) {
            return;
        }

        await saveDiary.mutateAsync({
            diaryDate,
            title: String(draft.title || '').trim() || '다이어리',
            contentMarkdown: diary?.content_markdown || '',
            propertyValues: (properties || []).map((property) => ({
                propertyId: property.id,
                value: buildPropertyValue(property, draft.propertyValues[property.id]),
            })),
        });
    };

    const scheduleSave = () => {
        if (!hydratedRef.current) return;

        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = window.setTimeout(() => {
            saveDraft();
        }, AUTO_SAVE_DELAY);
    };

    const flushSave = async () => {
        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        await saveDraft();
    };

    const handleChangeTitle = (value) => {
        setTitle(value);
        dirtyRef.current = true;

        latestDraftRef.current = {
            ...latestDraftRef.current,
            title: value,
        };

        scheduleSave();
    };

    const handleChangePropertyValue = (propertyId, value) => {
        dirtyRef.current = true;

        const nextPropertyValues = {
            ...latestDraftRef.current.propertyValues,
            [propertyId]: value,
        };

        setPropertyValues(nextPropertyValues);

        latestDraftRef.current = {
            ...latestDraftRef.current,
            propertyValues: nextPropertyValues,
        };

        scheduleSave();
    };

    const handleCreateOptionAndSelect = async (property, option) => {
        const name = String(option?.name || '').trim();
        if (!name) return null;

        const propertyOptions = optionsByPropertyId.get(property.id) || [];

        const duplicated = propertyOptions.find(
            (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
        );

        if (duplicated) {
            return makeOptionValue(duplicated);
        }

        const created = await createPropertyOption.mutateAsync({
            propertyId: property.id,
            name,
            color: option.color || DEFAULT_OPTION_COLOR,
            textColor: option.textColor || DEFAULT_OPTION_TEXT_COLOR,
            sortOrder: propertyOptions.length,
        });

        return makeOptionValue(created);
    };

    const handleDeleteDiary = async () => {
        if (!diaryDate || deleteDiary.isPending) return;
        if (!window.confirm('이 다이어리를 삭제할까?')) return;

        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        dirtyRef.current = false;

        await deleteDiary.mutateAsync({ diaryDate });
        onClose();
    };

    const handleBackdropMouseDown = async (e) => {
        if (e.target !== e.currentTarget) return;

        await flushSave();
        onClose();
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

    const getPropertiesBySection = (sectionId) =>
        visibleProperties.filter((property) => (property.section_id ?? null) === sectionId);
    const getCollapsedPropertiesBySection = (sectionId) =>
        collapsedProperties.filter((property) => (property.section_id ?? null) === sectionId);

    const keepPropertyPosition = (propertyId, position) => {
        const addPropertyId = (setter) => {
            setter((prev) => {
                if (prev.has(propertyId)) return prev;

                const next = new Set(prev);
                next.add(propertyId);
                return next;
            });
        };

        if (position === 'visible') {
            addPropertyId(setForceVisiblePropertyIds);
            return;
        }

        if (position === 'collapsed') {
            addPropertyId(setForceCollapsedPropertyIds);
        }
    };

    const releasePropertyPosition = (propertyId) => {
        window.setTimeout(() => {
            setForceVisiblePropertyIds((prev) => {
                if (!prev.has(propertyId)) return prev;

                const next = new Set(prev);
                next.delete(propertyId);
                return next;
            });

            setForceCollapsedPropertyIds((prev) => {
                if (!prev.has(propertyId)) return prev;

                const next = new Set(prev);
                next.delete(propertyId);
                return next;
            });
        }, 0);
    };

    const renderPropertyInput = (property) => {
        if (property.type === 'period') {
            return (
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="date"
                        className="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
                        value={propertyValues[property.id]?.start || ''}
                        onChange={(e) =>
                            handleChangePropertyValue(property.id, {
                                ...(propertyValues[property.id] || {}),
                                start: e.target.value,
                            })
                        }
                        onBlur={flushSave}
                        disabled={loading}
                    />
                    <input
                        type="date"
                        className="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
                        value={propertyValues[property.id]?.end || ''}
                        onChange={(e) =>
                            handleChangePropertyValue(property.id, {
                                ...(propertyValues[property.id] || {}),
                                end: e.target.value,
                            })
                        }
                        onBlur={flushSave}
                        disabled={loading}
                    />
                </div>
            );
        }

        if (property.type === 'check_list') {
            const value = propertyValues[property.id] ?? '';
            const items = getCheckItems(value);

            return (
                <div className="space-y-1">
                    {items.map((item, index) => (
                        <div key={index} className="diary-editor-check-row flex items-center gap-1.5">
                            <label className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center">
                                <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={!!item.checked}
                                    onChange={(e) =>
                                        handleChangePropertyValue(
                                            property.id,
                                            updateCheckItem(value, index, {
                                                checked: e.target.checked,
                                            }),
                                        )
                                    }
                                    disabled={loading}
                                />
                                <span className="diary-editor-check-box flex h-4 w-4 items-center justify-center rounded border border-border-subtle bg-[var(--color-page-surface)] text-white transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)] [&>svg]:peer-checked:opacity-100">
                                    <svg
                                        viewBox="0 0 16 16"
                                        className="h-3 w-3 opacity-0 transition"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M3.5 8.5 6.5 11 12.5 5"/>
                                    </svg>
                                </span>
                            </label>
                            <input
                                className="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
                                value={item.text}
                                onChange={(e) =>
                                    handleChangePropertyValue(
                                        property.id,
                                        updateCheckItem(value, index, {
                                            text: e.target.value,
                                        }),
                                    )
                                }
                                onBlur={flushSave}
                                disabled={loading}
                            />
                            <ListActionButton
                                type={index === 0 ? 'add' : 'delete'}
                                onClick={() =>
                                    handleChangePropertyValue(
                                        property.id,
                                        index === 0 ? addCheckItem(value) : deleteCheckItem(value, index),
                                    )
                                }
                                disabled={loading}
                            />
                        </div>
                    ))}
                </div>
            );
        }

        if (property.type === 'number_list') {
            const value = propertyValues[property.id] ?? '';
            const items = getListItems(value);

            return (
                <div className="space-y-1">
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                            <span className="w-6 shrink-0 text-right text-xs text-[var(--color-text-muted)]">
                                {index + 1}.
                            </span>
                            <input
                                type="text"
                                className="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
                                value={item}
                                onChange={(e) =>
                                    handleChangePropertyValue(
                                        property.id,
                                        updateListItem(value, index, e.target.value),
                                    )
                                }
                                onBlur={flushSave}
                                disabled={loading}
                            />
                            <ListActionButton
                                type={index === 0 ? 'add' : 'delete'}
                                onClick={() =>
                                    handleChangePropertyValue(
                                        property.id,
                                        index === 0 ? addListItem(value) : deleteListItem(value, index),
                                    )
                                }
                                disabled={loading}
                            />
                        </div>
                    ))}
                </div>
            );
        }

        if (isTextareaProperty(property)) {
            return (
                <DiaryTextareaField
                    value={propertyValues[property.id] ?? ''}
                    onChangeValue={(nextValue) =>
                        handleChangePropertyValue(property.id, nextValue)
                    }
                    onBlur={flushSave}
                    disabled={loading}
                    linkCandidates={linkCandidates}
                    documents={allDocs || []}
                    categories={categories || []}
                    onNavigateLink={handleNavigateLink}
                />
            );
        }

        if (property.type === 'select' || property.type === 'multi_select') {
            return (
                <DiaryOptionSelectField
                    value={propertyValues[property.id]}
                    options={optionsByPropertyId.get(property.id) || []}
                    multiple={property.type === 'multi_select'}
                    onChange={(nextValue) =>
                        handleChangePropertyValue(property.id, nextValue)
                    }
                    onCreateOption={(option) =>
                        handleCreateOptionAndSelect(property, option)
                    }
                    onBlur={flushSave}
                    disabled={loading}
                />
            );
        }

        if (property.type === 'text') {
            return (
                <DiaryTextField
                    value={propertyValues[property.id] ?? ''}
                    onChangeValue={(nextValue) =>
                        handleChangePropertyValue(property.id, nextValue)
                    }
                    onBlur={flushSave}
                    disabled={loading}
                    linkCandidates={linkCandidates}
                    documents={allDocs || []}
                    categories={categories || []}
                    onNavigateLink={handleNavigateLink}
                />
            );
        }

        return (
            <input
                type={
                    property.type === 'date'
                        ? 'date'
                        : property.type === 'number'
                            ? 'number'
                            : 'text'
                }
                className="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
                value={propertyValues[property.id] ?? ''}
                onChange={(e) =>
                    handleChangePropertyValue(property.id, e.target.value)
                }
                onBlur={flushSave}
                placeholder={
                    property.type === 'multi_select'
                        ? '쉼표로 구분'
                        : property.type === 'select'
                            ? '선택값'
                            : ''
                }
                disabled={loading}
            />
        );
    };

    const renderPropertyRow = (property, position = 'visible') => (
        <div
            key={property.id}
            className="diary-editor-property-row grid grid-cols-[28px_minmax(0,1fr)] items-start border-b border-border-subtle px-2 py-1.5 text-xs hover:bg-[rgba(127,127,127,0.04)] sm:grid-cols-[28px_minmax(0,120px)_minmax(0,1fr)] sm:py-1"
            style={{ borderColor: 'color-mix(in srgb, var(--color-border-subtle) 58%, transparent)' }}
            onFocusCapture={() => keepPropertyPosition(property.id, position)}
            onBlurCapture={(e) => {
                if (e.currentTarget.contains(e.relatedTarget)) return;
                releasePropertyPosition(property.id);
            }}
        >
            <span className="flex h-6 w-7 shrink-0 items-center justify-center text-center sm:h-7">
                <PropertyIcon icon={property.icon}/>
            </span>
            <span className="diary-editor-property-name flex min-h-6 min-w-0 items-center break-words px-2 font-medium leading-4 text-[var(--color-text-muted)] sm:min-h-7">
                {getPropertyDisplayName(property.name)}
            </span>
            <div className="col-start-2 min-w-0 self-center px-2 pb-0.5 sm:col-start-auto sm:px-0 sm:pb-0">
                {renderPropertyInput(property)}
            </div>
        </div>
    );

    const renderSection = (section, depth = 0) => {
        const sectionProperties = getPropertiesBySection(section.id);
        const collapsedSectionProperties = isCollapsedPropertiesOpen
            ? getCollapsedPropertiesBySection(section.id)
            : [];
        const childSections = sortSections(childSectionMap.get(section.id) || []);

        if (
            sectionProperties.length === 0 &&
            collapsedSectionProperties.length === 0 &&
            childSections.length === 0
        ) return null;

        return (
            <div key={section.id} className={depth > 0 ? "ml-6" : ""}>
                <div className="diary-editor-section-divider mt-2 border-b border-border-subtle px-2 py-1.5 text-[13px] font-bold text-[var(--color-text-main)] sm:mt-3 sm:py-2">
                    {section.name}
                </div>
                {sectionProperties.map((property) => renderPropertyRow(property, 'visible'))}
                {collapsedSectionProperties.map((property) => renderPropertyRow(property, 'collapsed'))}
                {childSections.map((childSection) => renderSection(childSection, depth + 1))}
            </div>
        );
    };

    const unclassifiedProperties = getPropertiesBySection(null);
    const collapsedUnclassifiedProperties = isCollapsedPropertiesOpen
        ? getCollapsedPropertiesBySection(null)
        : [];

    const dialog = (
        <div
            ref={dialogRootRef}
            className="diary-view-link-muted fixed inset-0 z-40 flex items-end justify-center ui-dialog-backdrop sm:items-center"
            onMouseDownCapture={handleInternalLinkClickCapture}
            onMouseDown={handleBackdropMouseDown}
            onClickCapture={handleInternalLinkClickCapture}
        >
            <div
                className="ui-dialog flex max-h-[94vh] min-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl p-3 sm:max-h-[92vh] sm:min-h-[82vh] sm:w-[min(760px,calc(100vw-32px))] sm:rounded-2xl sm:p-4"
                onMouseDown={(e) => e.stopPropagation()}
                >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <input
                            className="w-full rounded-md bg-transparent px-1 py-0.5 text-m font-semibold outline-none ui-dialog-title hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
                            value={title}
                            onChange={(e) => handleChangeTitle(e.target.value)}
                            onBlur={flushSave}
                            placeholder="제목 입력"
                            disabled={loading}
                            maxLength={45}
                        />

                        <div className="flex min-h-5 items-center gap-2 px-1">
                            <span className="text-sm ui-dialog-message">
                                {getDiaryDateText(diaryDate)}
                            </span>

                            {saveDiary.isPending && (
                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                저장 중...
                            </span>
                            )}
                        </div>
                    </div>

                    {diary && (
                        <button
                            type="button"
                            className="shrink-0 rounded px-1 py-1 text-[11px] font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-40"
                            onClick={handleDeleteDiary}
                            disabled={deleteDiary.isPending}
                        >
                            {deleteDiary.isPending ? '삭제 중...' : '삭제'}
                        </button>
                    )}
                </div>

                <div className="mt-0 min-h-0 flex-1 overflow-y-auto p-0.5 sm:p-1">
                    <div className="space-y-1">
                        {(unclassifiedProperties.length > 0 || collapsedUnclassifiedProperties.length > 0) && (
                            <div>
                                <div className="diary-editor-section-divider border-b border-border-subtle px-2 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
                                    미분류
                                </div>
                                {unclassifiedProperties.map((property) => renderPropertyRow(property, 'visible'))}
                                {collapsedUnclassifiedProperties.map((property) => renderPropertyRow(property, 'collapsed'))}
                            </div>
                        )}

                        {rootSections.map((section) => renderSection(section))}

                        {collapsedProperties.length > 0 && (
                            <div className="pt-1">
                                <button
                                    type="button"
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text-main)]"
                                    onClick={() => setIsCollapsedPropertiesOpen((prev) => !prev)}
                                >
                                    <svg
                                        viewBox="0 0 20 20"
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        {isCollapsedPropertiesOpen ? (
                                            <path d="M5.5 12.5 10 8l4.5 4.5" />
                                        ) : (
                                            <path d="M5.5 7.5 10 12l4.5-4.5" />
                                        )}
                                    </svg>
                                    <span>
                                        속성 {collapsedProperties.length}개 {isCollapsedPropertiesOpen ? '접기' : '펼치기'}
                                    </span>
                                </button>
                            </div>
                        )}

                        {(properties || []).length === 0 && (
                            <p className="text-xs ui-dialog-message">
                                아직 설정한 속성이 없어.
                            </p>
                        )}
                        {(properties || []).length > 0 && visibleProperties.length === 0 && collapsedProperties.length === 0 && (
                            <p className="text-xs ui-dialog-message">
                                표시할 속성이 없어.
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <WikiLinkTooltip tooltip={wikiLinkTooltip} />
        </div>
    );

    if (typeof document === 'undefined') return dialog;

    const portalRoot = document.getElementById('portal-root');
    return createPortal(dialog, portalRoot ?? document.body);
}
