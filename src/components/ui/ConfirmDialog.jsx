// src/components/ui/ConfirmDialog.jsx
import React from 'react';
import { createPortal } from 'react-dom';

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

    const dialog = (
        <div className="fixed inset-0 z-40 flex items-center justify-center ui-dialog-backdrop">
            <div className="w-full max-w-sm rounded-2xl p-4 ui-dialog">
                {title && <h2 className="text-sm font-semibold ui-dialog-title">{title}</h2>}
                {message && (
                    <p className="mt-2 text-xs leading-relaxed whitespace-pre-line ui-dialog-message">
                        {message}
                    </p>
                )}

                <div className="mt-4 flex justify-end gap-2 text-xs">
                    <button type="button" onClick={onCancel} className="ui-btn-cancel">
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="ui-btn-danger px-3 py-1.5 text-xs"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return dialog;

    // ✅ app-shell 내부의 portal-root로 렌더
    const portalRoot = document.getElementById('portal-root');
    return createPortal(dialog, portalRoot ?? document.body);
}
