// src/features/wiki/hooks/useDocumentAutosave.js
import { useEffect, useRef, useState } from 'react';
import { useUpdateDocument } from './useUpdateDocument';
import { useSnackbar } from '../../../components/ui/SnackbarContext';

/**
 * 문서 자동저장을 담당하는 훅
 *
 * @param {object} params
 * @param {number|string} params.documentId - 저장할 문서 ID
 * @param {string} params.content - 현재 에디터 내용(마크다운)
 * @param {boolean} [params.enabled=true] - 자동저장 on/off
 * @param {number} [params.debounceMs=1000] - 디바운스 시간(ms)
 */
export function useDocumentAutosave({
                                        documentId,
                                        content,
                                        enabled = true,
                                        debounceMs = 1000,
                                    }) {
    const updateDocumentMutation = useUpdateDocument();
    const { showSnackbar } = useSnackbar();

    const [status, setStatus] = useState('idle');
    // 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

    const timerRef = useRef(null);
    const lastSavedContentRef = useRef(content);

    // 🔹 자동저장 처리
    useEffect(() => {
        if (!enabled) return;
        if (!documentId) return;

        // 내용이 이전에 저장된 내용과 같으면 자동저장 안 함
        if (content === lastSavedContentRef.current) {
            return;
        }

        setStatus('dirty');

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            setStatus('saving');

            updateDocumentMutation.mutate(
                { id: documentId, content },
                {
                    onSuccess: () => {
                        lastSavedContentRef.current = content;
                        setStatus('saved');
                    },
                    onError: () => {
                        setStatus('error');
                    },
                }
            );
        }, debounceMs);

        // cleanup
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [content, documentId, enabled, debounceMs, updateDocumentMutation]);

    // 🔹 즉시 저장(저장 버튼 / Ctrl+S)용
    const saveNow = () => {
        if (!documentId) return;

        // 디바운스 예약된 거 있으면 취소
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // 이미 저장된 내용이면 굳이 서버 호출 안 함 (에러 상태일 땐 다시 시도 허용)
        if (content === lastSavedContentRef.current && status !== 'error') {
            return;
        }

        setStatus('saving');

        updateDocumentMutation.mutate(
            { id: documentId, content },
            {
                onSuccess: () => {
                    lastSavedContentRef.current = content;
                    setStatus('saved');
                    showSnackbar?.('저장 완료!');
                },
                onError: () => {
                    setStatus('error');
                    showSnackbar?.('저장 중 오류가 발생했어요.');
                },
            }
        );
    };

    const isSaving = status === 'saving';

    return {
        autosaveStatus: status,
        isSaving,
        saveNow,
    };
}
