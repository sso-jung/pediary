// src/components/ui/Button.jsx

export default function Button({
    children,
    className = '',
    variant = 'primary',
    ...props
}) {
    const base =
        'inline-flex items-center justify-center rounded-2xl px-[12px] py-[6px] text-sm font-medium shadow-soft transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
        primary: [
            // ✅ 기본색: 기존 hover 색을 기본으로
            'bg-[#8498c4]',          // 라벤더 파스텔
            // ✅ hover 시: 한 톤 더 진하게
            'hover:bg-[#687ba6]',
            // 텍스트: 흰색
            'text-white',
            // 포커스 링
            'focus:ring-[#A8B7D6]/70',
            // 푸딩처럼 살짝 눌리는 느낌
            'active:translate-y-[1px] active:shadow-sm',
        ].join(' '),

        ghost:
            'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus:ring-primary-200',
    };

    const variantClass = variants[variant] || variants.primary;

    return (
        <button
            className={`${base} ${variantClass} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
