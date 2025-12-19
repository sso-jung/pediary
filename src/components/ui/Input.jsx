export default function Input({ className = '', ...props }) {
    return (
        <input
            className={[
                "ui-input",
                "w-full rounded-xl border px-[12px] py-[6px] text-[9.5pt] shadow-sm outline-none",
                "transition",
                "focus:ring-2 focus:ring-[var(--color-btn-ring)] focus:ring-offset-0",
                className,
            ].join(" ")}
            style={{
                backgroundColor: "var(--color-control-bg)",
                borderColor: "var(--color-control-border)",
                color: "var(--color-text-main)",
            }}
            {...props}
        />
    );
}