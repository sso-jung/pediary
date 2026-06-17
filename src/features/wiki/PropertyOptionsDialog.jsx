import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    DEFAULT_OPTION_COLOR,
    OPTION_COLOR_PRESETS,
    getOptionTextColor,
} from './DiarySelectUtils';
import OptionBadge from './OptionBadge';

function ColorDot({ color, selected, onClick }) {
    return (
        <button
            type="button"
            className={[
                'h-4 w-4 rounded-full border transition',
                selected ? 'scale-110 border-[var(--color-text-main)]' : 'border-[rgba(0,0,0,0.08)]',
            ].join(' ')}
            style={{ backgroundColor: color }}
            onClick={onClick}
            aria-label={color}
        />
    );
}

export default function PropertyOptionsDialog({
                                                  property,
                                                  options = [],
                                                  onCreate,
                                                  onUpdate,
                                                  onDelete,
                                                  onClose,
                                              }) {
    const [newOptionName, setNewOptionName] = useState('');
    const [optionNames, setOptionNames] = useState({});
    const [editingOptionId, setEditingOptionId] = useState(null);

    useEffect(() => {
        setOptionNames((prev) => {
            const next = {};

            (options || []).forEach((option) => {
                next[option.id] = prev[option.id] ?? option.name ?? '';
            });

            return next;
        });
    }, [options]);

    useEffect(() => {
        if (!editingOptionId) return;
        if ((options || []).some((option) => option.id === editingOptionId)) return;

        setEditingOptionId(null);
    }, [editingOptionId, options]);

    if (!property) return null;

    const sortedOptions = [...options].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id ?? 0) - (b.id ?? 0),
    );

    const handleCreate = async () => {
        const name = newOptionName.trim();
        if (!name) return;

        await onCreate({
            propertyId: property.id,
            name,
            color: DEFAULT_OPTION_COLOR,
            textColor: getOptionTextColor(DEFAULT_OPTION_COLOR),
            sortOrder: sortedOptions.length,
        });

        setNewOptionName('');
    };

    const editingOption = sortedOptions.find((option) => option.id === editingOptionId);
    const editingOptionBg = editingOption?.color || DEFAULT_OPTION_COLOR;
    const editingOptionText = getOptionTextColor(editingOptionBg);
    const editingOptionName = editingOption
        ? optionNames[editingOption.id] ?? editingOption.name ?? ''
        : '';

    const saveOptionName = (option, nameValue) => {
        const name = String(nameValue || '').trim();

        if (!name) {
            setOptionNames((prev) => ({
                ...prev,
                [option.id]: option.name,
            }));
            return;
        }

        if (name === option.name) return;

        onUpdate({
            optionId: option.id,
            name,
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"
            onMouseDown={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget) {
                    onClose?.();
                }
            }}
        >
            <div
                className="ui-dialog w-[min(520px,calc(100vw-32px))] rounded-2xl p-4"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--color-text-main)]">
                        옵션 관리
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                        {property.name}
                    </p>
                </div>

                <div className="max-h-[32vh] overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-1.5">
                        {sortedOptions.map((option) => {
                            const currentBg = option.color || DEFAULT_OPTION_COLOR;
                            const currentText = getOptionTextColor(currentBg);
                            const draftName = optionNames[option.id] ?? option.name ?? '';

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={[
                                        "max-w-full rounded-full p-[2px] transition",
                                        editingOptionId === option.id
                                            ? "bg-[rgba(127,127,127,0.16)]"
                                            : "hover:bg-[rgba(127,127,127,0.08)]",
                                    ].join(" ")}
                                    onClick={() => setEditingOptionId(option.id)}
                                >
                                    <OptionBadge
                                        option={{
                                            name: draftName || option.name,
                                            color: currentBg,
                                            textColor: currentText,
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    {sortedOptions.length === 0 && (
                        <p className="px-1 py-4 text-xs text-[var(--color-text-muted)]">
                            아직 옵션이 없어.
                        </p>
                    )}
                </div>

                {editingOption && (
                    <div className="mt-3 rounded-lg border border-border-subtle px-3 py-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <OptionBadge
                                option={{
                                    name: editingOptionName || editingOption.name,
                                    color: editingOptionBg,
                                    textColor: editingOptionText,
                                }}
                            />

                            <button
                                type="button"
                                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-red-500 transition hover:bg-red-500/10"
                                onClick={() => onDelete({ optionId: editingOption.id })}
                            >
                                삭제
                            </button>
                        </div>

                        <input
                            className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                            value={editingOptionName}
                            onChange={(e) =>
                                setOptionNames((prev) => ({
                                    ...prev,
                                    [editingOption.id]: e.target.value,
                                }))
                            }
                            onBlur={(e) => saveOptionName(editingOption, e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;

                                e.preventDefault();
                                saveOptionName(editingOption, e.currentTarget.value);
                                e.currentTarget.blur();
                            }}
                        />

                        <div className="mt-2 flex flex-wrap gap-1">
                            {OPTION_COLOR_PRESETS.map((preset) => (
                                <ColorDot
                                    key={preset.color}
                                    color={preset.color}
                                    selected={editingOptionBg === preset.color}
                                    onClick={() =>
                                        onUpdate({
                                            optionId: editingOption.id,
                                            color: preset.color,
                                            textColor: preset.textColor,
                                        })
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
                    <input
                        className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                        value={newOptionName}
                        onChange={(e) => setNewOptionName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreate();
                            }
                        }}
                        placeholder="새 옵션"
                    />

                    <button
                        type="button"
                        className="h-8 shrink-0 rounded-md px-3 text-xs font-medium transition hover:bg-[rgba(127,127,127,0.08)]"
                        onClick={handleCreate}
                    >
                        추가
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
