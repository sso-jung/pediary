import { CareButton } from './CareControls';
import { CareInput } from './CareControls';
import { useEffect, useRef, useState } from 'react';

export default function CareActionDialog({ message, initialValue, onConfirm, onClose }) {
    const dialogRef = useRef(null);
    const backdropPointer = useRef(null);
    const [value, setValue] = useState(initialValue ?? '');
    const [error, setError] = useState('');

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

    return <dialog ref={dialogRef} aria-label={message} onCancel={(event) => { event.preventDefault(); onClose(); }} onPointerDown={(event) => { backdropPointer.current = isBackdrop(event) ? event.pointerId : null; }} onPointerUp={(event) => { const startedOutside = backdropPointer.current === event.pointerId; backdropPointer.current = null; if (startedOutside && isBackdrop(event) && [...document.querySelectorAll('dialog:modal')].at(-1) === event.currentTarget) onClose(); }} onPointerCancel={() => { backdropPointer.current = null; }} className="care-dialog care-action-dialog ui-dialog fixed w-[calc(100%-1.5rem)] max-w-sm rounded-2xl p-0">
        <form onSubmit={(event) => { event.preventDefault(); if (initialValue != null && (!value.trim() || value.trim().length > 120)) { setError('항목 이름은 1~120자로 입력해 주세요.'); return; } onConfirm(value); }} className="p-5 sm:p-6">
            <p className="text-sm font-medium">{message}</p>
            {initialValue != null && <CareInput autoFocus maxLength={120} value={value} onChange={(event) => { setValue(event.target.value); setError(''); }} aria-label="이 날짜에만 표시할 이름" aria-invalid={!!error} aria-describedby={error ? 'care-action-error' : undefined} className="ui-input mt-4 w-full text-sm" />}
            {error && <p id="care-action-error" role="alert" className="ui-danger-text mt-2 text-sm">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
                <CareButton type="button" className="ui-control rounded-lg border px-4 py-2 text-sm" onClick={onClose}>취소</CareButton>
                <CareButton type="submit" className="ui-btn-success rounded-lg border px-4 py-2 text-sm">확인</CareButton>
            </div>
        </form>
    </dialog>;
}
