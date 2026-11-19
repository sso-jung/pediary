import { useEffect, useRef, useState } from 'react';

export default function CalendarDropdown({ value, label, options, onChange, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={'relative ' + className} ref={menuRef}>
            <button
                type="button"
                className="ui-input flex h-[30px] w-full items-center justify-between gap-1 !rounded-md !px-2 !py-0 !text-left !text-[11.5px] sm:gap-2 sm:!px-2.5 sm:!text-[12px]"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
            >
                <span className="min-w-0 truncate">{label}</span>
                <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5 shrink-0 page-text-muted"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M5.5 7.5L10 12l4.5-4.5" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-[34px] z-30 max-h-72 w-full overflow-y-auto rounded-md border py-1 text-[12px] shadow-lg"
                    style={{
                        borderColor: 'var(--color-border-subtle)',
                        backgroundColor: 'var(--color-page-surface)',
                        color: 'var(--color-text-main)',
                    }}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={
                                'block w-full whitespace-normal break-keep px-2 py-1.5 text-left leading-snug ui-side-subitem ' +
                                (option.value === value ? 'ui-side-subitem-active' : '')
                            }
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
