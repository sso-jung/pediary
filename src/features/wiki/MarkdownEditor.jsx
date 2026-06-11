// src/features/wiki/MarkdownEditor.jsx
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import 'tui-color-picker/dist/tui-color-picker.css';
import '@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css';
import colorSyntax from '@toast-ui/editor-plugin-color-syntax';
import { buildInternalLink } from '../../lib/internalLinkFormat';
import { normalizeFontSizeTokensToSpans } from './wikiFontRender';

function stripHeadingText(rawText = '') {
    let s = rawText;
    s = s.replace(/<[^>]*>/g, '');
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
    s = s.replace(/\\([\\`*_[\]{}()#+\-.!|~>])/g, '$1');
    s = s.replace(/[*_`]/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

// 🔹 한 문서의 마크다운에서 헤딩(섹션) 정보 뽑기
function extractSectionsFromMarkdown(markdown) {
    if (!markdown) return [];

    const lines = markdown.split('\n');
    const counters = [0, 0, 0, 0, 0, 0, 0]; // 1~6 레벨 카운터
    const sections = [];

    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.*)$/); // "# 제목" ~ "###### 제목"
        if (!match) continue;

        const hashes = match[1];
        const level = hashes.length;
        const rawText = match[2].trim();
        const plainText = stripHeadingText(rawText);

        // 1) 내용이 없는 헤딩은 무시
        if (!plainText) continue;

        counters[level] += 1;
        for (let i = level + 1; i < counters.length; i++) {
            counters[i] = 0;
        }
        const nums = counters.slice(1, level + 1).filter((n) => n > 0);
        const number = nums.join('.'); // "1", "1.1", "1.1.1" ...

        sections.push({
            level,
            number, // "1.1"
            text: plainText, // "고기"
        });
    }

    return sections;
}

function findLastTextColor(markdown = '') {
    const colorRe = /<span\b[^>]*style=["'][^"']*color\s*:\s*([^;"']+)/gi;
    let match;
    let color = '';

    while ((match = colorRe.exec(markdown)) !== null) {
        color = match[1].trim();
    }

    return color;
}

function escapeHtmlText(text = '') {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function fontSizeValueToPx(sizePt) {
    if (sizePt === 'sm') return 12;
    if (sizePt === 'md') return 14;
    if (sizePt === 'lg') return 18;
    return Number(sizePt) || 14;
}

function mergeTextAlignStyle(style = '', align) {
    const cleaned = style
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part && !/^text-align\s*:/i.test(part));

    cleaned.push(`text-align: ${align}`);
    return cleaned.join('; ');
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

                const mark = schema.marks.span.create({
                    htmlAttrs: {
                        class: 'wiki-font-custom',
                        style: `font-size:${sizePx}px`,
                    },
                });
                tr.addMark(from, to, mark);
                dispatch(tr);
                return true;
            },
        },
    };
}

