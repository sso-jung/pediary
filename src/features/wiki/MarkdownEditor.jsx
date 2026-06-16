// src/features/wiki/MarkdownEditor.jsx
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import 'tui-color-picker/dist/tui-color-picker.css';
import '@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css';
import colorSyntax from '@toast-ui/editor-plugin-color-syntax';
import {
    buildInternalLink,
    parseInternalLinkInner,
    normalizeEscapedInternalLinks,
} from '../../lib/internalLinkFormat';
import {
    getDocumentById,
    getInternalLinkDisplayLabel,
    getInternalLinkTarget,
    getInternalLinkTooltip,
} from '../../lib/internalLinkMeta';
import {
    extractSectionsFromMarkdown,
    stripHeadingText,
} from '../../lib/wikiSectionUtils';

import { normalizeFontSizeTokensToSpans } from './wikiFontRender';
import {
    useWikiLinkTooltip,
    WikiLinkTooltip,
} from './WikiLinkTooltip';

function findLastTextColor(markdown = '') {
    const colorRe = /<span\b[^>]*style=["'][^"']*color\s*:\s*([^;"']+)/gi;
    let match;
    let color = '';

    while ((match = colorRe.exec(markdown)) !== null) {
        color = match[1].trim();
    }

    return color;
}

const RECENT_TEXT_COLOR_STORAGE_KEY = 'pediary:wiki:recentTextColor';

function getRecentTextColorFromSession() {
    try {
        return window.sessionStorage.getItem(RECENT_TEXT_COLOR_STORAGE_KEY) || '';
    } catch {
        return '';
    }
}

function setRecentTextColorToSession(color) {
    if (!color) return;

    try {
        window.sessionStorage.setItem(RECENT_TEXT_COLOR_STORAGE_KEY, color);
    } catch {
        // sessionStorage 접근 불가 환경에서는 무시
    }
}

function escapeHtmlText(text = '') {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function decodeHtmlText(value = '') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function stripHtmlTags(value = '') {
    return String(value).replace(/<[^>]*>/g, '');
}

function getFirstTextNode(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.length > 0) return node;

    for (const child of node.childNodes || []) {
        const found = getFirstTextNode(child);
        if (found) return found;
    }

    return null;
}

function getNextTextNode(root, node) {
    if (!root || !node) return null;

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (textNode) =>
                textNode.nodeValue?.length > 0
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT,
        }
    );

    let current = walker.nextNode();
    while (current) {
        if (current === node) {
            return walker.nextNode();
        }
        current = walker.nextNode();
    }

    return null;
}

function getTextNodeAtOrAfter(root, container, offset) {
    if (!root || !container) return null;

    if (container.nodeType === Node.TEXT_NODE) {
        if (offset < (container.nodeValue?.length || 0)) return container;
        return getNextTextNode(root, container);
    }

    if (container.nodeType !== Node.ELEMENT_NODE) return null;

    const child = container.childNodes?.[offset];
    const firstInChild = getFirstTextNode(child);
    if (firstInChild) return firstInChild;

    const previousChild = container.childNodes?.[offset - 1];
    const previousText = getFirstTextNode(previousChild);
    if (previousText) return getNextTextNode(root, previousText);

    const firstInContainer = getFirstTextNode(container);
    return firstInContainer && root.contains(firstInContainer) ? firstInContainer : null;
}

function getSelectionReadElement(root) {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const textNode = getTextNodeAtOrAfter(root, range.startContainer, range.startOffset);
    if (!textNode) return null;

    const node = textNode.nodeType === Node.TEXT_NODE ? textNode.parentElement : textNode;
    return node instanceof Element && root.contains(node) ? node : null;
}

function getAttrValue(attrs = '', name) {
    const re = new RegExp(`${name}=["']([^"']*)["']`, 'i');
    const match = attrs.match(re);
    return match ? decodeHtmlText(match[1]) : '';
}

function setCaretAfterElement(element) {
    if (!element) return false;

    const targetElement =
        element.closest?.('.tui-widget') ||
        element;

    const editorRoot =
        targetElement.closest('.ProseMirror') ||
        targetElement.closest('.toastui-editor-contents');

    if (editorRoot && editorRoot.focus) {
        editorRoot.focus({ preventScroll: true });
    }

    const range = document.createRange();
    const selection = window.getSelection?.();

    if (!selection) return false;

    range.setStartAfter(targetElement);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    return true;
}

function isSelectionCollapsedAfterInternalLinkToken(root) {
    const selection = window.getSelection?.();
    if (!root || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
        return false;
    }

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const offset = range.startOffset;

    // 케이스 1: 부모 element의 childNodes 사이에 커서가 있음
    if (container.nodeType === Node.ELEMENT_NODE) {
        const previous = container.childNodes?.[offset - 1];
        return previous instanceof Element &&
            previous.classList.contains('wiki-internal-link-token');
    }

    // 케이스 2: 텍스트 노드 맨 앞에 커서가 있고, 바로 앞 형제가 토큰
    if (container.nodeType === Node.TEXT_NODE && offset === 0) {
        const previous = container.previousSibling;
        return previous instanceof Element &&
            previous.classList.contains('wiki-internal-link-token');
    }

    return false;
}

function normalizeEditorSpacesForSave(markdown = '') {
    return String(markdown).replace(/\u00A0/g, ' ');
}

