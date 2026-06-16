import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PropertyIcon } from './DiaryPropertyUtils';
import { useDiaryLayout, useUpdateDiaryLayout } from './hooks/useDiaryLayout';
import { useDiaryProperties } from './hooks/useDiaryProperties';

const VISIBILITY_OPTIONS = [
    { value: 'always', label: '항상 표시' },
    { value: 'when_filled', label: '값 있을 때만' },
    { value: 'hidden', label: '숨김' },
];

function buildLayoutItems(properties = [], layout = []) {
    const layoutMap = new Map((layout || []).map((item) => [item.property_id, item]));

    return (properties || [])
        .map((property) => {
            const layoutItem = layoutMap.get(property.id);

            return {
                propertyId: property.id,
                property,
                sortOrder: layoutItem?.sort_order ?? property.sort_order ?? 0,
                visibility: layoutItem?.visibility || 'always',
            };
        })
        .sort(
            (a, b) =>
                (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                (a.property?.created_at || '').localeCompare(b.property?.created_at || ''),
        );
}

export default function DiaryLayoutSettings({ open, onClose }) {
    const { data: properties } = useDiaryProperties();
    const { data: layout } = useDiaryLayout();
    const updateLayout = useUpdateDiaryLayout();
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!open) return;
        setItems(buildLayoutItems(properties || [], layout || []));
    }, [layout, open, properties]);

    if (!open) return null;

    const saveItems = (nextItems) => {
        setItems(nextItems);
        updateLayout.mutate({
            items: nextItems.map((item) => ({
                propertyId: item.propertyId,
                visibility: item.visibility,
            })),
        });
    };

    const handleMove = (index, amount) => {
        const nextIndex = index + amount;
        if (nextIndex < 0 || nextIndex >= items.length) return;

        const nextItems = [...items];
        const [target] = nextItems.splice(index, 1);
        nextItems.splice(nextIndex, 0, target);
        saveItems(nextItems);
    };

    const handleVisibilityChange = (propertyId, visibility) => {
        const nextItems = items.map((item) =>
            item.propertyId === propertyId
                ? { ...item, visibility }
                : item,
        );
        saveItems(nextItems);
    };

    const handleBackdropMouseDown = (e) => {
        if (e.target !== e.currentTarget) return;
        if (updateLayout.isPending) return;
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
                        <h2 className="text-sm font-semibold ui-dialog-title">레이아웃 편집</h2>
                        <p className="mt-1 text-[11px] ui-dialog-message">
                            다이어리 작성 화면에 표시할 속성과 순서를 정해.
                        </p>
                    </div>
                    {updateLayout.isPending && (
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                            저장 중...
                        </span>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_136px_72px] items-center border-b border-border-subtle px-2 py-2 text-[11px] text-[var(--color-text-muted)]">
                        <div>속성</div>
                        <div>표시</div>
                        <div></div>
                    </div>

                    {items.map((item, index) => (
                        <div
                            key={item.propertyId}
                            className="grid grid-cols-[minmax(0,1fr)_136px_72px] items-center border-b border-border-subtle px-2 py-1.5 text-xs hover:bg-[rgba(127,127,127,0.06)]"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                                    <PropertyIcon icon={item.property?.icon} />
                                </span>
                                <span className="min-w-0 truncate font-medium">
                                    {item.property?.name}
                                </span>
                            </div>

                            <select
                                className="h-8 rounded-md bg-transparent px-2 outline-none hover:bg-[rgba(127,127,127,0.08)] focus:bg-[rgba(127,127,127,0.10)]"
                                value={item.visibility}
                                onChange={(e) =>
                                    handleVisibilityChange(item.propertyId, e.target.value)
                                }
                            >
                                {VISIBILITY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>

                            <div className="flex justify-end gap-1">
                                <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
                                    onClick={() => handleMove(index, -1)}
                                    disabled={index === 0}
                                    aria-label="위로"
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
                                        <path d="M5.5 12.5 10 8l4.5 4.5" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
                                    onClick={() => handleMove(index, 1)}
                                    disabled={index === items.length - 1}
                                    aria-label="아래로"
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
                                        <path d="M5.5 7.5 10 12l4.5-4.5" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}

                    {items.length === 0 && (
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
