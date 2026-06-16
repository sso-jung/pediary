import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PropertyIcon } from './DiaryPropertyUtils';
import { useDiary } from './hooks/useDiary';
import { useDiaryProperties } from './hooks/useDiaryProperties';
import { useDiaryPropertyValues } from './hooks/useDiaryPropertyValues';
import { useSaveDiary } from './hooks/useSaveDiary';

const AUTO_SAVE_DELAY = 500;

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

    if (property.type === 'number') {
        const value = String(rawValue ?? '').trim();
        return { number: value === '' ? null : Number(value) };
    }

    if (property.type === 'date') return { date: rawValue || '' };
    if (property.type === 'select') return { option: rawValue || '' };
    return { text: rawValue || '' };
}

function DiaryTextareaField({ value, onChange, onBlur, disabled }) {
    return (
        <div className="rounded-xl border border-border-subtle bg-[rgba(255,255,255,0.55)] p-2 shadow-sm focus-within:border-[rgba(120,145,255,0.55)] focus-within:ring-2 focus-within:ring-[rgba(120,145,255,0.18)]">
            <textarea
                className="block h-[200px] w-full resize-none overflow-y-auto rounded-lg bg-transparent px-1 py-1 text-xs leading-5 outline-none"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                disabled={disabled}
                placeholder="내용 입력"
            />
        </div>
    );
}

export default function DiaryEditor({ open, diaryDate, onClose }) {
    const { data: diary, isLoading } = useDiary(open ? diaryDate : null);
    const { data: properties } = useDiaryProperties();
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

    const dialog = (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center ui-dialog-backdrop"
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                className="ui-dialog flex max-h-[86vh] w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl p-4"
                onMouseDown={(e) => e.stopPropagation()}
                >
                <div className="min-w-0">
                    <input
                        className="w-full rounded-md bg-transparent px-1 py-0.5 text-m font-semibold outline-none ui-dialog-title hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
                        value={title}
                        onChange={(e) => handleChangeTitle(e.target.value)}
                        onBlur={flushSave}
                        placeholder="제목 입력"
                        disabled={loading}
                        maxLength={45}
                    />
                    <div className="mt-1 flex items-center gap-2 px-1 text-sm ui-dialog-message">
                        <span>{diaryDate}</span>
                        {saveDiary.isPending && (
                            <span className="text-[11px] text-[var(--color-text-muted)]">
                                저장 중...
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-border-subtle p-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold ui-dialog-title">속성</h3>
                    </div>

                    <div className="mt-3 space-y-2">
                        {(properties || []).map((property) => (
                            <div
                                key={property.id}
                                className="grid gap-2 rounded-lg border border-border-subtle p-2 sm:grid-cols-[140px_1fr] sm:items-start"
                            >
                                <div className="flex min-w-0 items-center gap-2 text-xs">
                                    <span className="flex w-5 shrink-0 items-center justify-center text-center">
                                        <PropertyIcon icon={property.icon}/>
                                    </span>
                                    <span className="min-w-0 truncate font-medium">
                                        {property.name}
                                    </span>
                                </div>

                                {property.type === 'period' ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
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
                                            className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
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
                                ) : property.type === 'textarea' ? (
                                    <DiaryTextareaField
                                        value={propertyValues[property.id] ?? ''}
                                        onChange={(e) =>
                                            handleChangePropertyValue(property.id, e.target.value)
                                        }
                                        onBlur={flushSave}
                                        disabled={loading}
                                    />
                                ) : (
                                    <input
                                        type={
                                            property.type === 'date'
                                                ? 'date'
                                                : property.type === 'number'
                                                    ? 'number'
                                                    : 'text'
                                        }
                                        className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
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
                                )}
                            </div>
                        ))}

                        {(properties || []).length === 0 && (
                            <p className="text-xs ui-dialog-message">
                                아직 설정한 속성이 없어.
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