const INTERNAL_LINK_WIDGET_RULE = /\[\[doc:\d+(?:#[^\]|\s]+)?(?:\|[^\]\n]*)?\]\]/;

function unwrapToastWidgetMarkdown(markdown = '') {
    return String(markdown).replace(/\$\$widget\d+\s*([\s\S]*?)\$\$/g, '$1');
}

function normalizeMarkdownInternalLinks(markdown = '') {
    return normalizeEscapedInternalLinks(
        unwrapToastWidgetMarkdown(markdown)
    );
}

function getInternalLinkInnerFromRaw(raw = '') {
    const normalized = normalizeEscapedInternalLinks(raw);
    const match = String(normalized).match(/^\[\[([^[\]]+)\]\]$/);
    return match ? match[1] : '';
}

function getInternalLinkInfoFromRaw(raw = '', allDocs = [], categories = []) {
    const inner = getInternalLinkInnerFromRaw(raw);
    const parsed = parseInternalLinkInner(inner);
    if (!parsed) return null;

    const doc = getDocumentById(allDocs, parsed.docId);
    const target = getInternalLinkTarget(parsed);

    // 저장된 [[doc:7#2.2|수정한텍스트]] 라벨을 우선 사용
    const explicitLabel = getExplicitLabelFromInternalLinkInner(inner);
    const fallbackLabel = getInternalLinkDisplayLabel(parsed, doc);
    const displayLabel = explicitLabel || fallbackLabel;

    const tooltip = getInternalLinkTooltip({
        parsed,
        doc,
        categories,
    });

    return {
        parsed,
        doc,
        target,
        displayLabel,
        tooltip,
        raw: `[[${inner}]]`,
    };
}

function createInternalLinkTokenElement(raw = '', allDocs = [], categories = []) {
    const info = getInternalLinkInfoFromRaw(raw, allDocs, categories);
    const span = document.createElement('span');

    if (!info) {
        span.textContent = raw;
        return span;
    }

    const data = `${info.target}|${info.displayLabel}`;

    span.className = 'wiki-internal-link-token';
    span.setAttribute('spellcheck', 'false');
    span.setAttribute('draggable', 'false');
    span.setAttribute('data-wiki-link', data);
    span.setAttribute('data-wiki-tooltip', info.tooltip);
    span.setAttribute('data-wiki-raw', info.raw);
    span.textContent = info.displayLabel;

    return span;
}

function createToastWidgetText(raw = '') {
    return `$$widget0 ${raw}$$`;
}

function getScrollSnapshots(element) {
    const snapshots = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
        const canScroll =
            current.scrollHeight > current.clientHeight ||
            current.scrollWidth > current.clientWidth;

        if (canScroll) {
            snapshots.push({
                element: current,
                top: current.scrollTop,
                left: current.scrollLeft,
            });
        }

        current = current.parentElement;
    }

    snapshots.push({
        element: window,
        top: window.scrollY,
        left: window.scrollX,
    });

    return snapshots;
}

function restoreScrollSnapshots(snapshots = []) {
    snapshots.forEach((snapshot) => {
        if (snapshot.element === window) {
            window.scrollTo(snapshot.left, snapshot.top);
            return;
        }

        snapshot.element.scrollTop = snapshot.top;
        snapshot.element.scrollLeft = snapshot.left;
    });
}

function replaceInternalLinkWidgetNode(instance, widgetElement, nextRaw) {
    const view = instance?.wwEditor?.view;
    const schema = view?.state?.schema;
    const widgetType = schema?.nodes?.widget;

    if (!view || !schema || !widgetType || !widgetElement) return false;

    let pos;
    try {
        pos = view.posAtDOM(widgetElement, 0);
    } catch {
        return false;
    }

    let node = null;
    let nodePos = pos;

    for (const candidatePos of [pos, pos - 1, pos + 1]) {
        if (candidatePos < 0) continue;

        const candidateNode = view.state.doc.nodeAt(candidatePos);
        if (candidateNode?.type === widgetType) {
            node = candidateNode;
            nodePos = candidatePos;
            break;
        }
    }

    if (!node) return false;

    const nextNode = widgetType.create(
        { info: node.attrs?.info || 'widget0' },
        schema.text(createToastWidgetText(nextRaw))
    );

    view.dispatch(
        view.state.tr
            .replaceWith(nodePos, nodePos + node.nodeSize, nextNode)
    );

    return true;
}

function focusAfterInternalLinkToken(root, dataWikiLink, afterFocus) {
    if (!root || !dataWikiLink) return;

    requestAnimationFrame(() => {
        const selector = `.wiki-internal-link-token[data-wiki-link="${CSS.escape(dataWikiLink)}"]`;
        const tokens = root.querySelectorAll(selector);

        if (!tokens.length) {
            afterFocus?.(false);
            return;
        }

        // 같은 링크가 여러 개 있으면 우선 마지막 동일 토큰 뒤로 이동
        // 완전한 중복 위치 추적은 ProseMirror transaction/atom node 단계에서 처리하는 게 맞음
        const targetToken = tokens[tokens.length - 1];

        const focused = setCaretAfterElement(targetToken);
        afterFocus?.(focused);
    });
}

function getExplicitLabelFromInternalLinkInner(inner = '') {
    const pipeIndex = String(inner).indexOf('|');
    if (pipeIndex < 0) return '';

    return decodeHtmlText(String(inner).slice(pipeIndex + 1).trim());
}

// 편집용 span -> 저장용 내부링크 문법
function restoreInternalLinksFromEditor(markdown = '') {
    return String(markdown).replace(
        /<span\b([^>]*)>([\s\S]*?)<\/span>/gi,
        (full, attrs, inner) => {
            if (!/\bwiki-internal-link-token\b/.test(attrs)) {
                return full;
            }

            const data = getAttrValue(attrs, 'data-wiki-link');
            if (!data) return stripHtmlTags(inner);

            const pipeIndex = data.indexOf('|');
            const target = pipeIndex >= 0 ? data.slice(0, pipeIndex) : data;

            const editedLabel = decodeHtmlText(stripHtmlTags(inner)).trim();
            const fallbackLabel = pipeIndex >= 0 ? data.slice(pipeIndex + 1) : '';

            const label = fallbackLabel || editedLabel;

            return `[[${target}|${label}]]`;
        }
    );
}

function prepareMarkdownForEditor(markdown = '') {
    return normalizeEscapedInternalLinks(
        normalizeFontSizeTokensToSpans(markdown)
    );
}

function getMarkdownForSave(instance) {
    const markdown = normalizeFontSizeTokensToSpans(
        normalizeMarkdownInternalLinks(instance?.getMarkdown?.() || '')
    );

    return normalizeEditorSpacesForSave(
        normalizeEscapedInternalLinks(
            restoreInternalLinksFromEditor(markdown)
        )
    );
}

function fontSizeValueToPx(sizePt) {
    if (sizePt === 'sm') return 12;
    if (sizePt === 'md') return 14;
    if (sizePt === 'lg') return 18;
    return Number(sizePt) || 14;
}

function lineHeightValueToCode(value) {
    return Math.round(Number(value) * 100);
}

function lineHeightCodeToValue(code) {
    return Number(code) / 100;
}

function mergeClassName(existing = '', next = '') {
    const set = new Set(
        `${existing} ${next}`
            .split(/\s+/)
            .map((v) => v.trim())
            .filter(Boolean)
    );

    return Array.from(set).join(' ');
}

function mergeStyleProperty(style = '', prop, value) {
    const cleaned = style
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part && !new RegExp(`^${prop}\\s*:`, 'i').test(part));

    cleaned.push(`${prop}: ${value}`);
    return cleaned.join('; ');
}

function getSpanHtmlAttrs(node, spanMarkType) {
    const spanMark = node.marks?.find((mark) => mark.type === spanMarkType);
    return spanMark?.attrs?.htmlAttrs || {};
}

function applyMergedSpanMarkToTextRange({
                                            tr,
                                            doc,
                                            schema,
                                            from,
                                            to,
                                            mergeHtmlAttrs,
                                        }) {
    const spanMarkType = schema.marks.span;
    if (!spanMarkType) return false;

    let applied = false;

    doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isText) return;

        const start = Math.max(from, pos);
        const end = Math.min(to, pos + node.nodeSize);
        if (start >= end) return;

        const oldAttrs = getSpanHtmlAttrs(node, spanMarkType);

        const nextHtmlAttrs = mergeHtmlAttrs(oldAttrs);

        const nextMark = spanMarkType.create({
            htmlAttrs: nextHtmlAttrs,
        });

        tr.removeMark(start, end, spanMarkType);
        tr.addMark(start, end, nextMark);

        applied = true;
    });

    return applied;
}

function getInternalLinkMark(node, spanMarkType) {
    if (!node?.marks || !spanMarkType) return null;

    return node.marks.find((mark) => {
        if (mark.type !== spanMarkType) return false;

        const htmlAttrs = mark.attrs?.htmlAttrs || {};
        const className = htmlAttrs.class || '';

        return /\bwiki-internal-link-token\b/.test(className);
    }) || null;
}

function getInternalLinkMarkData(mark) {
    const htmlAttrs = mark?.attrs?.htmlAttrs || {};
    return htmlAttrs['data-wiki-link'] || '';
}

function collectInternalLinkTokenRanges(doc, schema) {
    const spanMarkType = schema.marks.span;
    if (!spanMarkType) return [];

    const ranges = [];

    doc.descendants((node, pos) => {
        if (!node.isText) return;

        const mark = getInternalLinkMark(node, spanMarkType);
        if (!mark) return;

        const data = getInternalLinkMarkData(mark);
        const from = pos;
        const to = pos + node.nodeSize;

        const last = ranges[ranges.length - 1];

        // 같은 토큰이 여러 text node로 쪼개져도 하나의 범위로 합침
        if (last && last.to === from && last.data === data) {
            last.to = to;
            return;
        }

        ranges.push({
            from,
            to,
            data,
        });
    });

    return ranges;
}

function findInternalLinkTokenRangeNearSelection(ranges, selection, direction) {
    if (!ranges.length || !selection) return null;

    const from = selection.from;
    const to = selection.to;
    const isEmpty = from === to;

    // 드래그 선택 영역이 토큰과 겹치면 그 토큰 삭제
    if (!isEmpty) {
        return ranges.find((range) => {
            return range.from < to && range.to > from;
        }) || null;
    }

    // Backspace: 커서 바로 앞 토큰 삭제
    if (direction === 'backward') {
        return ranges.find((range) => {
            return range.to === from || (range.from < from && from <= range.to);
        }) || null;
    }

    // Delete: 커서 바로 뒤 토큰 삭제
    return ranges.find((range) => {
        return range.from === from || (range.from <= from && from < range.to);
    }) || null;
}

function internalLinkTokenSyntaxPlugin() {
    return {
        wysiwygCommands: {
            deleteInternalLinkToken({ direction, onDeleted } = {}, { tr, selection, schema }, dispatch) {
                const ranges = collectInternalLinkTokenRanges(tr.doc, schema);
                const targetRange = findInternalLinkTokenRangeNearSelection(
                    ranges,
                    selection,
                    direction
                );

                if (!targetRange) return false;

                tr.delete(targetRange.from, targetRange.to);
                dispatch(tr);

                onDeleted?.();

                return true;
            },
        },
    };
}

function headingNumberDecorationPlugin(context) {
    const { Plugin, PluginKey } = context.pmState;
    const { Decoration, DecorationSet } = context.pmView;

    const buildDecorations = (doc) => {
        const counters = [0, 0, 0, 0, 0, 0, 0];
        const decorations = [];

        doc.descendants((node, pos) => {
            if (node.type?.name !== 'heading') return;

            const level = Number(node.attrs?.level) || 1;
            const plainText = stripHeadingText(node.textContent || '');

            if (!plainText) return;

            counters[level] += 1;
            for (let i = level + 1; i < counters.length; i += 1) {
                counters[i] = 0;
            }

            const nums = counters.slice(1, level + 1).filter((n) => n > 0);
            const number = nums.join('.');

            decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                    class: 'wiki-editor-heading-numbered',
                    'data-wiki-heading-number': `${number}.`,
                })
            );
        });

        return DecorationSet.create(doc, decorations);
    };

    return {
        wysiwygPlugins: [
            () => new Plugin({
                key: new PluginKey('pediaryHeadingNumbers'),
                state: {
                    init(_, state) {
                        return buildDecorations(state.doc);
                    },
                    apply(tr, oldDecorations) {
                        if (!tr.docChanged) {
                            return oldDecorations.map(tr.mapping, tr.doc);
                        }

                        return buildDecorations(tr.doc);
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },
            }),
        ],
    };
}

function fontSizeSyntaxPlugin(context) {
    return {
        markdownCommands: {
            fontSize({ sizePx }, { tr, selection, schema }, dispatch) {
                if (!sizePx) return false;

                const slice = selection.content();
                const textContent = slice.content.textBetween(0, slice.content.size, '\n');
                if (!textContent) return false;

                const html = `<span class="wiki-font-custom" style="font-size:${sizePx}px">${escapeHtmlText(textContent)}</span>`;
                tr.replaceSelectionWith(schema.text(html));
                dispatch(tr);
                return true;
            },
        },
        wysiwygCommands: {
            fontSize({ sizePx }, { tr, selection, schema }, dispatch) {
                if (!sizePx) return false;

                const { from, to } = selection;
                if (from === to) return false;

                const applied = applyMergedSpanMarkToTextRange({
                    tr,
                    doc: tr.doc,
                    schema,
                    from,
                    to,
                    mergeHtmlAttrs: (oldAttrs) => ({
                        ...oldAttrs,
                        class: mergeClassName(oldAttrs.class || '', 'wiki-font-custom'),
                        style: mergeStyleProperty(oldAttrs.style || '', 'font-size', `${sizePx}px`),
                    }),
                });

                if (!applied) return false;

                dispatch(tr);
                return true;
            },
        },
    };
}