function paragraphAlignSyntaxPlugin() {
    return {
        wysiwygCommands: {
            paragraphAlign({ align }, { tr, selection, doc }, dispatch) {
                if (!['left', 'center', 'right', 'justify'].includes(align)) return false;

                const targets = new Map();
                const addTarget = (pos, node) => {
                    if (!node || !['paragraph', 'heading'].includes(node.type.name)) return;
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

                targets.forEach((node, pos) => {
                    const htmlAttrs = {
                        ...(node.attrs.htmlAttrs || {}),
                        style: mergeTextAlignStyle(node.attrs.htmlAttrs?.style || '', align),
                    };
                    tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        htmlAttrs,
                    });
                });

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
                                           fullHeight = false, // 카드 전체 높이 쓸지 여부
                                           onManualSave = () => {},
                                           activeHeading,
                                           docKey,
                                       }) {
    const editorRef = useRef(null);

    // 🔹 내부 링크 자동완성 팝업 상태
    const [isLinkPaletteOpen, setIsLinkPaletteOpen] = useState(false);
    const [linkQuery, setLinkQuery] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);

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
    const recentTextColorRef = useRef('');

    // ✅ 문서가 바뀌면(=docKey 변경) 내부 상태를 리셋
    useEffect(() => {
          hasUserEditedRef.current = false;
          initialMarkdownRef.current = '';
          lastAppliedValueRef.current = null;
          linkInsertSelectionRef.current = null;
          linkBracketRef.current = { active: false, timer: null };
    }, [docKey]);

    // useEffect(() => {
    //     const instance = editorRef.current?.getInstance?.();
    //     if (!instance) return;
    //
    //     // 이미 한 번 초기화했으면 더 이상 건드리지 않음
    //     if (hasInitializedFromValueRef.current) return;
    //
    //     const initial = value || '';
    //     instance.setMarkdown(initial);
    //     hasInitializedFromValueRef.current = true;
    //     // 실제 에디터 내부 상태 기준으로 초기 마크다운 저장
    //     initialMarkdownRef.current = instance.getMarkdown() || initial;
    // }, [value]);

    // ✅ value -> editor 동기화 (사용자 편집 전까지만)
    useEffect(() => {
        const instance = editorRef.current?.getInstance?.();
        if (!instance) return;
        const next = normalizeFontSizeTokensToSpans(value ?? '');
        const current = instance.getMarkdown?.() ?? '';
        // 사용자가 이미 타이핑 시작했으면 외부 value로 덮지 않음
        if (hasUserEditedRef.current) {
            recentTextColorRef.current = findLastTextColor(current) || recentTextColorRef.current;
            return;
        }
        // 같은 값이면 스킵
        if (current === next) {
            recentTextColorRef.current = findLastTextColor(next) || recentTextColorRef.current;
            return;
        }
        if (lastAppliedValueRef.current === next) {
            recentTextColorRef.current = findLastTextColor(next) || recentTextColorRef.current;
            return;
        }
        instance.setMarkdown(next);
        lastAppliedValueRef.current = next;

        // 초기 undo 기준도 여기서 설정
        initialMarkdownRef.current = next;
        recentTextColorRef.current = findLastTextColor(next) || recentTextColorRef.current;
    }, [value]);

    // 🔹 에디터 명령 실행 헬퍼
    const execCommand = (cmd, payload) => {
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
        // PascalCase 대소문자 차이 처리용
        const alt =
            cmd && cmd.length > 0 ? cmd[0].toUpperCase() + cmd.slice(1) : cmd;
        if (alt !== cmd) {
            tryExec(alt);
        }
    };

    // 🔹 에디터 내용 변경 시
    const handleChange = () => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        hasUserEditedRef.current = true; // 사용자 수정 발생

        const markdown = normalizeFontSizeTokensToSpans(instance.getMarkdown() || '');
        recentTextColorRef.current = findLastTextColor(markdown) || recentTextColorRef.current;
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

        // 🔹 새 포맷으로 삽입할 문자열 결정
        //   - 문서 전체: [[doc:123|제목]]
        //   - 섹션:     [[doc:123#1.1|섹션제목]]
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
        const newMarkdown = instance.getMarkdown() || '';
        onChange(newMarkdown);

        setIsLinkPaletteOpen(false);
        setLinkQuery('');
        setHighlightIndex(0);
        linkInsertSelectionRef.current = null;

        requestAnimationFrame(() => {
            editorRef.current?.getInstance?.()?.focus?.();
        });
    }, [onChange]);

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
            // Alt 만 눌렸을 때만 처리 (Ctrl / Cmd / Shift 같이 눌리면 무시)
            if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;

            const key = ev.key;
            if (key < '1' || key > '6') return;

            const instance = editorRef.current?.getInstance();
            const root = editorRef.current?.getRootElement?.();
            if (!instance || !root) return;

            const active = document.activeElement;
            if (active && !root.contains(active)) {
                // 에디터에 포커스 없으면 무시
                return;
            }

            ev.preventDefault();
            ev.stopPropagation();

            const level = Number(key); // 1~6
            execCommand('heading', { level });
        };

        window.addEventListener('keydown', handleHeadingShortcut, true);
        return () => window.removeEventListener('keydown', handleHeadingShortcut, true);
    }, []);

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
            instance.exec('fontSize', { sizePx });

            requestAnimationFrame(() => {
                const nextMarkdown = normalizeFontSizeTokensToSpans(instance.getMarkdown?.() || '');
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

    const applyRecentTextColor = useCallback(() => {
        const instance = editorRef.current?.getInstance();
        const color = recentTextColorRef.current;
        if (!instance || !color) return;

        const selected = instance.getSelectedText?.() || '';
        if (!selected) return;

        instance.exec('color', { selectedColor: color });

        requestAnimationFrame(() => {
            const markdown = instance.getMarkdown?.() || '';
            recentTextColorRef.current = findLastTextColor(markdown) || color;
            onChange(markdown);
        });
    }, [onChange]);

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
            const isColorKey = isCtrlOrMeta && e.altKey && (e.key === 'c' || e.key === 'C');

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

    // =========================
    // 폰트 팝업 위치/열림 상태
    // =========================
    const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
    const [fontPickerPos, setFontPickerPos] = useState({ top: 0, left: 0 });
    const fontPickerRef = useRef(null);

    const fontSizes = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28];

    const applyParagraphAlign = useCallback((align) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        instance.exec('paragraphAlign', { align });

        requestAnimationFrame(() => {
            const markdown = normalizeFontSizeTokensToSpans(instance.getMarkdown?.() || '');
            onChange(markdown);
        });
    }, [onChange]);

    // const unwrapAlignBlock = (line = '') => {
    //     return line
    //         .replace(/^<div class="wiki-align-(left|center|right|justify)">$/i, '')
    //         .replace(/^<div class='wiki-align-(left|center|right|justify)'>$/i, '')
    //         .replace(/^<\/div>$/i, '');
    // };
    //
    // const applyParagraphAlign = useCallback((align) => {
    //     const instance = editorRef.current?.getInstance();
    //     if (!instance) return;
    //     if (!['left', 'center', 'right', 'justify'].includes(align)) return;
    //
    //     const selectedText = instance.getSelectedText?.() || '';
    //
    //     if (!selectedText.trim()) {
    //         instance.exec('paragraphAlign', { align });
    //
    //         requestAnimationFrame(() => {
    //             const nextMarkdown = normalizeFontSizeTokensToSpans(instance.getMarkdown?.() || '');
    //             onChange(nextMarkdown);
    //         });
    //         return;
    //     }
    //
    //     const cleanSelected = selectedText
    //         .split('\n')
    //         .map((line) => unwrapAlignBlock(line))
    //         .join('\n');
    //
    //     const alignedBlock = `<div class="wiki-align-${align}">\n${cleanSelected}\n</div>`;
    //
    //     instance.replaceSelection(alignedBlock);
    //
    //     requestAnimationFrame(() => {
    //         instance.exec('paragraphAlign', { align });
    //
    //         const nextMarkdown = normalizeFontSizeTokensToSpans(instance.getMarkdown?.() || '');
    //         console.log('정렬 저장 markdown:', nextMarkdown);
    //         onChange(nextMarkdown);
    //     });
    // }, [onChange]);

    const openFontPicker = useCallback(() => {
        const pickerWidth = 220; // 대략
        const pickerHeight = 200;
        const margin = 8;

        let top = (window.innerHeight - pickerHeight) / 2;
        let left = (window.innerWidth - pickerWidth) / 2;

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            if (rect && rect.width !== 0 && rect.height !== 0) {
                top = rect.bottom + 6;
                left = rect.left;
            }
        }

        // 화면 밖으로 나가지 않도록 클램프
        top = Math.min(
            Math.max(margin, top),
            window.innerHeight - pickerHeight - margin
        );
        left = Math.min(
            Math.max(margin, left),
            window.innerWidth - pickerWidth - margin
        );

        setFontPickerPos({ top, left });
        setIsFontPickerOpen(true);
    }, []);

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
        const handleOpenFontPicker = () => {
            openFontPicker();
        };
        const handleOpenInternalLink = () => {
            openInternalLinkPalette();
        };
        const handleParagraphAlign = (e) => {
            applyParagraphAlign(e.detail?.align);
        };

        window.addEventListener('pediary:open-font-picker', handleOpenFontPicker);
        window.addEventListener('pediary:open-internal-link', handleOpenInternalLink);
        window.addEventListener('pediary:paragraph-align', handleParagraphAlign);
        return () => {
            window.removeEventListener('pediary:open-font-picker', handleOpenFontPicker);
            window.removeEventListener('pediary:open-internal-link', handleOpenInternalLink);
            window.removeEventListener('pediary:paragraph-align', handleParagraphAlign);
        };
    }, [openFontPicker, openInternalLinkPalette, applyParagraphAlign]);

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

            const currentMd = instance.getMarkdown() || '';

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
                    name: 'fontSize',
                    tooltip: '글자 크기',
                    el: makeButton(fontSizeIcon, '글자 크기', 'pediary:open-font-picker'),
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
                initialValue={normalizeFontSizeTokensToSpans(value || '')}
                previewStyle="vertical"
                // 🔹 fullHeight일 땐 부모 div 높이 100% 채우고, 그 안에서 스크롤
                height={fullHeight ? '100%' : 'auto'}
                minHeight="200px"
                initialEditType="wysiwyg"
                hideModeSwitch={true}
                useCommandShortcut={true}
                plugins={[
                    fontSizeSyntaxPlugin,
                    paragraphAlignSyntaxPlugin,
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
                toolbarItems={toolbarItems}
                onChange={handleChange}
            />

            {/* 🔹 폰트 크기 팝업 (선택 근처 + 화면 밖으로 안 나가게 / ESC·바깥 클릭으로 닫기) */}
            {isFontPickerOpen && (
                <div
                    ref={fontPickerRef}
                    className="fixed z-30 w-44 rounded-xl border border-slate-200 bg-white shadow-lg text-[11px]"
                    style={{
                        top: fontPickerPos.top,
                        left: fontPickerPos.left,
                    }}
                >
                    <div className="border-b border-slate-100 px-3 py-2 text-slate-600">
                        <span className="font-semibold">글자 크기</span>
                        <span className="ml-1 text-[10px] text-slate-400">
              Ctrl+Shift+F 또는 키패드 +
            </span>
                    </div>
                    <div className="px-2 py-2 flex flex-wrap gap-1">
                        {fontSizes.map((size) => (
                            <button
                                key={size}
                                type="button"
                                className="flex-1 min-w-[40px] rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                    applyInlineFontSize(size);
                                    setIsFontPickerOpen(false);
                                }}
                            >
                                {size}pt
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="w-full border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 hover:bg-slate-50"
                        onClick={() => setIsFontPickerOpen(false)}
                    >
                        닫기 (Esc)
                    </button>
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
        </div>
    );
}
