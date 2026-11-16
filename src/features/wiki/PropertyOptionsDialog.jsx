import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    DEFAULT_OPTION_COLOR,
    DEFAULT_OPTION_TEXT_COLOR,
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

function getSavedTextColor(option, fallbackColor) {
    return option?.textColor || option?.text_color || getOptionTextColor(fallbackColor);
}

function getColorInputValue(color, fallback) {
    const value = String(color || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export default function PropertyOptionsDialog({
                                                  property,
                                                  options = [],
                                                  goalSets = [],
                                                  onCreate,
                                                  onUpdate,
                                                  onDelete,
                                                  onCreateGoalSet,
                                                  onUpdateGoalSet,
                                                  onDeleteGoalSet,
                                                  onCreateGoalItem,
                                                  onUpdateGoalItem,
                                                  onDeleteGoalItem,
                                                  onClose,
                                              }) {
    const [newOptionName, setNewOptionName] = useState('');
    const [newGoalSetName, setNewGoalSetName] = useState('');
    const [newGoalStartDate, setNewGoalStartDate] = useState('');
    const [newGoalEndDate, setNewGoalEndDate] = useState('');
    const [newGoalItemNames, setNewGoalItemNames] = useState({});
    const [goalPage, setGoalPage] = useState(0);
    const [expandedGoalSetId, setExpandedGoalSetId] = useState(null);
    const [optionNames, setOptionNames] = useState({});
    const [editingOptionId, setEditingOptionId] = useState(null);
    const [editingColors, setEditingColors] = useState([]);
    const [editingColorIndex, setEditingColorIndex] = useState(0);
    const [editingTextColor, setEditingTextColor] = useState('');
    const colorSaveTimerRef = useRef(null);

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

    const isGoalProperty = property.type === 'goal';
    const sortedOptions = [...options].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id ?? 0) - (b.id ?? 0),
    );
    const sortedGoalSets = [...(goalSets || [])].sort(
        (a, b) =>
            String(b.start_date || '').localeCompare(String(a.start_date || '')) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            (a.id ?? 0) - (b.id ?? 0),
    );
    const goalPageCount = Math.ceil(sortedGoalSets.length / 10);
    const currentGoalPage = Math.min(goalPage, Math.max(0, goalPageCount - 1));
    const visibleGoalSets = sortedGoalSets.slice(currentGoalPage * 10, (currentGoalPage + 1) * 10);

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
    const editingOptionBg = editingColors[0] || editingOption?.color || DEFAULT_OPTION_COLOR;
    const editingOptionText = editingTextColor || getSavedTextColor(editingOption, editingOptionBg);
    const editingOptionName = editingOption
        ? optionNames[editingOption.id] ?? editingOption.name ?? ''
        : '';
    const isListOptionProperty = property.type === 'random_pick';

    const selectEditingOption = (option) => {
        if (editingOptionId === option.id) return;
        if (colorSaveTimerRef.current) saveEditingColors(editingColors);
        setEditingOptionId(option.id);
        setEditingColors(option.background_colors?.length > 1 ? [...option.background_colors] : [option.color || DEFAULT_OPTION_COLOR]);
        setEditingColorIndex(0);
        setEditingTextColor(getSavedTextColor(option, option.color || DEFAULT_OPTION_COLOR));
    };

    const saveEditingColors = (colors, textColor = editingOptionText) => {
        window.clearTimeout(colorSaveTimerRef.current);
        colorSaveTimerRef.current = null;
        onUpdate({
            optionId: editingOption.id,
            color: colors[0],
            backgroundColors: colors.length > 1 ? colors : null,
            textColor,
        });
    };

    const queueEditingColorsSave = (colors, textColor = editingOptionText) => {
        window.clearTimeout(colorSaveTimerRef.current);
        colorSaveTimerRef.current = window.setTimeout(() => saveEditingColors(colors, textColor), 180);
    };

    const handleCreateGoalSet = async () => {
        const name = String(newGoalSetName || '').trim();
        if (!name || !newGoalStartDate || !newGoalEndDate) return;

        await onCreateGoalSet?.({
            propertyId: property.id,
            name,
            startDate: newGoalStartDate,
            endDate: newGoalEndDate,
            sortOrder: sortedGoalSets.length,
        });

        setNewGoalSetName('');
        setNewGoalStartDate('');
        setNewGoalEndDate('');
        setGoalPage(0);
    };

    const handleCreateGoalItem = async (goalSet) => {
        const name = String(newGoalItemNames[goalSet.id] || '').trim();
        if (!name) return;

        await onCreateGoalItem?.({
            goalSetId: goalSet.id,
            name,
            sortOrder: goalSet.diary_goal_items?.length || 0,
        });

        setNewGoalItemNames((prev) => ({
            ...prev,
            [goalSet.id]: '',
        }));
    };

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

    if (isGoalProperty) {
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
                    className="property-options-dialog ui-dialog flex max-h-[min(760px,calc(100vh-32px))] w-[min(640px,calc(100vw-32px))] flex-col rounded-2xl p-4"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="mb-3">
                        <p className="text-sm font-semibold text-[var(--color-text-main)]">
                            목표 관리
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                            {property.name}
                        </p>
                    </div>

                    <div key={currentGoalPage} className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="space-y-2">
                            {visibleGoalSets.map((goalSet) => (
                                <div key={goalSet.id} className="rounded-lg border border-border-subtle p-2">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 text-left text-xs text-[var(--color-text-main)] hover:bg-[rgba(127,127,127,0.08)]"
                                            onClick={() => setExpandedGoalSetId((prev) => prev === goalSet.id ? null : goalSet.id)}
                                            aria-expanded={expandedGoalSetId === goalSet.id}
                                            aria-controls={`goal-items-${goalSet.id}`}
                                        >
                                            <span className="shrink-0">{expandedGoalSetId === goalSet.id ? '▾' : '▸'}</span>
                                            <span className="min-w-0 flex-1 truncate">{goalSet.name || '목표 기간명 없음'}</span>
                                            <span className="shrink-0 text-[var(--color-text-muted)]">
                                                {goalSet.start_date || '시작일 없음'} ~ {goalSet.end_date || '종료일 없음'}
                                            </span>
                                        </button>
                                    </div>

                                    {expandedGoalSetId === goalSet.id && (
                                        <div id={`goal-items-${goalSet.id}`}>
                                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_118px_118px_auto] gap-1.5">
                                                <input
                                                    className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                                                    defaultValue={goalSet.name || ''}
                                                    onBlur={(e) =>
                                                        onUpdateGoalSet?.({
                                                            goalSetId: goalSet.id,
                                                            name: e.target.value,
                                                        })
                                                    }
                                                />
                                                <input
                                                    type="date"
                                                    className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                                                    defaultValue={goalSet.start_date || ''}
                                                    onBlur={(e) =>
                                                        onUpdateGoalSet?.({
                                                            goalSetId: goalSet.id,
                                                            startDate: e.target.value,
                                                        })
                                                    }
                                                />
                                                <input
                                                    type="date"
                                                    className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                                                    defaultValue={goalSet.end_date || ''}
                                                    onBlur={(e) =>
                                                        onUpdateGoalSet?.({
                                                            goalSetId: goalSet.id,
                                                            endDate: e.target.value,
                                                        })
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    className="h-8 shrink-0 rounded px-2 text-[11px] font-medium text-red-500 transition hover:bg-red-500/10"
                                                    onClick={() => {
                                                        if (window.confirm('이 목표 기간을 삭제할까?')) {
                                                            onDeleteGoalSet?.({ goalSetId: goalSet.id });
                                                        }
                                                    }}
                                                >
                                                    삭제
                                                </button>
                                            </div>

                                            <div className="mt-2 space-y-1">
                                                {(goalSet.diary_goal_items || []).map((item) => (
                                                    <div key={item.id} className="flex items-center gap-1.5">
                                                        <input
                                                            className="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
                                                            defaultValue={item.name || ''}
                                                            onBlur={(e) =>
                                                                onUpdateGoalItem?.({
                                                                    goalItemId: item.id,
                                                                    name: e.target.value,
                                                                })
                                                            }
                                                        />
                                                        <button
                                                            type="button"
                                                            className="h-7 shrink-0 rounded px-2 text-[11px] font-medium text-red-500 transition hover:bg-red-500/10"
                                                            onClick={() => onDeleteGoalItem?.({ goalItemId: item.id })}
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                ))}

                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        className="ui-input !h-7 !rounded-md !px-2 !py-0 text-xs"
                                                        value={newGoalItemNames[goalSet.id] || ''}
                                                        onChange={(e) =>
                                                            setNewGoalItemNames((prev) => ({
                                                                ...prev,
                                                                [goalSet.id]: e.target.value,
                                                            }))
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleCreateGoalItem(goalSet);
                                                            }
                                                        }}
                                                        placeholder="새 목표항목"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="h-7 shrink-0 rounded-md px-2 text-[11px] font-medium transition hover:bg-[rgba(127,127,127,0.08)]"
                                                        onClick={() => handleCreateGoalItem(goalSet)}
                                                    >
                                                        추가
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {sortedGoalSets.length === 0 && (
                                <p className="px-1 py-4 text-xs text-[var(--color-text-muted)]">
                                    아직 목표 기간이 없어.
                                </p>
                            )}
                        </div>
                    </div>

                    {goalPageCount > 1 && (
                        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
                            <button
                                type="button"
                                className="rounded px-2 py-1 transition hover:bg-[rgba(127,127,127,0.08)] disabled:opacity-40"
                                onClick={() => setGoalPage(currentGoalPage - 1)}
                                disabled={currentGoalPage === 0}
                            >
                                이전
                            </button>
                            <span>{currentGoalPage + 1} / {goalPageCount}</span>
                            <button
                                type="button"
                                className="rounded px-2 py-1 transition hover:bg-[rgba(127,127,127,0.08)] disabled:opacity-40"
                                onClick={() => setGoalPage(currentGoalPage + 1)}
                                disabled={currentGoalPage >= goalPageCount - 1}
                            >
                                다음
                            </button>
                        </div>
                    )}

                    <div className="property-options-divider mt-3 grid grid-cols-[minmax(0,1fr)_118px_118px_auto] gap-1.5 border-t border-border-subtle pt-3">
                        <input
                            className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                            value={newGoalSetName}
                            onChange={(e) => setNewGoalSetName(e.target.value)}
                            placeholder="목표 기간명"
                        />
                        <input
                            type="date"
                            className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                            value={newGoalStartDate}
                            onChange={(e) => setNewGoalStartDate(e.target.value)}
                        />
                        <input
                            type="date"
                            className="ui-input !h-8 !rounded-md !px-2 !py-0 text-xs"
                            value={newGoalEndDate}
                            onChange={(e) => setNewGoalEndDate(e.target.value)}
                        />
                        <button
                            type="button"
                            className="h-8 shrink-0 rounded-md px-3 text-xs font-medium transition hover:bg-[rgba(127,127,127,0.08)]"
                            onClick={handleCreateGoalSet}
                        >
                            추가
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
        );
    }

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
                className="property-options-dialog ui-dialog w-[min(520px,calc(100vw-32px))] rounded-2xl p-4"
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

                <div className={isListOptionProperty ? "max-h-[48vh] overflow-y-auto pr-1" : "max-h-[32vh] overflow-y-auto pr-1"}>
                    {isListOptionProperty ? (
                        <div className="space-y-0.5">
                            {sortedOptions.map((option) => {
                                const draftName = optionNames[option.id] ?? option.name ?? '';
                                const isEditing = editingOptionId === option.id;

                                return (
                                    <div
                                        key={option.id}
                                        className="flex items-center gap-1.5"
                                    >
                                        <input
                                            className="ui-input !h-6 !rounded !px-1.5 !py-0 text-xs"
                                            value={draftName}
                                            readOnly={!isEditing}
                                            onDoubleClick={() => setEditingOptionId(option.id)}
                                            onChange={(e) =>
                                                setOptionNames((prev) => ({
                                                    ...prev,
                                                    [option.id]: e.target.value,
                                                }))
                                            }
                                            onBlur={(e) => {
                                                saveOptionName(option, e.target.value);
                                                setEditingOptionId(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    setOptionNames((prev) => ({
                                                        ...prev,
                                                        [option.id]: option.name,
                                                    }));
                                                    setEditingOptionId(null);
                                                    e.currentTarget.blur();
                                                    return;
                                                }

                                                if (e.key !== 'Enter') return;

                                                e.preventDefault();
                                                saveOptionName(option, e.currentTarget.value);
                                                setEditingOptionId(null);
                                                e.currentTarget.blur();
                                            }}
                                        />

                                        <button
                                            type="button"
                                            className="h-6 shrink-0 rounded px-1.5 text-[11px] font-medium text-red-500 transition hover:bg-red-500/10"
                                            onClick={() => onDelete({ optionId: option.id })}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {sortedOptions.map((option) => {
                                const currentBg = option.color || DEFAULT_OPTION_COLOR;
                                const currentText = getSavedTextColor(option, currentBg);
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
                                        onClick={() => selectEditingOption(option)}
                                    >
                                        <OptionBadge
                                            option={{
                                                name: draftName || option.name,
                                                color: currentBg,
                                                backgroundColors: option.background_colors,
                                                textColor: currentText,
                                            }}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {sortedOptions.length === 0 && (
                        <p className="px-1 py-4 text-xs text-[var(--color-text-muted)]">
                            아직 옵션이 없어.
                        </p>
                    )}
                </div>

                {editingOption && !isListOptionProperty && (
                    <div className="property-options-panel mt-3 rounded-lg border border-border-subtle px-3 py-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <OptionBadge
                                option={{
                                    name: editingOptionName || editingOption.name,
                                    color: editingOptionBg,
                                    backgroundColors: editingColors.length > 1 ? editingColors : null,
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
                                    selected={editingColors[editingColorIndex] === preset.color}
                                    onClick={() => {
                                        const colors = [...editingColors];
                                        colors[editingColorIndex] = preset.color;
                                        setEditingColors(colors);
                                        if (editingColorIndex === 0) setEditingTextColor(preset.textColor);
                                        saveEditingColors(colors, editingColorIndex === 0 ? preset.textColor : editingOptionText);
                                    }}
                                />
                            ))}
                        </div>

                        <div className="property-options-divider mt-2 space-y-1.5 border-t border-border-subtle pt-2">
                            {editingColors.map((color, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="w-12 text-[11px] text-[var(--color-text-muted)]">배경 {index + 1}</span>
                                    <input
                                        type="color"
                                        className={`h-6 w-8 cursor-pointer rounded border border-border-subtle bg-transparent p-0 ${editingColorIndex === index ? 'ring-1 ring-[var(--color-text-main)]' : ''}`}
                                        value={getColorInputValue(color, DEFAULT_OPTION_COLOR)}
                                        onFocus={() => setEditingColorIndex(index)}
                                        onChange={(e) => {
                                            const colors = editingColors.map((item, i) => i === index ? e.target.value : item);
                                            setEditingColors(colors);
                                            queueEditingColorsSave(colors);
                                        }}
                                        onBlur={() => saveEditingColors(editingColors)}
                                        aria-label={`배경색 ${index + 1}`}
                                    />
                                    <button
                                        type="button"
                                        className="ml-auto h-6 rounded px-2 text-xs text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] disabled:opacity-40"
                                        onClick={() => {
                                            const colors = editingColors.filter((_, i) => i !== index);
                                            setEditingColors(colors);
                                            setEditingColorIndex((prev) => prev > index ? prev - 1 : Math.min(prev, colors.length - 1));
                                            saveEditingColors(colors);
                                        }}
                                        disabled={editingColors.length <= 1}
                                        aria-label={`배경색 ${index + 1} 제거`}
                                    >
                                        −
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className="rounded px-1 text-xs text-[var(--color-text-muted)] transition hover:bg-[rgba(127,127,127,0.08)] disabled:opacity-40"
                                onClick={() => {
                                    const colors = [...editingColors, editingColors[editingColors.length - 1]];
                                    setEditingColors(colors);
                                    setEditingColorIndex(colors.length - 1);
                                    saveEditingColors(colors);
                                }}
                                disabled={editingColors.length >= 3}
                                aria-label="배경색 추가"
                            >
                                + 배경색 추가
                            </button>
                            <label className="flex items-center gap-1.5 border-t border-border-subtle pt-2 text-[11px] text-[var(--color-text-muted)]">
                                <span className="w-12">글자</span>
                                <input
                                    type="color"
                                    className="h-6 w-8 cursor-pointer rounded border border-border-subtle bg-transparent p-0"
                                    value={getColorInputValue(editingOptionText, DEFAULT_OPTION_TEXT_COLOR)}
                                    onChange={(e) => {
                                        setEditingTextColor(e.target.value);
                                        queueEditingColorsSave(editingColors, e.target.value);
                                    }}
                                    onBlur={() => saveEditingColors(editingColors)}
                                />
                            </label>
                        </div>
                    </div>
                )}

                <div className="property-options-divider mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
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
                        placeholder={property.type === 'random_pick' ? '새 항목' : '새 옵션'}
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
