// src/components/ui/SectionHeader.jsx
export default function SectionHeader({ title, subtitle }) {
    return (
        <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
                {/* 왼쪽 세로 라인 + 타이틀 */}
                <div
                    className="mt-[2px] h-8 w-[3px] rounded-full"
                    style={{ backgroundColor: "var(--color-section-line)" }}
                />
                <div>
                    <h1 className="text-base sm:text-lg font-semibold tracking-tight ui-page-title">
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
