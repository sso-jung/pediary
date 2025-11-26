// src/components/ui/EmptyState.jsx
export default function EmptyState({
    icon = 'docs', // 'docs' | 'trash' | 'friends' | 'calendar' | 'stats' | 'profile' | 'lock'
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

        // 🗓 달력(캘린더) 아이콘 - 오늘활동/다이어리 빈 상태 등에
        if (icon === 'calendar') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-violet-400"
                    aria-hidden="true"
                >
                    <rect
                        x="3"
                        y="4"
                        width="18"
                        height="17"
                        rx="2"
                        ry="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <path
                        d="M3 9h18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <path
                        d="M8 3v4M16 3v4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                    <circle cx="9" cy="13" r="0.9" fill="currentColor" />
                    <circle cx="13" cy="13" r="0.9" fill="currentColor" />
                    <circle cx="17" cy="13" r="0.9" fill="currentColor" />
                </svg>
            );
        }

        // 📊 통계/분석 아이콘 - 내정보 통계, 활동 기록 등
        if (icon === 'stats') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-indigo-300"
                    aria-hidden="true"
                >
                    <path
                        d="M4 19h16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                    <rect
                        x="5"
                        y="11"
                        width="3"
                        height="6"
                        rx="1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <rect
                        x="10.5"
                        y="7"
                        width="3"
                        height="10"
                        rx="1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <rect
                        x="16"
                        y="9"
                        width="3"
                        height="8"
                        rx="1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                </svg>
            );
        }

        // 🙂 프로필/내정보 아이콘
        if (icon === 'profile') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-amber-300"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="9"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <path
                        d="M5 19a7 7 0 0 1 14 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                </svg>
            );
        }

        // 🔒 보안/비밀번호 관련 빈 상태
        if (icon === 'lock') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-slate-300"
                    aria-hidden="true"
                >
                    <rect
                        x="5"
                        y="11"
                        width="14"
                        height="9"
                        rx="2"
                        ry="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <path
                        d="M9 11V8a3 3 0 0 1 6 0v3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                    <circle
                        cx="12"
                        cy="15"
                        r="1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                </svg>
            );
        }

        // 📁 폴더 아이콘
        if (icon === 'folder') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-yellow-300"
                    aria-hidden="true"
                >
                    <path
                        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
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
