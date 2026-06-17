import { useEffect, useMemo, useRef, useState } from 'react';
import OptionBadge from './OptionBadge';
import {
    DEFAULT_OPTION_COLOR, DEFAULT_OPTION_TEXT_COLOR,
    makeOptionValue,
    normalizeOptionValue,
    normalizeOptionValues,
} from './DiarySelectUtils';

function sameOptionName(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export default function DiaryOptionSelectField({
                                                   value,
                                                   options = [],
                                                   multiple = false,
                                                   onChange,
                                                   onCreateOption,
                                                   onBlur,
                                                   disabled,
                                               }) {
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const [keyword, setKeyword] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedOptions = useMemo(() => {
        if (multiple) return normalizeOptionValues(value);

        const option = normalizeOptionValue(value);
        return option ? [option] : [];
    }, [multiple, value]);

    const filteredOptions = useMemo(() => {
        const text = keyword.trim().toLowerCase();

        return (options || [])
            .filter((option) => {
                const name = String(option.name || '').trim();
                if (!name) return false;

                if (multiple && selectedOptions.some((selected) => sameOptionName(selected.name, name))) {
                    return false;
                }

                if (!text) return true;
                return name.toLowerCase().includes(text);
            })
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }, [keyword, multiple, options, selectedOptions]);

    const hasExactOption = (options || []).some((option) =>
        sameOptionName(option.name, keyword),
    );

    const exactOption = (options || []).find((option) =>
        sameOptionName(option?.name, keyword),
    );

    const canCreate = keyword.trim() && !hasExactOption;

    useEffect(() => {
        if (!isOpen) return;

        const handleMouseDown = (e) => {
            if (!rootRef.current) return;
            if (rootRef.current.contains(e.target)) return;

            setIsOpen(false);
            onBlur?.();
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen, onBlur]);

    const selectOption = (option) => {
        const nextOption = makeOptionValue(option);

        if (!nextOption.name) return;

        if (!multiple) {
            onChange(nextOption);
            setKeyword('');
            setIsOpen(false);
            onBlur?.();
            return;
        }

        const exists = selectedOptions.some((selected) =>
            sameOptionName(selected.name, nextOption.name),
        );

        if (!exists) {
            onChange([...selectedOptions, nextOption]);
        }

        setKeyword('');
        setIsOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    const removeOption = (name) => {
        if (!multiple) {
            onChange(null);
            onBlur?.();
            return;
        }

        onChange(selectedOptions.filter((option) => !sameOptionName(option.name, name)));
        onBlur?.();
    };

    return (
        <div ref={rootRef} className="relative">
            <div
                className={[
                    'ui-input flex min-h-7 w-full flex-wrap items-center gap-1 !rounded-md !px-1.5 !py-1 text-xs',
                    disabled ? 'opacity-60' : '',
                ].join(' ')}
                onClick={() => {
                    if (disabled) return;
                    setIsOpen(true);
                    inputRef.current?.focus();
                }}
            >
                {selectedOptions.map((option) => (
                    <OptionBadge
                        key={option.name}
                        option={option}
                        onRemove={() => removeOption(option.name)}
                    />
                ))}

                <input
                    ref={inputRef}
                    className="min-w-[72px] flex-1 bg-transparent px-1 py-0.5 text-xs outline-none"
                    value={keyword}
                    onChange={(e) => {
                        setKeyword(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={async (e) => {
                        if (e.key !== 'Enter') return;

                        e.preventDefault();

                        const name = keyword.trim();
                        if (!name) return;

                        const exact = (options || []).find((option) =>
                            sameOptionName(option.name, name),
                        );

                        if (exact) {
                            selectOption(exact);
                            return;
                        }

                        const created = await onCreateOption?.({
                            name,
                            color: DEFAULT_OPTION_COLOR,
                            textColor: DEFAULT_OPTION_TEXT_COLOR,
                        });

                        selectOption(created || {
                            name,
                            color: DEFAULT_OPTION_COLOR,
                            textColor: DEFAULT_OPTION_TEXT_COLOR,
                        });
                    }}
                    disabled={disabled}
                    placeholder={selectedOptions.length === 0 ? '' : ''}
                />
            </div>

            {isOpen && !disabled && (
                <div
                    className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-56 w-full overflow-y-auto rounded-lg border py-1 text-xs shadow-lg"
                    style={{
                        borderColor: 'var(--color-border-subtle)',
                        backgroundColor: 'var(--color-page-surface)',
                        color: 'var(--color-text-main)',
                    }}
                >
                    {filteredOptions.map((option) => (
                        <button
                            key={option.id ?? option.name}
                            type="button"
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-[rgba(127,127,127,0.08)]"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectOption(option)}
                        >
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: option.color || DEFAULT_OPTION_COLOR }}
                            />
                            <span className="min-w-0 truncate">{option.name}</span>
                        </button>
                    ))}

                    {filteredOptions.length === 0 && !canCreate && (
                        <div className="px-2 py-2 text-[var(--color-text-muted)]">
                            옵션이 없어.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}