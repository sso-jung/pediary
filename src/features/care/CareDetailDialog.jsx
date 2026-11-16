import { useEffect, useId, useRef } from 'react';

export default function CareDetailDialog({ title, onClose, children }) {
    const titleId = useId();
    const dialogRef = useRef(null);
    const scrollRef = useRef(null);

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

    return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} className="ui-dialog fixed m-auto max-h-[min(90vh,900px)] w-[calc(100%-1.5rem)] max-w-3xl overflow-hidden rounded-2xl p-0 shadow-xl backdrop:bg-black/40">
        <div className="flex max-h-[min(90vh,900px)] min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-6 sm:py-4">
                <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                <button type="button" className="ui-control rounded-lg border px-3 py-1.5 text-sm" onClick={onClose}>닫기</button>
            </div>
            <div ref={scrollRef} className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </div>
    </dialog>;
}
