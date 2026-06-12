import { useEffect, useState } from 'react';

function decodeHtmlEntities(value = '') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function prepareTooltipElement(target, root) {
    const el = target?.closest?.('[data-wiki-tooltip], a[title]');
    if (!el || !root?.contains(el)) return null;

    // 보기모드 Viewer는 보통 a[title] 형태로 렌더링됨.
    // 커스텀 툴팁과 브라우저 기본 title 툴팁이 같이 뜨는 걸 막기 위해 data로 옮김.
    const title = el.getAttribute('title');
    const dataTooltip = el.getAttribute('data-wiki-tooltip');

    if (title && !dataTooltip) {
        el.setAttribute('data-wiki-tooltip', title);
        el.setAttribute('data-wiki-native-title', title);
        el.removeAttribute('title');
    }

    return el;
}

function getTooltipText(el) {
    const rawText = el?.getAttribute?.('data-wiki-tooltip') || '';
    return decodeHtmlEntities(rawText).trim();
}

function restoreNativeTitles(root) {
    if (!root) return;

    root.querySelectorAll('[data-wiki-native-title]').forEach((el) => {
        const title = el.getAttribute('data-wiki-native-title') || '';
        if (title) {
            el.setAttribute('title', title);
        }
        el.removeAttribute('data-wiki-native-title');
    });
}

export function useWikiLinkTooltip(getRoot, enabled = true) {
    const [tooltip, setTooltip] = useState(null);

    useEffect(() => {
        if (!enabled) {
            setTooltip(null);
            return;
        }

        let disposed = false;
        let cleanup = null;
        let rafId = null;

        const bindWhenRootReady = () => {
            if (disposed) return;

            const root = getRoot?.();

            // 핵심 수정:
            // 새로고침 직후 Viewer ref가 아직 없으면 바로 포기하지 말고,
            // 다음 프레임에서 다시 시도한다.
            if (!root) {
                rafId = requestAnimationFrame(bindWhenRootReady);
                return;
            }

            const showTooltip = (e) => {
                const el = prepareTooltipElement(e.target, root);
                if (!el) return;

                const text = getTooltipText(el);
                if (!text) return;

                const rect = el.getBoundingClientRect();

                setTooltip({
                    text,
                    top: rect.top - 8,
                    left: rect.left + rect.width / 2,
                });
            };

            const moveTooltip = (e) => {
                const el = prepareTooltipElement(e.target, root);
                if (!el) return;

                const text = getTooltipText(el);
                if (!text) return;

                setTooltip({
                    text,
                    top: e.clientY - 12,
                    left: e.clientX,
                });
            };

            const hideTooltip = (e) => {
                const related = e.relatedTarget;
                if (related && prepareTooltipElement(related, root)) return;
                setTooltip(null);
            };

            root.addEventListener('mouseover', showTooltip, true);
            root.addEventListener('mousemove', moveTooltip, true);
            root.addEventListener('mouseout', hideTooltip, true);

            cleanup = () => {
                root.removeEventListener('mouseover', showTooltip, true);
                root.removeEventListener('mousemove', moveTooltip, true);
                root.removeEventListener('mouseout', hideTooltip, true);
                restoreNativeTitles(root);
            };
        };

        bindWhenRootReady();

        return () => {
            disposed = true;
            if (rafId) cancelAnimationFrame(rafId);
            cleanup?.();
            setTooltip(null);
        };
    }, [getRoot, enabled]);

    return tooltip;
}

export function WikiLinkTooltip({ tooltip }) {
    if (!tooltip) return null;

    return (
        <div
            className="wiki-link-tooltip"
            style={{
                top: tooltip.top,
                left: tooltip.left,
            }}
        >
            {tooltip.text}
        </div>
    );
}