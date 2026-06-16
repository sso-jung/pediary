import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROPERTY_TYPES, PropertyIcon } from './DiaryPropertyUtils';
import {
    useCreateDiaryProperty,
    useDeleteDiaryProperty,
    useDiaryProperties,
    useUpdateDiaryProperty,
} from './hooks/useDiaryProperties';

const AUTO_SAVE_DELAY = 500;

function getDraftFromProperty(property) {
    return {
        name: property?.name || '',
        type: property?.type || 'text',
        icon: property?.icon || '',
    };
}

export default function DiarySettings({ open, onClose }) {
    const { data: properties } = useDiaryProperties();
    const createProperty = useCreateDiaryProperty();
    const updateProperty = useUpdateDiaryProperty();
    const deleteProperty = useDeleteDiaryProperty();

    const [propertyDrafts, setPropertyDrafts] = useState({});
    const saveTimersRef = useRef({});
    const latestDraftsRef = useRef({});

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
        latestDraftsRef.current = propertyDrafts;
    }, [propertyDrafts]);

    useEffect(() => {
        return () => {
            Object.values(saveTimersRef.current).forEach((timerId) => {
                window.clearTimeout(timerId);
            });
        };
    }, []);

    if (!open) return null;

    const busy = createProperty.isPending || updateProperty.isPending || deleteProperty.isPending;

    const getOriginalProperty = (propertyId) =>
        (properties || []).find((property) => property.id === propertyId);

    const savePropertyDraft = (propertyId, draft) => {
        const name = String(draft?.name || '').trim();
        const type = draft?.type || 'text';
        const icon = draft?.icon || '';

        if (!name) return;

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

    const handleUploadSvgIcon = async (file, onChange) => {
        if (!file) return;
        if (file.type && file.type !== 'image/svg+xml') return;

        const text = await file.text();
        const trimmed = text.trim();
        if (!trimmed.startsWith('<svg')) return;

        onChange(trimmed);
    };

    const handleCreateProperty = async () => {
        await createProperty.mutateAsync({
            name: '새 속성',
            type: 'text',
            icon: '',
        });
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

    const dialog = (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 ui-dialog-backdrop"
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                className="ui-dialog flex max-h-[86vh] w-[min(760px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl p-0"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                    <div>
                        <h2 className="text-sm font-semibold ui-dialog-title">속성 편집</h2>
                    </div>

                    <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
                        onClick={handleCreateProperty}
                        disabled={createProperty.isPending}
                        aria-label="속성 추가"
                        title="속성 추가"
                    >
                        <svg
                            viewBox="0 0 20 20"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="M10 4v12M4 10h12"/>
                        </svg>
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    <div
                        className="grid grid-cols-[108px_minmax(0,1fr)_minmax(0,1fr)_32px] items-center border-b border-border-subtle px-2 py-2 text-[11px] text-[var(--color-text-muted)]">
                        <div>아이콘</div>
                        <div className="mx-2">이름</div>
                        <div className="mx-2">유형</div>
                        <div></div>
                    </div>

                    {(properties || []).map((property) => {
                        const draft = propertyDrafts[property.id] || getDraftFromProperty(property);

                        return (
                            <div
                                key={property.id}
                                className="grid grid-cols-[108px_minmax(0,1fr)_minmax(0,1fr)_32px] items-center border-b border-border-subtle px-2 py-1.5 text-xs hover:bg-[rgba(127,127,127,0.06)]"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                                        <PropertyIcon icon={draft.icon}/>
                                    </span>

                                    <label
                                        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)]"
                                        title="SVG 업로드"
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
                                            <path d="M10 13V4"/>
                                            <path d="M6.5 7.5 10 4l3.5 3.5"/>
                                            <path d="M4 13.5V15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5"/>
                                        </svg>

                                        <input
                                            type="file"
                                            accept="image/svg+xml,.svg"
                                            className="hidden"
                                            onChange={(e) =>
                                                handleUploadSvgIcon(
                                                    e.target.files?.[0],
                                                    (icon) =>
                                                        handleChangePropertyDraft(
                                                            property.id,
                                                            'icon',
                                                            icon,
                                                            0,
                                                        ),
                                                )
                                            }
                                        />
                                    </label>
                                </div>

                                <input
                                    className="h-8 w-[calc(100%-16px)] min-w-0 rounded-md bg-transparent px-2 outline-none hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
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
                                />

                                <select
                                    className="h-8 w-[calc(100%-16px)] rounded-md bg-transparent px-2 outline-none hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
                                    value={draft.type}
                                    onChange={(e) =>
                                        handleChangePropertyDraft(
                                            property.id,
                                            'type',
                                            e.target.value,
                                            0,
                                        )
                                    }
                                >
                                    {PROPERTY_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-red-500 disabled:opacity-30"
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
                            </div>
                        );
                    })}

                    {(properties || []).length === 0 && (
                        <p className="px-2 py-5 text-xs ui-dialog-message">
                            아직 설정한 속성이 없어.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return dialog;

    const portalRoot = document.getElementById('portal-root');
    return createPortal(dialog, portalRoot ?? document.body);
}