// src/features/wiki/MarkdownEditor.jsx
import { useEffect, useRef, useState, useMemo } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';

export default function MarkdownEditor({ value, onChange, allDocs = [] }) {
    const editorRef = useRef(null);
    const wrapperRef = useRef(null);
    const lastKeyRef = useRef(null);

    // 🔹 내부 링크 자동완성 팝업 상태
    const [isLinkPaletteOpen, setIsLinkPaletteOpen] = useState(false);
    const [linkQuery, setLinkQuery] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);

    // 외부에서 content가 바뀌었을 때 에디터도 동기화
    useEffect(() => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;

        const current = instance.getMarkdown();
        if ((value || '') !== current) {
            instance.setMarkdown(value || '');
        }
    }, [value]);

    const handleChange = () => {
        const instance = editorRef.current?.getInstance();
        if (!instance) return;
        const markdown = instance.getMarkdown(); // DB에는 계속 markdown으로 저장
        onChange(markdown);
    };

    // 🔹 문서 목록 필터링 (제목 기준)
    const filteredDocs = useMemo(() => {
        const q = linkQuery.trim().toLowerCase();
        if (!q) return allDocs || [];
        return (allDocs || []).filter((doc) =>
            doc.title?.toLowerCase().includes(q),
        );
    }, [allDocs, linkQuery]);

    // 🔹 전역 keydown: [[ 입력 감지 + 팝업 열린 상태에서의 조작
    useEffect(() => {
        const handleKey = (e) => {
            const active = document.activeElement;
            const isInEditor =
                wrapperRef.current &&
                active &&
                wrapperRef.current.contains(active);

            // ────────────────
            // 1) 팝업이 열려있을 때의 조작
            // ────────────────
            if (isLinkPaletteOpen) {
                // Esc → 닫기
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsLinkPaletteOpen(false);
                    setLinkQuery('');
                    setHighlightIndex(0);
                    return;
                }

                // 방향키로 선택 이동
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    setHighlightIndex((prev) => {
                        if (filteredDocs.length === 0) return 0;
                        return (prev + 1) % filteredDocs.length;
                    });
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    setHighlightIndex((prev) => {
                        if (filteredDocs.length === 0) return 0;
                        return (prev - 1 + filteredDocs.length) % filteredDocs.length;
                    });
                    return;
                }

                // Enter → 선택된 문서를 [[제목]] 형식으로 삽입
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const doc = filteredDocs[highlightIndex];
                    if (!doc) return;

                    const instance = editorRef.current?.getInstance();
                    if (!instance) return;

                    // 사용자가 이미 [[ 을 타이핑한 상태이므로
                    // 여기서 "제목]]" 만 넣어주면 최종적으로 [[제목]] 이 됨
                    instance.insertText(`${doc.title}]]`);

                    setIsLinkPaletteOpen(false);
                    setLinkQuery('');
                    setHighlightIndex(0);
                    lastKeyRef.current = null;
                    return;
                }

                // 일반 문자 입력 → 검색어로 사용
                if (
                    e.key.length === 1 &&
                    !e.ctrlKey &&
                    !e.metaKey &&
                    !e.altKey
                ) {
                    e.preventDefault();
                    setLinkQuery((prev) => prev + e.key);
                    return;
                }

                // Backspace → 검색어 지우기
                if (e.key === 'Backspace') {
                    e.preventDefault();
                    setLinkQuery((prev) => prev.slice(0, -1));
                    return;
                }

                return; // 팝업 열려있으면 여기서 처리 끝
            }

            // ────────────────
            // 2) 팝업이 닫혀있을 때: 에디터 안에서 [[ 입력 감지
            // ────────────────
            if (!isInEditor) {
                lastKeyRef.current = e.key;
                return;
            }

            // Ctrl, Cmd 등 조합키는 무시 (Ctrl+K 검색과 충돌 방지)
            if (e.ctrlKey || e.metaKey || e.altKey) {
                lastKeyRef.current = e.key;
                return;
            }

            if (e.key === '[' && lastKeyRef.current === '[') {
                // 사용자가 에디터 안에서 [[ 를 입력한 시점
                setIsLinkPaletteOpen(true);
                setLinkQuery('');
                setHighlightIndex(0);
                // [[ 자체는 에디터에 그대로 들어가도록 preventDefault 안 함
            }

            lastKeyRef.current = e.key;
        };

        window.addEventListener('keydown', handleKey, true);
        return () => window.removeEventListener('keydown', handleKey, true);
    }, [isLinkPaletteOpen, filteredDocs, highlightIndex]);

    return (
        <div
            ref={wrapperRef}
            className="relative rounded-xl border border-slate-200 bg-white"
        >
            <Editor
                ref={editorRef}
                initialValue={value || ''}
                previewStyle="vertical"
                height="730px"
                initialEditType="wysiwyg"
                hideModeSwitch={true}
                useCommandShortcut={true}
                toolbarItems={[
                    ['heading', 'bold', 'italic', 'strike'],
                    ['hr', 'quote'],
                    ['ul', 'ol', 'task'],
                    ['link'],
                    ['code', 'codeblock'],
                ]}
                onChange={handleChange}
            />

            {/* 🔹 내부 링크 자동완성 팝업 */}
            {isLinkPaletteOpen && (
                <div className="absolute bottom-4 left-1/2 z-20 w-80 -translate-x-1/2 rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                        <span className="font-semibold">내부 링크 추가</span>
                        <span className="ml-2 text-[10px] text-slate-400">
                            제목을 타이핑해서 문서를 찾아봐. ↑↓ / Enter / Esc
                        </span>
                    </div>
                    <div className="px-3 py-2">
                        <div className="mb-1 text-[10px] text-slate-400">
                            검색어:{' '}
                            <span className="font-mono">
                                {linkQuery || ' '}
                            </span>
                        </div>
                        {filteredDocs.length === 0 ? (
                            <div className="rounded-lg bg-slate-50 px-2 py-2 text-[11px] text-slate-400">
                                일치하는 문서가 없어.
                            </div>
                        ) : (
                            <ul className="max-h-52 space-y-1 overflow-y-auto py-1 text-[12px]">
                                {filteredDocs.map((doc, idx) => (
                                    <li
                                        key={doc.id}
                                        className={
                                            'cursor-pointer rounded-lg px-2 py-1 ' +
                                            (idx === highlightIndex
                                                ? 'bg-slate-100 text-slate-900'
                                                : 'text-slate-700 hover:bg-slate-50')
                                        }
                                    >
                                        <div className="truncate font-medium">
                                            {doc.title}
                                        </div>
                                        <div className="truncate text-[10px] text-slate-400">
                                            /wiki/{doc.slug}
                                        </div>
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