function underlineSyntaxPlugin() {
    return {
        markdownCommands: {
            underline(_, { tr, selection, schema }, dispatch) {
                const slice = selection.content();
                const textContent = slice.content.textBetween(0, slice.content.size, '\n');
                if (!textContent) return false;

                const html = `<span class="wiki-underline">${escapeHtmlText(textContent)}</span>`;
                tr.replaceSelectionWith(schema.text(html));
                dispatch(tr);
                return true;
            },
        },
        wysiwygCommands: {
            underline(_, { tr, selection, schema }, dispatch) {
                const { from, to } = selection;
                if (from === to) return false;

                const applied = applyMergedSpanMarkToTextRange({
                    tr,
                    doc: tr.doc,
                    schema,
                    from,
                    to,
                    mergeHtmlAttrs: (oldAttrs) => ({
                        ...oldAttrs,
                        class: mergeClassName(oldAttrs.class || '', 'wiki-underline'),
                    }),
                });

                if (!applied) return false;

                dispatch(tr);
                return true;
            },
        },
    };
}

function paragraphAlignSyntaxPlugin() {
    return {
        wysiwygCommands: {
            paragraphAlign({ align }, { tr, selection, doc, schema }, dispatch) {
                if (!['left', 'center', 'right', 'justify'].includes(align)) {
                    return false;
                }

                const spanMark = schema.marks.span;
                if (!spanMark) return false;

                const targets = new Map();

                const addTarget = (pos, node) => {
                    if (!node) return;

                    // 기존 코드처럼 문단/헤딩 대상으로 처리
                    if (!['paragraph', 'heading'].includes(node.type.name)) return;

                    // 내용 없는 블록은 제외
                    if (!node.content?.size) return;

                    targets.set(pos, node);
                };

                // 드래그 선택된 범위에 포함된 paragraph/heading 수집
                doc.nodesBetween(selection.from, selection.to, (node, pos) => {
                    addTarget(pos, node);
                });

                // 커서만 있고 선택 영역이 없으면 현재 paragraph/heading 잡기
                if (targets.size === 0) {
                    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
                        const node = selection.$from.node(depth);

                        if (['paragraph', 'heading'].includes(node.type.name)) {
                            addTarget(selection.$from.before(depth), node);
                            break;
                        }
                    }
                }

                if (targets.size === 0) return false;

                targets.forEach((node, pos) => {
                    const from = pos + 1;
                    const to = pos + node.content.size;

                    applyMergedSpanMarkToTextRange({
                        tr,
                        doc,
                        schema,
                        from,
                        to,
                        mergeHtmlAttrs: (oldAttrs) => ({
                            ...oldAttrs,
                            class: mergeClassName(
                                (oldAttrs.class || '').replace(/\bwiki-align-(left|center|right|justify)\b/g, ''),
                                `wiki-align-${align}`
                            ),
                        }),
                    });
                });

                dispatch(tr);
                return true;
            },
        },
    };
}

function lineHeightSyntaxPlugin() {
    return {
        wysiwygCommands: {
            lineHeight({ lineHeight }, { tr, selection, doc, schema }, dispatch) {
                const value = Number(lineHeight);
                if (!value) return false;

                const code = lineHeightValueToCode(value);

                const targets = new Map();

                const addTarget = (pos, node) => {
                    if (!node) return;
                    if (!['paragraph', 'heading'].includes(node.type.name)) return;
                    if (!node.content?.size) return;

                    targets.set(pos, node);
                };

                doc.nodesBetween(selection.from, selection.to, (node, pos) => {
                    addTarget(pos, node);
                });

                if (targets.size === 0) {
                    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
                        const node = selection.$from.node(depth);

                        if (['paragraph', 'heading'].includes(node.type.name)) {
                            addTarget(selection.$from.before(depth), node);
                            break;
                        }
                    }
                }

                if (targets.size === 0) return false;

                let applied = false;

                targets.forEach((node, pos) => {
                    const from = pos + 1;
                    const to = pos + node.content.size;

                    const ok = applyMergedSpanMarkToTextRange({
                        tr,
                        doc,
                        schema,
                        from,
                        to,
                        mergeHtmlAttrs: (oldAttrs) => ({
                            ...oldAttrs,
                            class: mergeClassName(
                                (oldAttrs.class || '').replace(/\bwiki-line-height-\d+\b/g, ''),
                                `wiki-line-height-${code}`
                            ),
                        }),
                    });

                    if (ok) applied = true;
                });

                if (!applied) return false;

                dispatch(tr);
                return true;
            },
        },
    };
}

