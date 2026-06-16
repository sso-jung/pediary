import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PropertyIcon } from './DiaryPropertyUtils';
import { useDiary } from './hooks/useDiary';
import { useDiaryLayout } from './hooks/useDiaryLayout';
import { useDiaryProperties, useDiaryPropertySections } from './hooks/useDiaryProperties';
import { useDiaryPropertyValues } from './hooks/useDiaryPropertyValues';
import { useSaveDiary } from './hooks/useSaveDiary';

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
    if (!value) return '';

    if (property.type === 'period') {
        return {
            start: value.start || '',
            end: value.end || '',
        };
    }

    if (property.type === 'multi_select') {
        return Array.isArray(value.options) ? value.options.join(', ') : '';
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
    if (property.type === 'select') return value.option || '';
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
        return Array.isArray(saved.options) ? saved.options.join(', ') : '';
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
    if (property.type === 'select') return saved.option || '';
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
            options: String(rawValue || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
        };
    }

    if (property.type === 'number_list') {
        return {
            numbers: String(rawValue || '')
                .split('\n')
                .map((item) => item.trim())
                .map((item) => {
                    if (item === '') return null;
                    const numberValue = Number(item);
                    return Number.isNaN(numberValue) ? null : numberValue;
                }),
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
    if (property.type === 'select') return { option: rawValue || '' };
    return { text: rawValue || '' };
}

function hasPropertyValue(property, rawValue) {
    if (property.type === 'period') {
        return !!rawValue?.start || !!rawValue?.end;
    }

    if (property.type === 'multi_select') {
        return String(rawValue || '').split(',').some((item) => item.trim());
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

function getVisibleProperties(properties = [], layout = [], propertyValues = {}) {
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
        .filter(({ property, visibility }) => {
            if (visibility === 'hidden') return false;
            if (visibility === 'when_filled') {
                return hasPropertyValue(property, propertyValues[property.id]);
            }
            return true;
        })
        .sort(
            (a, b) =>
                (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                (a.property?.created_at || '').localeCompare(b.property?.created_at || ''),
        )
        .map((item) => item.property);
}

function sortSections(sections = []) {
    return [...sections].sort(
        (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            (a.created_at || '').localeCompare(b.created_at || ''),
    );
}

function DiaryTextareaField({ value, onChange, onBlur, disabled }) {
    return (
        <div className="rounded-lg border border-border-subtle bg-[rgba(255,255,255,0.55)] p-1.5 shadow-sm focus-within:border-[rgba(120,145,255,0.55)] focus-within:ring-2 focus-within:ring-[rgba(120,145,255,0.18)]">
            <textarea
                className="block h-[120px] w-full resize-none overflow-y-auto rounded-md bg-transparent px-1 py-1 text-xs leading-5 outline-none"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                disabled={disabled}
                placeholder="내용 입력"
            />
        </div>
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
    const { data: diary, isLoading } = useDiary(open ? diaryDate : null);
    const { data: properties } = useDiaryProperties();
    const { data: sections } = useDiaryPropertySections();
    const { data: layout } = useDiaryLayout();
    const { data: savedPropertyValues, isLoading: valuesLoading } = useDiaryPropertyValues(
        open ? diaryDate : null,
    );
    const saveDiary = useSaveDiary();

    const [propertyValues, setPropertyValues] = useState({});
    const [title, setTitle] = useState('다이어리');

    const saveTimerRef = useRef(null);
    const latestDraftRef = useRef({
        title: '다이어리',
        propertyValues: {},
    });
    const hydratedRef = useRef(false);

    const loading = isLoading || valuesLoading;
    const visibleProperties = getVisibleProperties(properties || [], layout || [], propertyValues);

    useEffect(() => {
        if (!open) {
            hydratedRef.current = false;
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

        const draft = latestDraftRef.current;

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

        latestDraftRef.current = {
            ...latestDraftRef.current,
            title: value,
        };

        scheduleSave();
    };

    const handleChangePropertyValue = (propertyId, value) => {
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
                        <div key={index} className="flex items-center gap-1.5">
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
                                <span className="flex h-4 w-4 items-center justify-center rounded border border-border-subtle bg-[var(--color-page-surface)] text-white transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)] [&>svg]:peer-checked:opacity-100">
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
                                type="number"
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

        if (property.type === 'textarea') {
            return (
                <DiaryTextareaField
                    value={propertyValues[property.id] ?? ''}
                    onChange={(e) =>
                        handleChangePropertyValue(property.id, e.target.value)
                    }
                    onBlur={flushSave}
                    disabled={loading}
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

    const renderPropertyRow = (property) => (
        <div
            key={property.id}
            className="grid grid-cols-[28px_minmax(0,180px)_minmax(0,1fr)] items-center border-b border-border-subtle px-2 py-1 text-xs hover:bg-[rgba(127,127,127,0.04)]"
        >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-center">
                <PropertyIcon icon={property.icon}/>
            </span>
            <span className="flex min-h-7 min-w-0 items-center truncate px-2 font-medium text-[var(--color-text-muted)]">
                {property.name}
            </span>
            <div className="min-w-0 self-center">
                {renderPropertyInput(property)}
            </div>
        </div>
    );

    const renderSection = (section, depth = 0) => {
        const sectionProperties = getPropertiesBySection(section.id);
        const childSections = sortSections(childSectionMap.get(section.id) || []);

        if (sectionProperties.length === 0 && childSections.length === 0) return null;

        return (
            <div key={section.id} className={depth > 0 ? "ml-6" : ""}>
                <div className="mt-3 border-b border-border-subtle px-2 py-2 text-[13px] font-bold text-[var(--color-text-main)]">
                    {section.name}
                </div>
                {sectionProperties.map(renderPropertyRow)}
                {childSections.map((childSection) => renderSection(childSection, depth + 1))}
            </div>
        );
    };

    const unclassifiedProperties = getPropertiesBySection(null);
    const titleInputWidth = `${Math.max(10, Math.min(50, String(title || '').length + 1))}ch`;

    const dialog = (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center ui-dialog-backdrop"
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                className="ui-dialog flex max-h-[86vh] w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl p-4"
                onMouseDown={(e) => e.stopPropagation()}
                >
                <div className="flex min-w-0 items-end gap-1">
                    <input
                        className="rounded-md bg-transparent px-1 py-0.5 text-m font-semibold outline-none ui-dialog-title hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
                        style={{ width: titleInputWidth }}
                        value={title}
                        onChange={(e) => handleChangeTitle(e.target.value)}
                        onBlur={flushSave}
                        placeholder="제목 입력"
                        disabled={loading}
                        maxLength={45}
                    />
                    <span className="shrink-0 pb-1 text-sm ui-dialog-message">
                        - {getDiaryDateText(diaryDate)}
                    </span>
                    {saveDiary.isPending && (
                        <span className="pb-0.5 pl-1 text-[11px] text-[var(--color-text-muted)]">
                            저장 중...
                        </span>
                    )}
                </div>

                <div className="mt-0 min-h-0 flex-1 overflow-y-auto p-1">
                    <div className="space-y-1">
                        {unclassifiedProperties.length > 0 && (
                            <div>
                                <div className="border-b border-border-subtle px-2 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
                                    미분류
                                </div>
                                {unclassifiedProperties.map(renderPropertyRow)}
                            </div>
                        )}

                        {rootSections.map((section) => renderSection(section))}

                        {(properties || []).length === 0 && (
                            <p className="text-xs ui-dialog-message">
                                아직 설정한 속성이 없어.
                            </p>
                        )}
                        {(properties || []).length > 0 && visibleProperties.length === 0 && (
                            <p className="text-xs ui-dialog-message">
                                표시할 속성이 없어.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return dialog;

    const portalRoot = document.getElementById('portal-root');
    return createPortal(dialog, portalRoot ?? document.body);
}
