// src/components/ui/EmptyState.jsx
export default function EmptyState({
    icon = 'docs', // 'docs' | 'trash' | 'friends' 등
    title,
    description,
}) {
    const renderIcon = () => {
        if (icon === 'trash') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-rose-300"
                    aria-hidden="true"
                >
                    <polyline
                        points="3 6 5 6 21 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            );
        }

        if (icon === 'friends') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-sky-300"
                    aria-hidden="true"
                >
                    <circle
                        cx="9"
                        cy="9"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <circle
                        cx="17"
                        cy="9"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <path
                        d="M4 19a4.5 4.5 0 0 1 9 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                    <path
                        d="M12.5 18.5a4.5 4.5 0 0 1 7.5 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                </svg>
            );
        }

        // 기본: 문서 아이콘
        return (
            <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-slate-300"
                aria-hidden="true"
            >
                <rect
                    x="5"
                    y="3"
                    width="12"
                    height="18"
                    rx="2"
                    ry="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                />
                <path
                    d="M9 8h4M9 12h6M9 16h3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                />
            </svg>
        );
    };

    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                {renderIcon()}
            </div>
            <div className="text-[13px] font-medium text-slate-800">{title}</div>
            {description && (
                <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-400 whitespace-pre-line">
                    {description}
                </p>
            )}
        </div>
    );
}
