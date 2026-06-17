export default function OptionBadge({ option, compact = false, onRemove }) {
    if (!option?.name) return null;

    return (
        <span
            className={[
                'inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full font-medium leading-none',
                compact ? 'px-1.5 py-[3px] text-[11px]' : 'px-2 py-1 text-[12px]',
            ].join(' ')}
            style={{
                backgroundColor: option.color || '#e5e7eb',
                color: option.textColor || option.text_color || '#374151',
            }}
        >
            <span className="min-w-0 truncate">{option.name}</span>

            {onRemove && (
                <button
                    type="button"
                    className="ml-0.5 text-[12px] opacity-60 hover:opacity-100"
                    onClick={onRemove}
                    aria-label="선택 해제"
                >
                    ×
                </button>
            )}
        </span>
    );
}
