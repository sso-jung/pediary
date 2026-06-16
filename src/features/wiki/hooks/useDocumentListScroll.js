import { useEffect, useRef } from 'react';
import { useNavigationType } from 'react-router-dom';

const DOCUMENT_SCROLL_STORAGE_PREFIX = 'pediary.documentList.scroll';
const documentListScrollMap = new Map();

function readStoredScroll(storageKey) {
    const stored = Number(documentListScrollMap.get(storageKey));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

export function useDocumentListScroll(scope, enabled, restoreKey) {
    const navigationType = useNavigationType();
    const scrollRef = useRef(null);
    const didRestoreRef = useRef(false);
    const storageKey = `${DOCUMENT_SCROLL_STORAGE_PREFIX}.${scope}`;

    useEffect(() => {
        didRestoreRef.current = false;
    }, [storageKey]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const saveScroll = () => {
            documentListScrollMap.set(storageKey, el.scrollTop);
        };

        el.addEventListener('scroll', saveScroll);

        return () => {
            saveScroll();
            el.removeEventListener('scroll', saveScroll);
        };
    }, [storageKey]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!enabled || !el || didRestoreRef.current || typeof window === 'undefined') return;
        if (navigationType !== 'POP') return;

        const scrollTop = readStoredScroll(storageKey);
        const frame = window.requestAnimationFrame(() => {
            el.scrollTop = scrollTop;
            didRestoreRef.current = true;
        });

        return () => window.cancelAnimationFrame(frame);
    }, [enabled, navigationType, restoreKey, storageKey]);

    return scrollRef;
}
