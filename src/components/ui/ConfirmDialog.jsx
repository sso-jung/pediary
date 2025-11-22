// src/components/ui/ConfirmDialog.jsx
import React from 'react';
import Button from './Button';

export default function ConfirmDialog({
    open,
    title = '확인',
    message,
    confirmText = '확인',
    cancelText = '취소',
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
            <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
                {title && (
                    <h2 className="text-sm font-semibold text-slate-800">
                        {title}
                    </h2>
                )}

                {message && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 whitespace-pre-line">
                        {message}
                    </p>
                )}

                <div className="mt-4 flex justify-end gap-2 text-xs">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
                    >
                        {cancelText}
                    </button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        className="bg-rose-500 hover:bg-rose-600 px-3 py-1.5 text-xs"
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
