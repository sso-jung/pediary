// src/components/ui/Button.jsx

export default function Button({
    children,
    className = '',
    variant = 'primary',
    ...props
}) {
    const base =
        [
            "inline-flex items-center justify-center",
            "rounded-2xl px-[10px] py-[4px] text-[11pt] font-medium",
            "transition",
            "focus:outline-none focus:ring-2",          // 링은 유지
            "focus:ring-[var(--color-btn-ring)]",       // ✅ 토큰
            "focus:ring-offset-0",                      // ✅ 다크에서 하얀 오프셋 방지
            "active:translate-y-[1px]",
        ].join(" ");

    const variants = {
        primary: [
            "bg-[var(--color-btn-primary-bg)]",
            "hover:bg-[var(--color-btn-primary-hover-bg)]",
            "text-[var(--color-btn-primary-fg)]",
            "border border-[var(--color-btn-primary-border)]",
            "shadow-sm hover:shadow",                   // ✅ 과한 shadow-soft 제거
        ].join(" "),

        ghost: [
            "btn-ghost",
            "bg-transparent",
            "text-[var(--color-btn-ghost-fg)]",
            "hover:bg-[var(--color-btn-ghost-hover-bg)]",
            "data-[active=true]:bg-[var(--color-btn-ghost-active-bg)]",
            "data-[active=true]:text-[var(--color-btn-ghost-active-fg)]",
            "shadow-none hover:shadow-none",            // ✅ ghost는 그림자 제거
            "border",
        ].join(" "),
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
