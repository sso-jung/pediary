import { useEffect, useId, useRef } from 'react';

export default function CareDetailDialog({ title, headerAction, onClose, children, className = '' }) {
    const titleId = useId();
    const dialogRef = useRef(null);
    const scrollRef = useRef(null);
    const backdropPointer = useRef(null);

    const isBackdrop = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };

    useEffect(() => {
        const previous = document.activeElement;
        const dialog = dialogRef.current;
        dialog.showModal();
        return () => {
            dialog.close();
            previous?.focus?.();
        };
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollTo(0, 0);
    }, [title]);

    return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onPointerDown={(event) => { backdropPointer.current = isBackdrop(event) ? event.pointerId : null; }} onPointerUp={(event) => { const startedOutside = backdropPointer.current === event.pointerId; backdropPointer.current = null; if (startedOutside && isBackdrop(event) && [...document.querySelectorAll('dialog:modal')].at(-1) === event.currentTarget) onClose(); }} onPointerCancel={() => { backdropPointer.current = null; }} className={`care-dialog ui-dialog fixed max-h-[min(90vh,900px)] w-[calc(100%-1.5rem)] max-w-3xl overflow-hidden rounded-2xl p-0 shadow-xl backdrop:bg-black/40 ${className}`}>
        <div className="flex max-h-[min(90vh,900px)] min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle px-4 py-3 sm:px-6 sm:py-4">
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                {headerAction}
            </div>
            <div ref={scrollRef} className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </div>
    </dialog>;
}
