import { getOptionBackground } from './DiarySelectUtils';

function isWhiteColor(color) {
    return String(color || '').trim().toLowerCase() === '#ffffff';
}

export default function OptionBadge({ option, compact = false, mobileMonth = false, onRemove }) {
    if (!option?.name) return null;

    const backgroundColor = option.color || '#e5e7eb';
    const textColor = option.textColor || option.text_color || '#374151';
    const hasTextColorBorder = isWhiteColor(backgroundColor);

    return (
        <span
            className={[
                mobileMonth
                    ? 'inline-block w-full max-w-full overflow-hidden rounded-full border px-[1px] text-[8px] font-medium leading-[9px]'
                    : 'inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full border font-medium leading-none',
                mobileMonth ? '' : compact
                    ? 'px-1 py-[2px] text-[10px] sm:px-1.5 sm:py-[3px] sm:text-[11px]'
                    : 'px-1.5 py-[3px] text-[11px] sm:px-2 sm:py-1 sm:text-[12px]',
            ].join(' ')}
            style={{
                background: getOptionBackground(option),
                borderColor: hasTextColorBorder ? textColor : 'transparent',
                color: textColor,
            }}
            title={mobileMonth ? option.name : undefined}
        >
            <span className={mobileMonth ? 'block break-all' : 'min-w-0 truncate'}>{option.name}</span>

            {onRemove && (
                <button
                    type="button"
                    className="ml-0.5 text-[11px] opacity-60 hover:opacity-100 sm:text-[12px]"
                    onClick={onRemove}
                    aria-label="선택 해제"
                >
                    ×
                </button>
            )}
        </span>
    );
}
