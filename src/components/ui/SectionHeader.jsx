// src/components/ui/SectionHeader.jsx
export default function SectionHeader({ title, subtitle }) {
    return (
        <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                {/* 왼쪽 세로 라인 + 타이틀 */}
                <div
                    className="h-6 w-[3px] rounded-full sm:h-7"
                    style={{ backgroundColor: "var(--color-section-line)" }}
                />
                <div>
                    <h1 className="-translate-y-[1px] text-base sm:text-lg font-semibold leading-tight tracking-tight ui-page-title">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-1 text-[11px] sm:text-xs ui-page-subtitle">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