export default function MarkdownEditor({
                                           value,
                                           onChange,
                                           allDocs = [],
                                           categories = [],
                                           fullHeight = false,
                                           onManualSave = () => {},
                                           activeHeading,
                                       docKey,
                                   }) {
    const editorRef = useRef(null);
    const allDocsRef = useRef(allDocs);
    const categoriesRef = useRef(categories);

    useEffect(() => {
        allDocsRef.current = allDocs;
        categoriesRef.current = categories;
    }, [allDocs, categories]);

    // 🔹 내부 링크 자동완성 팝업 상태
    const [isLinkPaletteOpen, setIsLinkPaletteOpen] = useState(false);
    const [linkQuery, setLinkQuery] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [editingInternalLink, setEditingInternalLink] = useState(null);
    const [editingInternalLinkLabel, setEditingInternalLinkLabel] = useState('');

    // 🔹 팝업 리스트 컨테이너 ref (스크롤 따라가기용)
    const paletteListRef = useRef(null);
    const linkSearchInputRef = useRef(null);
    const linkPaletteRef = useRef(null);
    const linkInsertSelectionRef = useRef(null);
    const linkBracketRef = useRef({ active: false, timer: null });

    // 팝업 열림 상태 ref (keydown에서 최신값 쓰려고)
    const isLinkPaletteOpenRef = useRef(false);
    useEffect(() => {
        isLinkPaletteOpenRef.current = isLinkPaletteOpen;
    }, [isLinkPaletteOpen]);

    // const hasInitializedFromValueRef = useRef(false);
    const hasUserEditedRef = useRef(false); // 🔹 사용자 수정 여부 (Ctrl+Z 첫 단계 방지용)
    const initialMarkdownRef = useRef('');  // 🔹 최초 로딩된 마크다운 스냅샷
    const lastAppliedValueRef = useRef(null);
    const lastAppliedLinkContextRef = useRef(null);
    const recentTextColorRef = useRef(getRecentTextColorFromSession());

    const internalLinkContextKey = useMemo(() => JSON.stringify({
        docs: (allDocs || []).map((doc) => ({
            id: doc?.id,
            title: doc?.title,
            slug: doc?.slug,
            category_id: doc?.category_id,
            content_markdown: doc?.content_markdown,
        })),
        categories: (categories || []).map((category) => ({
            id: category?.id,
            name: category?.name,
            parent_id: category?.parent_id,
            deleted_at: category?.deleted_at,
        })),
    }), [allDocs, categories]);

    const updateRecentTextColor = useCallback((markdown = '', fallback = '') => {
        const color =
            findLastTextColor(markdown) ||
            fallback ||
            getRecentTextColorFromSession() ||
            recentTextColorRef.current;

        if (!color) return '';

        recentTextColorRef.current = color;
        setRecentTextColorToSession(color);

        return color;
    }, []);

    // ✅ 문서가 바뀌면(=docKey 변경) 내부 상태를 리셋
    useEffect(() => {
        hasUserEditedRef.current = false;
        initialMarkdownRef.current = '';
        lastAppliedValueRef.current = null;
        lastAppliedLinkContextRef.current = null;
        linkInsertSelectionRef.current = null;
        linkBracketRef.current = { active: false, timer: null };
        setEditingInternalLink(null);
        setEditingInternalLinkLabel('');
    }, [docKey]);

    // ✅ value -> editor 동기화 (사용자 편집 전까지만)
    useEffect(() => {
        const instance = editorRef.current?.getInstance?.();
        if (!instance) return;
        const next = prepareMarkdownForEditor(value ?? '', allDocs, categories);
        const current = getMarkdownForSave(instance);
        // 사용자가 이미 타이핑 시작했으면 외부 value로 덮지 않음
        if (hasUserEditedRef.current) {
            updateRecentTextColor(current);
            return;
        }
        // 같은 값이면 스킵
        if (current === next) {
            if (
                lastAppliedValueRef.current === next &&
                lastAppliedLinkContextRef.current === internalLinkContextKey
            ) {
                updateRecentTextColor(next);
                return;
            }
            instance.setMarkdown(next);
            lastAppliedValueRef.current = next;
            lastAppliedLinkContextRef.current = internalLinkContextKey;
            updateRecentTextColor(next);
            return;
        }
        if (
            lastAppliedValueRef.current === next &&
            lastAppliedLinkContextRef.current === internalLinkContextKey
        ) {
            updateRecentTextColor(next);
            return;
        }
        instance.setMarkdown(next);
        lastAppliedValueRef.current = next;
        lastAppliedLinkContextRef.current = internalLinkContextKey;

        // 초기 undo 기준도 여기서 설정
        initialMarkdownRef.current = next;
        updateRecentTextColor(next);
    }, [value, allDocs, categories, internalLinkContextKey, updateRecentTextColor]);

    useEffect(() => {
        const root = editorRef.current?.getRootElement?.();
        if (!root) return;

        const handleInternalLinkDeleteKey = (e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const instance = editorRef.current?.getInstance?.();
            const active = document.activeElement;

            if (!instance || !active || !root.contains(active)) return;

            let deleted = false;

            try {
                instance.exec('deleteInternalLinkToken', {
                    direction: e.key === 'Backspace' ? 'backward' : 'forward',
                    onDeleted: () => {
                        deleted = true;
                    },
                });
            } catch {
                deleted = false;
            }

            if (!deleted) return;

            e.preventDefault();
            e.stopPropagation();

            hasUserEditedRef.current = true;

            requestAnimationFrame(() => {
                const nextMarkdown = getMarkdownForSave(instance);
                onChange(nextMarkdown);
            });
        };

        root.addEventListener('keydown', handleInternalLinkDeleteKey, true);

        return () => {
            root.removeEventListener('keydown', handleInternalLinkDeleteKey, true);
        };
    }, [onChange]);

    useEffect(() => {
        const root = editorRef.current?.getRootElement?.();
        if (!root) return;

        const handleBeforeInput = (e) => {
            if (e.inputType !== 'insertText') return;
            if (e.data !== ' ') return;

            if (!isSelectionCollapsedAfterInternalLinkToken(root)) return;

            e.preventDefault();
            e.stopPropagation();

            const instance = editorRef.current?.getInstance?.();
            if (!instance) return;

            // 화면에서는 보존 가능한 공백으로 넣고,
            // 저장 시 normalizeEditorSpacesForSave에서 일반 공백으로 바꿈
            instance.replaceSelection('\u00A0');

            requestAnimationFrame(() => {
                const nextMarkdown = getMarkdownForSave(instance);
                onChange(nextMarkdown);
            });
        };

        root.addEventListener('beforeinput', handleBeforeInput, true);

        return () => {
            root.removeEventListener('beforeinput', handleBeforeInput, true);
        };
    }, [onChange]);

    useEffect(() => {
        const root = editorRef.current?.getRootElement?.();
        if (!root) return;

        const handleInternalLinkDoubleClick = (e) => {
            const token = e.target?.closest?.('.wiki-internal-link-token');
            if (!token || !root.contains(token)) return;

            const raw = token.getAttribute('data-wiki-raw') || '';
            const info = getInternalLinkInfoFromRaw(raw, allDocs, categories);
            if (!info) return;

            e.preventDefault();
            e.stopPropagation();

            const widgetElement = token.closest('.tui-widget');
            if (!widgetElement) return;

            setIsLinkPaletteOpen(false);
            setEditingInternalLink({
                raw,
                widgetElement,
                parsed: info.parsed,
            });
            setEditingInternalLinkLabel(info.displayLabel);
        };

        root.addEventListener('dblclick', handleInternalLinkDoubleClick, true);

        return () => {
            root.removeEventListener('dblclick', handleInternalLinkDoubleClick, true);
        };
    }, [allDocs, categories]);

    // 🔹 에디터 명령 실행 헬퍼
    const execCommand = useCallback((cmd, payload) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const tryExec = (name) => {
            if (!name) return false;
            try {
                instance.exec(name, payload);
                return true;
            } catch {
                return false;
            }
        };

        if (tryExec(cmd)) return;

        const alt =
            cmd && cmd.length > 0 ? cmd[0].toUpperCase() + cmd.slice(1) : cmd;

        if (alt !== cmd) {
            tryExec(alt);
        }
    }, []);

    const applyHeadingShortcut = useCallback((level) => {
        const instance = editorRef.current?.getInstance();
        const root = editorRef.current?.getRootElement?.();
        const active = document.activeElement;

        if (!instance || !root || !active || !root.contains(active)) return;

        execCommand('heading', { level });

        hasUserEditedRef.current = true;

        requestAnimationFrame(() => {
            const nextMarkdown = getMarkdownForSave(instance);
            onChange(nextMarkdown);
        });
    }, [execCommand, onChange]);

    const commitImeAndApplyHeading = useCallback((level) => {
        const instance = editorRef.current?.getInstance();
        const root = editorRef.current?.getRootElement?.();

        if (!instance || !root) return;

        const active = document.activeElement;
        if (!active || !root.contains(active)) return;

        // 현재 에디터 선택 위치를 저장
        const selection = instance.getSelection?.();

        // 핵심:
        // 한글 IME 조합 중인 마지막 글자를 강제로 확정시키기 위해
        // contenteditable 포커스를 잠깐 뺐다가 다시 준다.
        if (typeof active.blur === 'function') {
            active.blur();
        }

        requestAnimationFrame(() => {
            instance.focus?.();

            // blur/focus 후에도 원래 줄 기준으로 헤딩이 먹도록 선택 복구
            if (selection && instance.setSelection) {
                try {
                    instance.setSelection(selection[0], selection[1]);
                } catch {
                    // selection 형식이 맞지 않으면 무시
                }
            }

            requestAnimationFrame(() => {
                applyHeadingShortcut(level);
            });
        });
    }, [applyHeadingShortcut]);

    // 🔹 에디터 내용 변경 시
    const handleChange = () => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        hasUserEditedRef.current = true;

        const markdown = getMarkdownForSave(instance);

        updateRecentTextColor(markdown);
        onChange(markdown);
    };

    // 🔹 링크 후보: 문서 단위 + 섹션 단위 모두 포함
    const linkCandidates = useMemo(() => {
        if (!Array.isArray(allDocs)) return [];

        const result = [];

        for (const doc of allDocs) {
            if (!doc?.title || !doc?.slug) continue;

            // 1) 문서 자체 링크 후보 ([[요리]])
            result.push({
                type: 'doc',
                docId: doc.id,
                docTitle: doc.title,
                slug: doc.slug,
            });

            // 2) 섹션 링크 후보 ([[요리#1.1|고기]])
            const sections = extractSectionsFromMarkdown(doc.content_markdown || '');
            for (const s of sections) {
                result.push({
                    type: 'section',
                    docId: doc.id,
                    docTitle: doc.title,
                    slug: doc.slug,
                    sectionNumber: s.number, // "1.1"
                    headingText: s.text, // "고기"
                    level: s.level,
                });
            }
        }

        return result;
    }, [allDocs]);

    // 🔹 linkQuery 로 후보 필터링
    const filteredCandidates = useMemo(() => {
        const q = linkQuery.trim().toLowerCase();
        if (!q) return linkCandidates;

        return linkCandidates.filter((item) => {
            const title = item.docTitle?.toLowerCase() || '';

            if (item.type === 'doc') {
                // 문서 전체 후보: 제목에 검색어가 포함되면
                return title.includes(q);
            } else {
                // 섹션 후보: 섹션 제목 또는 문서 제목에 검색어가 포함되면
                const heading = item.headingText?.toLowerCase() || '';
                return heading.includes(q) || title.includes(q);
            }
        });
    }, [linkCandidates, linkQuery]);

    const internalLinkWidgetRules = useMemo(() => [
        {
            rule: INTERNAL_LINK_WIDGET_RULE,
            toDOM: (text) => createInternalLinkTokenElement(
                text,
                allDocsRef.current,
                categoriesRef.current
            ),
        },
    ], []);

    const closeInternalLinkPalette = useCallback(() => {
        setIsLinkPaletteOpen(false);
        setLinkQuery('');
        setHighlightIndex(0);
        linkInsertSelectionRef.current = null;

        requestAnimationFrame(() => {
            editorRef.current?.getInstance?.()?.focus?.();
        });
    }, []);

    const openInternalLinkPalette = useCallback(() => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        linkInsertSelectionRef.current = instance.getSelection?.() || null;
        setIsLinkPaletteOpen(true);
        setLinkQuery('');
        setHighlightIndex(0);

        requestAnimationFrame(() => {
            linkSearchInputRef.current?.focus();
        });
    }, []);

    const deletePreviousBracket = useCallback(() => {
        const instance = editorRef.current?.getInstance();
        const selection = instance?.getSelection?.();
        if (!instance || !selection) return false;

        if (
            Array.isArray(selection) &&
            typeof selection[0] === 'number' &&
            typeof selection[1] === 'number' &&
            selection[0] === selection[1] &&
            selection[0] > 0
        ) {
            instance.deleteSelection(selection[0] - 1, selection[0]);
            linkInsertSelectionRef.current = [selection[0] - 1, selection[0] - 1];
            return true;
        }

        if (
            Array.isArray(selection) &&
            Array.isArray(selection[0]) &&
            Array.isArray(selection[1])
        ) {
            const start = selection[0];
            const end = selection[1];
            if (
                start[0] === end[0] &&
                start[1] === end[1] &&
                start[1] > 0
            ) {
                const before = [start[0], start[1] - 1];
                instance.deleteSelection(before, start);
                linkInsertSelectionRef.current = [before, before];
                return true;
            }
        }

        return false;
    }, []);

    // 🔹 선택한 문서/섹션을 현재 커서 위치에 삽입
    const applyInternalLink = useCallback((item) => {
        if (!item) return;

        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        let insertion = '';

        if (item.type === 'doc') {
            insertion = buildInternalLink({
                docId: item.docId,
                section: null,
                label: item.docTitle,
            });
        } else if (item.type === 'section') {
            insertion = buildInternalLink({
                docId: item.docId,
                section: item.sectionNumber,
                label: item.headingText,
            });
        }

        const selection = linkInsertSelectionRef.current;
        if (selection && instance.setSelection) {
            instance.setSelection(selection[0], selection[1]);
        }

        instance.replaceSelection(insertion);

        const rawMarkdown = getMarkdownForSave(instance);
        const editorMarkdown = prepareMarkdownForEditor(rawMarkdown, allDocs, categories);
        const linkInfo = getInternalLinkInfoFromRaw(insertion, allDocs, categories);

        hasUserEditedRef.current = true;
        lastAppliedValueRef.current = editorMarkdown;
        lastAppliedLinkContextRef.current = internalLinkContextKey;

        instance.setMarkdown(editorMarkdown);
        onChange(rawMarkdown);

        setIsLinkPaletteOpen(false);
        setLinkQuery('');
        setHighlightIndex(0);
        linkInsertSelectionRef.current = null;

        requestAnimationFrame(() => {
            const root = editorRef.current?.getRootElement?.();
            if (linkInfo?.target) {
                focusAfterInternalLinkToken(root, `${linkInfo.target}|${linkInfo.displayLabel}`);
                return;
            }

            editorRef.current?.getInstance?.()?.focus?.();
        });
    }, [onChange, allDocs, categories, internalLinkContextKey]);

    const closeInternalLinkEditPopup = useCallback(() => {
        setEditingInternalLink(null);
        setEditingInternalLinkLabel('');

        requestAnimationFrame(() => {
            editorRef.current?.getInstance?.()?.focus?.();
        });
    }, []);

    const applyInternalLinkLabelEdit = useCallback(() => {
        if (!editingInternalLink) return;

        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const label = editingInternalLinkLabel.trim();
        if (!label) return;

        const nextRaw = buildInternalLink({
            docId: editingInternalLink.parsed.docId,
            section: editingInternalLink.parsed.section,
            label,
        });
        const scrollSnapshots = getScrollSnapshots(editingInternalLink.widgetElement);

        const replaced = replaceInternalLinkWidgetNode(
            instance,
            editingInternalLink.widgetElement,
            nextRaw
        );

        if (!replaced) return;

        const nextMarkdown = getMarkdownForSave(instance);

        hasUserEditedRef.current = true;
        lastAppliedValueRef.current = prepareMarkdownForEditor(nextMarkdown);
        lastAppliedLinkContextRef.current = internalLinkContextKey;

        onChange(nextMarkdown);

        setEditingInternalLink(null);
        setEditingInternalLinkLabel('');

        requestAnimationFrame(() => {
            const root = editorRef.current?.getRootElement?.();
            const info = getInternalLinkInfoFromRaw(nextRaw, allDocs, categories);

            if (info?.target) {
                focusAfterInternalLinkToken(
                    root,
                    `${info.target}|${info.displayLabel}`,
                    () => restoreScrollSnapshots(scrollSnapshots)
                );
                return;
            }

            restoreScrollSnapshots(scrollSnapshots);
        });
    }, [
        editingInternalLink,
        editingInternalLinkLabel,
        onChange,
        allDocs,
        categories,
        internalLinkContextKey,
    ]);

    // 🔹 keydown: 팝업 열려 있는 동안 ↑↓ / Enter / Esc 처리
    useEffect(() => {
        const handleKey = (e) => {
            if (!isLinkPaletteOpenRef.current) return;

            // 조합키는 무시
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeInternalLinkPalette();
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                setHighlightIndex((prev) => {
                    if (filteredCandidates.length === 0) return 0;
                    return (prev + 1) % filteredCandidates.length;
                });
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                setHighlightIndex((prev) => {
                    if (filteredCandidates.length === 0) return 0;
                    return (prev - 1 + filteredCandidates.length) % filteredCandidates.length;
                });
                return;
            }

            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                const item = filteredCandidates[highlightIndex];
                if (item) applyInternalLink(item);
                return;
            }

            // 나머지 키는 에디터에 맡기고, onChange에서 markdown 기준으로 다시 계산
        };

        window.addEventListener('keydown', handleKey, true);
        return () => window.removeEventListener('keydown', handleKey, true);
    }, [filteredCandidates, highlightIndex, applyInternalLink, closeInternalLinkPalette]);

    // 🔹 [[ 입력 시 내부 링크 팝업 열기
    useEffect(() => {
        const handleLinkTrigger = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (isLinkPaletteOpenRef.current) return;

            if (e.key !== '[') {
                if (e.key.length === 1 && linkBracketRef.current.active) {
                    const timer = linkBracketRef.current.timer;
                    if (timer) clearTimeout(timer);
                    linkBracketRef.current = { active: false, timer: null };
                }
                return;
            }

            const instance = editorRef.current?.getInstance();
            const root = editorRef.current?.getRootElement?.();
            const active = document.activeElement;
            if (!instance || !root || !active || !root.contains(active)) return;

            const bracketState = linkBracketRef.current;
            if (bracketState.active) {
                e.preventDefault();
                e.stopPropagation();

                if (bracketState.timer) {
                    clearTimeout(bracketState.timer);
                }
                linkBracketRef.current = { active: false, timer: null };

                deletePreviousBracket();
                openInternalLinkPalette();
                return;
            }

            if (bracketState.timer) {
                clearTimeout(bracketState.timer);
            }

            const timer = window.setTimeout(() => {
                linkBracketRef.current = { active: false, timer: null };
            }, 700);
            linkBracketRef.current = { active: true, timer };
        };

        window.addEventListener('keydown', handleLinkTrigger, true);
        return () => {
            window.removeEventListener('keydown', handleLinkTrigger, true);
            const timer = linkBracketRef.current?.timer;
            if (timer) clearTimeout(timer);
        };
    }, [deletePreviousBracket, openInternalLinkPalette]);

    // 🔹 내부 링크 팝업 바깥 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!isLinkPaletteOpenRef.current) return;
            const el = linkPaletteRef.current;
            if (!el) return;
            if (!el.contains(e.target)) {
                closeInternalLinkPalette();
            }
        };

        window.addEventListener('mousedown', handleClickOutside, true);
        return () => window.removeEventListener('mousedown', handleClickOutside, true);
    }, [closeInternalLinkPalette]);

    // 🔹 헤딩 단축키 (Alt+1~6 → H1~H6)
    useEffect(() => {
        const handleHeadingShortcut = (ev) => {
            // Alt 만 눌렸을 때만 처리
            if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;

            const key = ev.key;
            if (key < '1' || key > '6') return;

            const instance = editorRef.current?.getInstance();
            const root = editorRef.current?.getRootElement?.();

            if (!instance || !root) return;

            const active = document.activeElement;
            if (!active || !root.contains(active)) return;

            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation?.();

            const level = Number(key);

            commitImeAndApplyHeading(level);
        };

        window.addEventListener('keydown', handleHeadingShortcut, true);

        return () => {
            window.removeEventListener('keydown', handleHeadingShortcut, true);
        };
    }, [commitImeAndApplyHeading]);

    // 🔹 하이라이트가 바뀔 때 리스트 스크롤도 같이 이동
    useEffect(() => {
        const container = paletteListRef.current;
        if (!container) return;
        if (filteredCandidates.length === 0) return;

        const safeIndex = Math.min(highlightIndex, filteredCandidates.length - 1);
        const itemEl = container.children[safeIndex];
        if (itemEl && itemEl.scrollIntoView) {
            itemEl.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightIndex, filteredCandidates.length]);

    // 🔹 Ctrl+S / Cmd+S 단축키 → onManualSave 실행
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const isSaveKey = isMac
                ? e.metaKey && e.key === 's'
                : e.ctrlKey && e.key === 's';

            if (isSaveKey) {
                const instance = editorRef.current?.getInstance();
                const root = editorRef.current?.getRootElement?.();
                const active = document.activeElement;

                if (!instance || !root || !active || !root.contains(active)) return;

                e.preventDefault();
                onManualSave?.(); // 👉 이게 수동 저장 버튼 역할
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [onManualSave]);

    // 🔹 DocumentPage에서 넘어온 activeHeading 기준으로 에디터 안 헤딩으로 스크롤
    useEffect(() => {
        if (!activeHeading) return;

        // DOM 업데이트가 끝난 뒤에 찾도록 한 틱 미루기
        requestAnimationFrame(() => {
            const root = editorRef.current?.getRootElement?.();
            if (!root) return;

            // TUI 에디터 내부 렌더 영역
            const contents =
                root.querySelector('.toastui-editor-ww-container .toastui-editor-contents') ||
                root.querySelector('.toastui-editor-ww-container .ProseMirror') ||
                root.querySelector('.ProseMirror');
            if (!contents) return;

            const targetText = (activeHeading.text || '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!targetText) return;

            const headingEls = contents.querySelectorAll('h1,h2,h3,h4,h5,h6');
            if (!headingEls.length) return;

            const sameLevelEls = Array.from(headingEls).filter(
                (el) => Number(el.tagName.slice(1)) === activeHeading.level,
            );
            const sameLevelIndex = Math.max(
                0,
                Number(activeHeading.number?.split('.').at(-1) || 1) - 1,
            );

            const targetEl = sameLevelEls.find((el) => {
                const text = (el.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                return text === targetText;
            }) || sameLevelEls[sameLevelIndex];

            if (!targetEl) return;

            const scrollContainer =
                targetEl.closest('.toastui-editor-contents') ||
                targetEl.closest('.ProseMirror');
            if (!scrollContainer) return;

            const containerRect = scrollContainer.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const offset = targetRect.top - containerRect.top + scrollContainer.scrollTop - 8;

            scrollContainer.scrollTo({
                top: offset,
                behavior: 'smooth',
            });
        });
    }, [activeHeading]);

    // =========================
    // 폰트 사이즈 위젯 적용 로직
    // =========================
    const applyInlineFontSize = useCallback((sizePt) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const markdown = normalizeFontSizeTokensToSpans(instance.getMarkdown() || '');
        const sizePx = fontSizeValueToPx(sizePt);
        const cursor = instance.getCursor?.();
        const lines = markdown.split('\n');

        let selected = instance.getSelectedText?.() || '';
        if (selected) {
            const selection = instance.getSelection?.();

            instance.exec('fontSize', { sizePx });

            requestAnimationFrame(() => {
                // 선택 영역이 애매하게 남는 것 방지
                if (
                    Array.isArray(selection) &&
                    typeof selection[1] === 'number' &&
                    instance.setSelection
                ) {
                    instance.setSelection(selection[1], selection[1]);
                } else {
                    window.getSelection?.()?.removeAllRanges?.();
                }

                const nextMarkdown = getMarkdownForSave(instance);
                onChange(nextMarkdown);
            });

            return;
        }

        if (cursor) {
            let idx = 0;
            for (let i = 0; i < cursor.line; i += 1) {
                idx += lines[i].length + 1;
            }
            idx += cursor.ch;

            let start = idx;
            let end = idx;

            // 왼쪽으로 단어 경계 찾기 (공백/개행 전까지)
            while (start > 0) {
                const ch = markdown[start - 1];
                if (/\s/.test(ch)) break;
                start -= 1;
            }
            // 오른쪽으로 단어 경계 찾기
            while (end < markdown.length) {
                const ch = markdown[end];
                if (/\s/.test(ch)) break;
                end += 1;
            }

            if (end > start) {
                const word = markdown.slice(start, end);
                const span = `<span class="wiki-font-custom" style="font-size:${sizePx}px">${escapeHtmlText(word)}</span>`;
                const newMarkdown =
                    markdown.slice(0, start) + span + markdown.slice(end);
                instance.setMarkdown(newMarkdown);
                onChange(newMarkdown);
                return;
            }
        }

        // 선택된 텍스트도 없고, 단어도 못 찾은 경우 → 아무것도 하지 않음
    }, [onChange]);

    const applyLineHeight = useCallback((lineHeight) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        instance.exec('lineHeight', { lineHeight });

        requestAnimationFrame(() => {
            const nextMarkdown = getMarkdownForSave(instance);
            onChange(nextMarkdown);
        });
    }, [onChange]);

    const applyUnderline = useCallback(() => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        instance.exec('underline');

        requestAnimationFrame(() => {
            const nextMarkdown = getMarkdownForSave(instance);
            onChange(nextMarkdown);
        });
    }, [onChange]);

    const applyRecentTextColor = useCallback(() => {
        const instance = editorRef.current?.getInstance();

        const color =
            getRecentTextColorFromSession() ||
            recentTextColorRef.current;

        if (!instance || !color) return;

        const selected = instance.getSelectedText?.() || '';
        if (!selected) return;

        instance.exec('color', { selectedColor: color });

        requestAnimationFrame(() => {
            const markdown = instance.getMarkdown?.() || '';
            updateRecentTextColor(markdown, color);
            onChange(markdown);
        });
    }, [onChange, updateRecentTextColor]);

    // 🔹 부분 폰트 크기 변경 커맨드 등록
    useEffect(() => {
        const instance = editorRef.current?.getInstance();
        if (!instance || !instance.addCommand) return;

        // markdown / wysiwyg 둘 다에 커맨드 등록
        instance.addCommand('markdown', 'setSmallFont', () =>
            applyInlineFontSize('sm')
        );
        instance.addCommand('wysiwyg', 'setSmallFont', () =>
            applyInlineFontSize('sm')
        );

        instance.addCommand('markdown', 'setMediumFont', () =>
            applyInlineFontSize('md')
        );
        instance.addCommand('wysiwyg', 'setMediumFont', () =>
            applyInlineFontSize('md')
        );

        instance.addCommand('markdown', 'setLargeFont', () =>
            applyInlineFontSize('lg')
        );
        instance.addCommand('wysiwyg', 'setLargeFont', () =>
            applyInlineFontSize('lg')
        );
    }, [applyInlineFontSize]);

    // 🔹 Ctrl+Alt+C / Cmd+Alt+C → 최근 글자색을 선택 영역에 다시 적용
    useEffect(() => {
        const handleRecentColorShortcut = (e) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey;

            const isColorKey =
                isCtrlOrMeta &&
                !e.altKey &&
                !e.shiftKey &&
                e.code === 'Space';

            if (!isColorKey) return;

            const instance = editorRef.current?.getInstance();
            const root = editorRef.current?.getRootElement?.();
            if (!instance || !root) return;

            const active = document.activeElement;
            if (!active || !root.contains(active)) return;

            e.preventDefault();
            e.stopPropagation();

            applyRecentTextColor();
        };

        window.addEventListener('keydown', handleRecentColorShortcut, true);
        return () => window.removeEventListener('keydown', handleRecentColorShortcut, true);
    }, [applyRecentTextColor]);

    // 🔹 Ctrl+U / Cmd+U → 밑줄
    useEffect(() => {
        const handleUnderlineShortcut = (e) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey;
            const isUnderlineKey =
                isCtrlOrMeta && !e.altKey && !e.shiftKey && (e.key === 'u' || e.key === 'U');

            if (!isUnderlineKey) return;

            const instance = editorRef.current?.getInstance();
            const root = editorRef.current?.getRootElement?.();
            if (!instance || !root) return;

            const active = document.activeElement;
            if (!active || !root.contains(active)) return;

            e.preventDefault();
            e.stopPropagation();

            applyUnderline();
        };

        window.addEventListener('keydown', handleUnderlineShortcut, true);
        return () => window.removeEventListener('keydown', handleUnderlineShortcut, true);
    }, [applyUnderline]);

    // =========================
    // 폰트 팝업 위치/열림 상태
    // =========================
    const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
    const [fontPickerPos, setFontPickerPos] = useState({ top: 0, left: 0 });
    const [currentFontSize, setCurrentFontSize] = useState(14);

    const [isLineHeightPickerOpen, setIsLineHeightPickerOpen] = useState(false);
    const [lineHeightPickerPos, setLineHeightPickerPos] = useState({ top: 0, left: 0 });
    const [currentLineHeight, setCurrentLineHeight] = useState(1.6);

    const fontPickerRef = useRef(null);
    const fontSizeButtonRef = useRef(null);
    const fontSizeLabelRef = useRef(null);

    const lineHeightPickerRef = useRef(null);
    const lineHeightButtonRef = useRef(null);
    const lineHeightLabelRef = useRef(null);

    const fontSizes = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28];
    const lineHeights = [1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2];

    const getEditorRoot = useCallback(() => {
        return editorRef.current?.getRootElement?.() || null;
    }, []);

    const wikiLinkTooltip = useWikiLinkTooltip(getEditorRoot, true);

    const applyParagraphAlign = useCallback((align) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;
        if (!['left', 'center', 'right', 'justify'].includes(align)) return;

        instance.exec('paragraphAlign', { align });

        requestAnimationFrame(() => {
            const nextMarkdown = getMarkdownForSave(instance);
            onChange(nextMarkdown);
        });
    }, [onChange]);

    const updateCurrentFontSizeFromSelection = useCallback(() => {
        const instance = editorRef.current?.getInstance?.();
        const root = editorRef.current?.getRootElement?.();
        if (!instance || !root) return;

        const node = getSelectionReadElement(root);
        if (!node) return;

        const fontEl = node.closest('[style*="font-size"]');
        const fontSize = fontEl?.style?.fontSize || '';

        const px = parseFloat(fontSize);
        setCurrentFontSize(Number.isFinite(px) ? Math.round(px) : 14);
    }, []);

    const updateCurrentLineHeightFromSelection = useCallback(() => {
        const root = editorRef.current?.getRootElement?.();
        if (!root) return;

        const node = getSelectionReadElement(root);
        if (!node) return;

        const lineHeightEl = node.closest('[class*="wiki-line-height-"]');
        const className = lineHeightEl?.className || '';
        const match = String(className).match(/\bwiki-line-height-(\d+)\b/);

        if (!match) {
            setCurrentLineHeight(1.6);
            return;
        }

        setCurrentLineHeight(lineHeightCodeToValue(match[1]));
    }, []);

    const openFontPicker = useCallback((anchorRect) => {
        const pickerWidth = 68;
        const pickerHeight = 280;
        const margin = 8;

        const rect =
            anchorRect ||
            fontSizeButtonRef.current?.getBoundingClientRect?.();

        let top = (window.innerHeight - pickerHeight) / 2;
        let left = (window.innerWidth - pickerWidth) / 2;

        if (rect) {
            // 글자크기 버튼의 왼쪽 시작점과 dropdown 왼쪽 시작점 맞춤
            top = rect.bottom + 4;
            left = rect.left;
        }

        top = Math.min(
            Math.max(margin, top),
            window.innerHeight - pickerHeight - margin
        );

        left = Math.min(
            Math.max(margin, left),
            window.innerWidth - pickerWidth - margin
        );

        updateCurrentFontSizeFromSelection();
        setFontPickerPos({ top, left });
        setIsFontPickerOpen((prev) => !prev);
    }, [updateCurrentFontSizeFromSelection]);

    const openLineHeightPicker = useCallback((anchorRect) => {
        const pickerWidth = 68;
        const pickerHeight = 220;
        const margin = 8;

        const rect =
            anchorRect ||
            lineHeightButtonRef.current?.getBoundingClientRect?.();

        let top = (window.innerHeight - pickerHeight) / 2;
        let left = (window.innerWidth - pickerWidth) / 2;

        if (rect) {
            top = rect.bottom + 4;
            left = rect.left;
        }

        top = Math.min(
            Math.max(margin, top),
            window.innerHeight - pickerHeight - margin
        );

        left = Math.min(
            Math.max(margin, left),
            window.innerWidth - pickerWidth - margin
        );

        updateCurrentLineHeightFromSelection();
        setLineHeightPickerPos({ top, left });
        setIsLineHeightPickerOpen((prev) => !prev);
    }, [updateCurrentLineHeightFromSelection]);

    useEffect(() => {
        const root = editorRef.current?.getRootElement?.();
        if (!root) return;

        const update = () => {
            requestAnimationFrame(() => {
                updateCurrentFontSizeFromSelection();
                updateCurrentLineHeightFromSelection();
            });
        };

        document.addEventListener('selectionchange', update);
        root.addEventListener('keyup', update, true);
        root.addEventListener('mouseup', update, true);
        root.addEventListener('click', update, true);

        return () => {
            document.removeEventListener('selectionchange', update);
            root.removeEventListener('keyup', update, true);
            root.removeEventListener('mouseup', update, true);
            root.removeEventListener('click', update, true);
        };
    }, [updateCurrentFontSizeFromSelection, updateCurrentLineHeightFromSelection]);

    useEffect(() => {
        if (fontSizeLabelRef.current) {
            fontSizeLabelRef.current.textContent = `${currentFontSize}`;
        }
    }, [currentFontSize]);

    useEffect(() => {
        if (lineHeightLabelRef.current) {
            lineHeightLabelRef.current.textContent = `${currentLineHeight}`;
        }
    }, [currentLineHeight]);

    // 🔹 Ctrl+Shift+F 또는 Ctrl+Numpad+ → 폰트 크기 선택 팝업 열기
    useEffect(() => {
        const handleFontShortcut = (e) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const isCtrlOrMeta = isMac ? e.metaKey : e.ctrlKey;

            const isFontKey =
                (isCtrlOrMeta && e.shiftKey && (e.key === 'f' || e.key === 'F')) ||
                (isCtrlOrMeta && e.code === 'NumpadAdd');

            if (!isFontKey) return;

            const instance = editorRef.current?.getInstance();
            const root = editorRef.current?.getRootElement?.();
            if (!instance || !root) return;

            const active = document.activeElement;
            if (!active || !root.contains(active)) return;

            e.preventDefault();
            e.stopPropagation();

            openFontPicker();
        };

        window.addEventListener('keydown', handleFontShortcut, true);
        return () => window.removeEventListener('keydown', handleFontShortcut, true);
    }, [openFontPicker]);

    // 🔹 ESC 로 폰트 팝업 닫기
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isFontPickerOpen) {
                setIsFontPickerOpen(false);
            }
            if (e.key === 'Escape' && isLineHeightPickerOpen) {
                setIsLineHeightPickerOpen(false);
            }
        };
        window.addEventListener('keydown', handleEsc, true);
        return () => window.removeEventListener('keydown', handleEsc, true);
    }, [isFontPickerOpen]);

    // 🔹 폰트 팝업 바깥 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!isFontPickerOpen) return;
            const el = fontPickerRef.current;
            if (!el) return;
            if (!el.contains(e.target)) {
                setIsFontPickerOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside, true);
        return () => window.removeEventListener('mousedown', handleClickOutside, true);
    }, [isFontPickerOpen]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!isLineHeightPickerOpen) return;

            const el = lineHeightPickerRef.current;
            if (!el) return;

            if (!el.contains(e.target)) {
                setIsLineHeightPickerOpen(false);
            }
        };

        window.addEventListener('mousedown', handleClickOutside, true);
        return () => window.removeEventListener('mousedown', handleClickOutside, true);
    }, [isLineHeightPickerOpen]);

    useEffect(() => {
        const handleOpenFontPicker = (e) => {
            openFontPicker(e.detail?.rect);
        };

        const handleOpenLineHeightPicker = (e) => {
            openLineHeightPicker(e.detail?.rect);
        };

        const handleOpenInternalLink = () => {
            openInternalLinkPalette();
        };

        const handleParagraphAlign = (e) => {
            applyParagraphAlign(e.detail?.align);
        };

        const handleUnderline = () => {
            applyUnderline();
        };

        window.addEventListener('pediary:open-font-picker', handleOpenFontPicker);
        window.addEventListener('pediary:open-line-height-picker', handleOpenLineHeightPicker);
        window.addEventListener('pediary:open-internal-link', handleOpenInternalLink);
        window.addEventListener('pediary:paragraph-align', handleParagraphAlign);
        window.addEventListener('pediary:underline', handleUnderline);
        return () => {
            window.removeEventListener('pediary:open-font-picker', handleOpenFontPicker);
            window.removeEventListener('pediary:open-line-height-picker', handleOpenLineHeightPicker);
            window.removeEventListener('pediary:open-internal-link', handleOpenInternalLink);
            window.removeEventListener('pediary:paragraph-align', handleParagraphAlign);
            window.removeEventListener('pediary:underline', handleUnderline);
        };
    }, [openFontPicker, openLineHeightPicker, openInternalLinkPalette, applyParagraphAlign, applyUnderline]);

    // 🔹 아무것도 수정 안 한 상태에서 Ctrl+Z 누르면 전체 삭제되는 것 + 초기 내용보다 더 뒤로 가는 것 방지
    useEffect(() => {
        const handleUndo = (e) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const isUndo = isMac ? e.metaKey && e.key === 'z' : e.ctrlKey && e.key === 'z';
            if (!isUndo) return;

            const instance = editorRef.current?.getInstance();
            const root = editorRef.current?.getRootElement?.();
            const active = document.activeElement;

            if (!instance || !root || !active || !root.contains(active)) return;

            const currentMd = getMarkdownForSave(instance);

            // 아직 사용자가 수정한 적이 없으면 undo 막기
            if (!hasUserEditedRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // 이미 초기 내용 상태라면 더 이상 undo 안 되게 막기
            if (
                initialMarkdownRef.current &&
                currentMd === initialMarkdownRef.current
            ) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('keydown', handleUndo, true);
        return () => window.removeEventListener('keydown', handleUndo, true);
    }, []);

    const toolbarItems = useMemo(() => {
        const fontSizeIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5.75 19.25L11.75 4.75L17.75 19.25" style="stroke-width: 1.5" />
                <path d="M7.75 13.75H15.75" style="stroke-width: 1.5" />
                <path d="M20.5 4.75V9.75" style="stroke-width: 1.6" />
                <path d="M18 7.25H23" style="stroke-width: 1.6" />
            </svg>
        `;
        const internalLinkIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.75 4.75H6.25C5.45 4.75 4.75 5.45 4.75 6.25V17.75C4.75 18.55 5.45 19.25 6.25 19.25H8.75" style="stroke-width: 1.6" />
                <path d="M15.25 4.75H17.75C18.55 4.75 19.25 5.45 19.25 6.25V17.75C19.25 18.55 18.55 19.25 17.75 19.25H15.25" style="stroke-width: 1.6" />
                <path d="M10 12H14" style="stroke-width: 1.6" />
            </svg>
        `;
        const underlineIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7.25 5.25V11.5C7.25 14.25 9.1 16 12 16C14.9 16 16.75 14.25 16.75 11.5V5.25" />
                <path d="M6.25 20H17.75" />
            </svg>
        `;
        const alignLeftIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7H19" />
                <path d="M5 11H15" />
                <path d="M5 15H19" />
                <path d="M5 19H13" />
            </svg>
        `;
        const alignCenterIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7H19" />
                <path d="M8 11H16" />
                <path d="M5 15H19" />
                <path d="M9 19H15" />
            </svg>
        `;
        const alignRightIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7H19" />
                <path d="M9 11H19" />
                <path d="M5 15H19" />
                <path d="M11 19H19" />
            </svg>
        `;
        const alignJustifyIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7H19" />
                <path d="M5 11H19" />
                <path d="M5 15H19" />
                <path d="M5 19H19" />
            </svg>
        `;

        const makeButton = (icon, tooltip, eventName) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = tooltip;
            button.className = 'pediary-toastui-toolbar-button';
            button.innerHTML = icon;
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
            button.addEventListener('click', (e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent(eventName));
            });
            return button;
        };

        const makeFontSizeButton = () => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = '글자 크기';
            button.className = 'pediary-toastui-font-size-button';

            const label = document.createElement('span');
            label.className = 'pediary-toastui-font-size-label';
            label.textContent = `${currentFontSize}`;

            const unit = document.createElement('span');
            unit.className = 'pediary-toastui-font-size-unit';
            unit.textContent = 'px';

            const caret = document.createElement('span');
            caret.className = 'pediary-toastui-font-size-caret';
            caret.textContent = '▾';

            button.appendChild(label);
            button.appendChild(unit);
            button.appendChild(caret);

            fontSizeButtonRef.current = button;
            fontSizeLabelRef.current = label;

            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            button.addEventListener('click', (e) => {
                e.preventDefault();

                const rect = button.getBoundingClientRect();

                window.dispatchEvent(new CustomEvent('pediary:open-font-picker', {
                    detail: {
                        rect: {
                            top: rect.top,
                            right: rect.right,
                            bottom: rect.bottom,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                        },
                    },
                }));
            });

            return button;
        };

        const makeLineHeightButton = () => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = '행간';
            button.className = 'pediary-toastui-line-height-button';

            const label = document.createElement('span');
            label.className = 'pediary-toastui-line-height-label';
            label.textContent = `${currentLineHeight}`;

            const caret = document.createElement('span');
            caret.className = 'pediary-toastui-line-height-caret';
            caret.textContent = '▾';

            button.appendChild(label);
            button.appendChild(caret);

            lineHeightButtonRef.current = button;
            lineHeightLabelRef.current = label;

            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            button.addEventListener('click', (e) => {
                e.preventDefault();

                const rect = button.getBoundingClientRect();

                window.dispatchEvent(new CustomEvent('pediary:open-line-height-picker', {
                    detail: {
                        rect: {
                            top: rect.top,
                            right: rect.right,
                            bottom: rect.bottom,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                        },
                    },
                }));
            });

            return button;
        };

        const makeAlignButton = (icon, tooltip, align) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = tooltip;
            button.className = 'pediary-toastui-toolbar-button';
            button.innerHTML = icon;
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
            button.addEventListener('click', (e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('pediary:paragraph-align', {
                    detail: { align },
                }));
            });
            return button;
        };

        return [
            [
                'heading',
                'bold',
                'italic',
                'strike',
                {
                    name: 'underline',
                    tooltip: '밑줄',
                    el: makeButton(underlineIcon, '밑줄', 'pediary:underline'),
                },
                {
                    name: 'fontSize',
                    tooltip: '글자 크기',
                    el: makeFontSizeButton(),
                },
                {
                    name: 'internalLink',
                    tooltip: '내부 링크',
                    el: makeButton(internalLinkIcon, '내부 링크', 'pediary:open-internal-link'),
                },
            ],
            [
                {
                    name: 'alignLeft',
                    tooltip: '왼쪽 정렬',
                    el: makeAlignButton(alignLeftIcon, '왼쪽 정렬', 'left'),
                },
                {
                    name: 'alignCenter',
                    tooltip: '가운데 정렬',
                    el: makeAlignButton(alignCenterIcon, '가운데 정렬', 'center'),
                },
                {
                    name: 'alignRight',
                    tooltip: '오른쪽 정렬',
                    el: makeAlignButton(alignRightIcon, '오른쪽 정렬', 'right'),
                },
                {
                    name: 'alignJustify',
                    tooltip: '양쪽 정렬',
                    el: makeAlignButton(alignJustifyIcon, '양쪽 정렬', 'justify'),
                },
                {
                    name: 'lineHeight',
                    tooltip: '행간',
                    el: makeLineHeightButton(),
                },
            ],
            ['ul', 'ol', 'task'],
            // ['table'],
            ['link','hr', 'quote'],
            // ['hr', 'quote', 'code', 'codeblock'],
        ];
    }, []);

    return (
        <div className={fullHeight ? 'h-full' : ''}>
            <Editor
                ref={editorRef}
                initialValue={prepareMarkdownForEditor(value || '', allDocs, categories)}
                previewStyle="vertical"
                // 🔹 fullHeight일 땐 부모 div 높이 100% 채우고, 그 안에서 스크롤
                height={fullHeight ? '100%' : 'auto'}
                minHeight="200px"
                initialEditType="wysiwyg"
                hideModeSwitch={true}
                useCommandShortcut={true}
                plugins={[
                    internalLinkTokenSyntaxPlugin,
                    headingNumberDecorationPlugin,
                    fontSizeSyntaxPlugin,
                    underlineSyntaxPlugin,
                    paragraphAlignSyntaxPlugin,
                    lineHeightSyntaxPlugin,
                    [
                        colorSyntax,
                        {
                            preset: [
                                '#333333',
                                '#666666',
                                '#FFFFFF',
                                '#f33c3c',
                                '#F97316',
                                '#EAB308',
                                '#22C55E',
                                '#0EA5E9',
                                '#6366F1',
                                '#7e59de',
                                '#89caff',
                                '#dfc9ea',
                                '#ffbfdd',
                                '#e0e0e0',
                                '#a5c7ae',
                                '#ffd2bf',
                            ],
                        },
                    ],
                ]}
                widgetRules={internalLinkWidgetRules}
                toolbarItems={toolbarItems}
                onChange={handleChange}
            />

            {/* 🔹 폰트 크기 팝업 (선택 근처 + 화면 밖으로 안 나가게 / ESC·바깥 클릭으로 닫기) */}
            {isFontPickerOpen && (
                <div
                    ref={fontPickerRef}
                    className="fixed z-50 w-[68px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-[12px] shadow-lg"
                    style={{
                        top: fontPickerPos.top,
                        left: fontPickerPos.left,
                    }}
                >
                    {fontSizes.map((size) => (
                        <button
                            key={size}
                            type="button"
                            className={
                                'flex w-full items-center justify-between px-2 py-1.5 text-left ui-side-subitem ' +
                                (currentFontSize === size
                                    ? 'ui-side-subitem-active font-semibold'
                                    : '')
                            }
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                applyInlineFontSize(size);
                                setCurrentFontSize(size);
                                setIsFontPickerOpen(false);
                            }}
                        >
                            <span>{size}</span>
                            <span className="text-[10px] text-slate-400">px</span>
                        </button>
                    ))}
                </div>
            )}

            {/* 행간 */}
            {isLineHeightPickerOpen && (
                <div
                    ref={lineHeightPickerRef}
                    className="fixed z-50 w-[68px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-[12px] shadow-lg"
                    style={{
                        top: lineHeightPickerPos.top,
                        left: lineHeightPickerPos.left,
                    }}
                >
                    {lineHeights.map((lineHeight) => (
                        <button
                            key={lineHeight}
                            type="button"
                            className={
                                'flex w-full items-center justify-between px-2 py-1.5 text-left ui-side-subitem ' +
                                (currentLineHeight === lineHeight
                                    ? 'ui-side-subitem-active font-semibold'
                                    : '')
                            }
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                applyLineHeight(lineHeight);
                                setCurrentLineHeight(lineHeight);
                                setIsLineHeightPickerOpen(false);
                            }}
                        >
                            <span>{lineHeight}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* 🔹 내부 링크 자동완성 팝업 */}
            {isLinkPaletteOpen && (
                <div
                    ref={linkPaletteRef}
                    className="fixed left-1/2 top-1/2 z-40 w-[22rem] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                    <div className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">내부 링크 추가</span>
                            <span className="rounded-full bg-slate-100 px-2 py-[2px] text-[10px] text-slate-500">
                                [[
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                            문서명이나 섹션명으로 검색해. ↑↓ / Enter / Esc
                        </p>
                    </div>
                    <div className="px-3 py-2">
                        <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                            <span className="text-[10px] text-slate-400">검색</span>
                            <input
                                ref={linkSearchInputRef}
                                type="text"
                                value={linkQuery}
                                onChange={(e) => {
                                    setLinkQuery(e.target.value);
                                    setHighlightIndex(0);
                                }}
                                className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400"
                                placeholder="문서나 섹션을 입력해"
                            />
                        </div>
                        {filteredCandidates.length === 0 ? (
                            <div className="rounded-lg bg-slate-50 px-2 py-2 text-[11px] text-slate-400">
                                일치하는 문서가 없어.
                            </div>
                        ) : (
                            <ul
                                ref={paletteListRef}
                                className="max-h-80 overflow-y-auto py-0.5 text-[12px]"
                            >
                                {filteredCandidates.map((item, idx) => (
                                    <li
                                        key={
                                            item.type === 'doc'
                                                ? `doc-${item.docId}`
                                                : `sec-${item.docId}-${item.sectionNumber}-${item.headingText}`
                                        }
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            applyInternalLink(item);
                                        }}
                                        className={
                                            'cursor-pointer rounded-md px-2 py-0.5 ' +
                                            (idx === highlightIndex
                                                ? 'bg-slate-100 text-slate-900'
                                                : 'text-slate-700 hover:bg-slate-50')
                                        }
                                    >
                                        {item.type === 'doc' ? (
                                            <>
                                                <div className="truncate font-medium">
                                                    {item.docTitle}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="truncate font-medium">
                                                    {item.docTitle}
                                                    <span className="mx-1 text-slate-300">&gt;</span>
                                                    <span className="text-slate-500">
                                                        {item.sectionNumber}
                                                    </span>
                                                    <span className="ml-1">
                                                        {item.headingText}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
            {editingInternalLink && (
                <div
                    className="fixed left-1/2 top-1/2 z-40 w-[20rem] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-lg"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <div className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">내부 링크 수정</span>
                            <span className="rounded-full bg-slate-100 px-2 py-[2px] text-[10px] text-slate-500">
                                label
                            </span>
                        </div>
                    </div>
                    <div className="px-3 py-2">
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                            <span className="text-[10px] text-slate-400">표시</span>
                            <input
                                type="text"
                                value={editingInternalLinkLabel}
                                onChange={(e) => setEditingInternalLinkLabel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        applyInternalLinkLabelEdit();
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        closeInternalLinkEditPopup();
                                    }
                                }}
                                className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                className="ui-control h-7 rounded-md px-2.5 text-[11px]"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={closeInternalLinkEditPopup}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="ui-btn-success h-7 rounded-md px-2.5 text-[11px]"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={applyInternalLinkLabelEdit}
                                disabled={!editingInternalLinkLabel.trim()}
                            >
                                적용
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <WikiLinkTooltip tooltip={wikiLinkTooltip}/>
        </div>
    );
}
