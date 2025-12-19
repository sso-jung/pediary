// src/features/wiki/MarkdownEditor.jsx
import { useEffect, useRef, useState, useMemo } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import 'tui-color-picker/dist/tui-color-picker.css';
import '@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css';
import colorSyntax from '@toast-ui/editor-plugin-color-syntax';
import { buildInternalLink } from '../../lib/internalLinkFormat';
import { fontWidgetRules } from './wikiFontWidgetRules';

function stripHeadingText(rawText = '') {
    let s = rawText;
    s = s.replace(/<[^>]*>/g, '');
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
    s = s.replace(/[*_`~]/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

// 🔹 한 문서의 마크다운에서 헤딩(섹션) 정보 뽑기
function extractSectionsFromMarkdown(markdown) {
    if (!markdown) return [];

    const lines = markdown.split('\n');
    const counters = [0, 0, 0, 0, 0, 0, 0]; // 1~6 레벨 카운터
    const sections = [];

    let lastHeadingKey = null;

    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.*)$/); // "# 제목" ~ "###### 제목"
        if (!match) continue;

        const hashes = match[1];
        const level = hashes.length;
        const rawText = match[2].trim();
        const plainText = stripHeadingText(rawText);

        // 1) 내용이 없는 헤딩은 무시
        if (!plainText) continue;

        // 2) 바로 앞 헤딩과 레벨+텍스트가 같으면 중복으로 간주
        const headingKey = `${level}|${plainText}`;
        if (headingKey === lastHeadingKey) {
            continue;
        }
        lastHeadingKey = headingKey;

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

// 🔹 "열려 있는 [[... 링크 조각" 찾기
function findOpenInternalLink(markdown) {
    if (!markdown) return { open: false };

    // 문서 전체에서 마지막 [[ 위치
    const idx = markdown.lastIndexOf('[[');
    if (idx === -1) return { open: false };

    const after = markdown.slice(idx + 2);

    // 🔹 idx 이후에 ]]가 하나라도 나오면 → 이미 닫힌 링크로 보고 자동완성 안 띄움
    if (after.includes(']]')) {
        return { open: false };
    }

    // 🔹 아직 ]]가 없다면 "열려 있는 [[조각" 이라고 보고,
    //    공백/줄바꿈 전까지를 검색어로 사용
    let endIdx = after.length;
    const newlineIdx = after.search(/[\r\n]/);
    const spaceIdx = after.search(/\s/);

    if (newlineIdx !== -1 && newlineIdx < endIdx) endIdx = newlineIdx;
    if (spaceIdx !== -1 && spaceIdx < endIdx) endIdx = spaceIdx;

    const segment = after.slice(0, endIdx);
    const tail = after.slice(endIdx);

    return {
        open: true,
        index: idx, // [[ 위치
        query: segment, // 검색어
        segmentLength: segment.length,
        tail, // 그 이후 나머지
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

    // 팝업 열림 상태 ref (keydown에서 최신값 쓰려고)
    const isLinkPaletteOpenRef = useRef(false);
    useEffect(() => {
        isLinkPaletteOpenRef.current = isLinkPaletteOpen;
    }, [isLinkPaletteOpen]);

    // const hasInitializedFromValueRef = useRef(false);
    const hasUserEditedRef = useRef(false); // 🔹 사용자 수정 여부 (Ctrl+Z 첫 단계 방지용)
    const initialMarkdownRef = useRef('');  // 🔹 최초 로딩된 마크다운 스냅샷
    const lastAppliedValueRef = useRef(null);

    // ✅ 문서가 바뀌면(=docKey 변경) 내부 상태를 리셋
    useEffect(() => {
          hasUserEditedRef.current = false;
          initialMarkdownRef.current = '';
          lastAppliedValueRef.current = null;
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
        const next = value ?? '';
        const current = instance.getMarkdown?.() ?? '';
        // 사용자가 이미 타이핑 시작했으면 외부 value로 덮지 않음
        if (hasUserEditedRef.current) return;
        // 같은 값이면 스킵
        if (current === next) return;
        if (lastAppliedValueRef.current === next) return;
        instance.setMarkdown(next);
        lastAppliedValueRef.current = next;

        // 초기 undo 기준도 여기서 설정
        initialMarkdownRef.current = next;
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

        const markdown = instance.getMarkdown() || '';
        onChange(markdown);

        const info = findOpenInternalLink(markdown);

        if (!info.open) {
            // 열려 있는 [[ 조각이 없으면 팝업 닫기
            if (isLinkPaletteOpenRef.current) {
                setIsLinkPaletteOpen(false);
                setLinkQuery('');
                setHighlightIndex(0);
            }
            return;
        }

        // 열려 있는 [[조각이 있으면 → 팝업 열고 검색어 업데이트
        if (!isLinkPaletteOpenRef.current) {
            setIsLinkPaletteOpen(true);
            setHighlightIndex(0);
        }
        setLinkQuery(info.query || '');
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
                // 문서 전체 후보: 제목이 검색어로 "시작"하면
                return title.startsWith(q);
            } else {
                // 섹션 후보: 섹션 제목 또는 문서 제목이 검색어로 시작하면
                const heading = item.headingText?.toLowerCase() || '';
                return heading.startsWith(q) || title.startsWith(q);
            }
        });
    }, [linkCandidates, linkQuery]);

    // 🔹 [[ + 검색어 → [[제목]] / [[제목#1.1|고기]] 으로 치환
    const applyInternalLink = (item) => {
        if (!item) return;

        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const markdown = instance.getMarkdown() || '';
        const info = findOpenInternalLink(markdown);

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

        let newMarkdown;

        if (!info.open) {
            // 혹시 못 찾으면 그냥 현재 위치에 삽입
            instance.insertText(insertion);
            newMarkdown = instance.getMarkdown() || '';
        } else {
            const { index, tail } = info;
            const before = markdown.slice(0, index); // [[ 이전 전체
            newMarkdown = before + insertion + tail;
            instance.setMarkdown(newMarkdown);
        }

        onChange(newMarkdown);

        setIsLinkPaletteOpen(false);
        setLinkQuery('');
        setHighlightIndex(0);

        // 커서를 삽입된 ]] 뒤로 옮기기
        const caretIndex = newMarkdown.indexOf(insertion) + insertion.length;
        if (caretIndex > 1) {
            const textBeforeCaret = newMarkdown.slice(0, caretIndex);
            const lines = textBeforeCaret.split('\n');
            const line = lines.length - 1;
            const ch = lines[lines.length - 1].length;

            if (instance.setSelection) {
                instance.setSelection({ line, ch }, { line, ch });
            }
            if (instance.focus) {
                instance.focus();
            }
        }
    };

    // 🔹 Esc: [[ + 검색어 조각 삭제
    const cancelInternalLink = () => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const markdown = instance.getMarkdown() || '';
        const info = findOpenInternalLink(markdown);
        if (!info.open) {
            // 열려 있는 조각 없으면 그냥 팝업만 닫기
            setIsLinkPaletteOpen(false);
            setLinkQuery('');
            setHighlightIndex(0);
            return;
        }

        const { index, tail } = info;
        const before = markdown.slice(0, index); // [[ 이전
        // [[ + 검색어 부분 제거하고 tail만 남김
        const newMarkdown = before + tail;

        instance.setMarkdown(newMarkdown);
        onChange(newMarkdown);

        setIsLinkPaletteOpen(false);
        setLinkQuery('');
        setHighlightIndex(0);
    };

    // 🔹 keydown: 팝업 열려 있는 동안 ↑↓ / Enter / Esc 처리
    useEffect(() => {
        const handleKey = (e) => {
            if (!isLinkPaletteOpenRef.current) return;

            // 조합키는 무시
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancelInternalLink();
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
    }, [filteredCandidates, highlightIndex]);

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
            // TUI 에디터 내부 렌더 영역
            const contents = document.querySelector('.toastui-editor-contents');
            if (!contents) return;

            const targetText = (activeHeading.text || '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!targetText) return;

            const headingEls = contents.querySelectorAll('h1,h2,h3,h4,h5,h6');
            if (!headingEls.length) return;

            const targetEl = Array.from(headingEls).find((el) => {
                const text = (el.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                return text === targetText;
            });

            if (!targetEl || !targetEl.scrollIntoView) return;

            targetEl.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, [activeHeading]);

    // =========================
    // 폰트 사이즈 위젯 적용 로직
    // =========================
    const applyInlineFontSize = (sizePt) => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const markdown = instance.getMarkdown() || '';
        const tokenReGlobal = /\{\{(?:fs:)?(sm|md|lg|\d+)\|([\s\S]+?)\}\}/g;

        const cursor = instance.getCursor?.();
        const lines = markdown.split('\n');

        // 1) 커서가 기존 토큰 안에 있거나, 같은 라인에 토큰이 있는 경우 → 그 토큰만 크기 변경
        if (cursor) {
            let idx = 0;
            for (let i = 0; i < cursor.line; i += 1) {
                idx += lines[i].length + 1; // 개행 포함
            }
            idx += cursor.ch;

            // 1-1) 커서 위치 기준으로 토큰 찾기
            let m;
            while ((m = tokenReGlobal.exec(markdown)) !== null) {
                const start = m.index;
                const end = start + m[0].length;
                if (idx >= start && idx <= end) {
                    const inner = m[2];
                    const newToken = `{{fs:${sizePt}|${inner}}}`;
                    const newMarkdown =
                        markdown.slice(0, start) + newToken + markdown.slice(end);
                    instance.setMarkdown(newMarkdown);
                    onChange(newMarkdown);
                    return;
                }
            }

            // 1-2) 커서가 토큰 안은 아니더라도, 동일한 라인에 토큰이 있으면 그 토큰 변경
            let lineStart = 0;
            for (let i = 0; i < cursor.line; i += 1) {
                lineStart += lines[i].length + 1;
            }
            const lineText = lines[cursor.line] ?? '';
            const tokenReLine = /\{\{(?:fs:)?(sm|md|lg|\d+)\|([\s\S]+?)\}\}/;
            const lm = tokenReLine.exec(lineText);
            if (lm) {
                const tokenStart = lineStart + lm.index;
                const tokenEnd = tokenStart + lm[0].length;
                const inner = lm[2];
                const newToken = `{{fs:${sizePt}|${inner}}}`;
                const newMarkdown =
                    markdown.slice(0, tokenStart) + newToken + markdown.slice(tokenEnd);
                instance.setMarkdown(newMarkdown);
                onChange(newMarkdown);
                return;
            }
        }

        // 2) 선택된 텍스트가 있는 경우 → 그 텍스트를 토큰으로 감싸기
        let selected = instance.getSelectedText?.() || '';
        if (selected) {
            // 기존 토큰 제거
            selected = selected.replace(
                /\{\{(?:fs:)?(sm|md|lg|\d+)\|([\s\S]+?)\}\}/g,
                '$2'
            );
            // 줄바꿈은 공백으로
            selected = selected.replace(/\s*\n+\s*/g, ' ').trim();
            if (selected) {
                const token = `{{fs:${sizePt}|${selected}}}`;
                instance.replaceSelection(token);
            }
            return;
        }

        // 3) 선택이 없으면 → 커서 기준 “단어 전체”를 감싸기 (일반 텍스트용)
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
                const token = `{{fs:${sizePt}|${word}}}`;
                const newMarkdown =
                    markdown.slice(0, start) + token + markdown.slice(end);
                instance.setMarkdown(newMarkdown);
                onChange(newMarkdown);
                return;
            }
        }

        // 4) 토큰도 없고, 선택된 텍스트도 없고, 단어도 못 찾은 경우 → 아무것도 하지 않음
        // (예전처럼 {{fs:...|텍스트}} 같은 기본 삽입은 하지 않음)
    };

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
    }, []);

    // =========================
    // 폰트 팝업 위치/열림 상태
    // =========================
    const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
    const [fontPickerPos, setFontPickerPos] = useState({ top: 0, left: 0 });
    const fontPickerRef = useRef(null);

    const fontSizes = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28];

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

            const pickerWidth = 220; // 대략
            const pickerHeight = 200;
            const margin = 8;

            let top = window.innerHeight / 2;
            let left = window.innerWidth / 2;

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
        };

        window.addEventListener('keydown', handleFontShortcut, true);
        return () => window.removeEventListener('keydown', handleFontShortcut, true);
    }, []);

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

    return (
        <div className={fullHeight ? 'h-full' : ''}>
            <Editor
                ref={editorRef}
                initialValue={value || ''}
                previewStyle="vertical"
                // 🔹 fullHeight일 땐 부모 div 높이 100% 채우고, 그 안에서 스크롤
                height={fullHeight ? '100%' : 'auto'}
                minHeight="200px"
                initialEditType="wysiwyg"
                hideModeSwitch={true}
                useCommandShortcut={true}
                plugins={[
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
                toolbarItems={[
                    ['heading', 'bold', 'italic', 'strike'],
                    ['ul', 'ol', 'task'],
                    ['table'],
                    ['link'],
                    ['hr', 'quote', 'code', 'codeblock'],
                ]}
                widgetRules={fontWidgetRules}
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
                <div className="absolute bottom-4 left-1/2 z-20 w-80 -translate-x-1/2 rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                        <span className="font-semibold">내부 링크 추가</span>
                        <span className="ml-2 text-[10px] text-slate-400">
              제목이나 섹션을 타이핑해. ↑↓ / Enter / Esc
            </span>
                    </div>
                    <div className="px-3 py-2">
                        <div className="mb-1 text-[10px] text-slate-400">
                            검색어:{' '}
                            <span className="font-mono">
                {linkQuery || ' '}
              </span>
                        </div>
                        {filteredCandidates.length === 0 ? (
                            <div className="rounded-lg bg-slate-50 px-2 py-2 text-[11px] text-slate-400">
                                일치하는 문서가 없어.
                            </div>
                        ) : (
                            <ul
                                ref={paletteListRef}
                                className="max-h-52 space-y-1 overflow-y-auto py-1 text-[12px]"
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
                                            'cursor-pointer rounded-lg px-2 py-1 ' +
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
                                                <div className="truncate text-[10px] text-slate-400">
                                                    /wiki/{item.slug}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="truncate font-medium">
                                                    {item.headingText}
                                                </div>
                                                <div className="truncate text-[10px] text-slate-400">
                                                    {item.docTitle} · {item.sectionNumber}
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
