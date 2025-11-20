// src/features/wiki/DocumentPage.jsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Viewer } from '@toast-ui/react-editor';

import { useDocument } from './hooks/useDocument';
import { useUpdateDocument } from './hooks/useUpdateDocument';
import { useAllDocuments } from './hooks/useAllDocuments';
import Button from '../../components/ui/Button';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import { parseInternalLinks } from '../../lib/internalLinkParser';
import { useAuthStore } from '../../store/authStore';
import { logDocumentActivity } from '../../lib/wikiApi';
import MarkdownEditor from './MarkdownEditor';

function buildSectionTree(markdown) {
    if (!markdown) {
        return { markdownWithAnchors: '', headings: [] };
    }

    const lines = markdown.split('\n');
    const headings = [];
    const newLines = [];

    let index = 0;
    // 레벨별 번호 카운터 (1~6 레벨 사용)
    const counters = [0, 0, 0, 0, 0, 0, 0];

    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.*)$/); // "# 제목" ~ "###### 제목"
        if (match) {
            const hashes = match[1];         // "##"
            const level = hashes.length;     // 2
            const rawText = match[2].trim(); // 원래 제목 텍스트

            // 🔹 번호 계산: 1, 1.1, 1.1.1 ...
            counters[level] += 1;
            for (let i = level + 1; i < counters.length; i++) {
                counters[i] = 0;
            }
            const nums = counters.slice(1, level + 1).filter((n) => n > 0);
            const number = nums.join('.'); // "1", "1.2", "1.2.3" ...

            // 🔹 앵커 id (예: sec-0-개요)
            const baseId =
                rawText
                    .toLowerCase()
                    .replace(/[^a-z0-9가-힣]+/g, '-')
                    .replace(/^-+|-+$/g, '') || `section-${index}`;

            const id = `sec-${index}-${baseId}`;

            // 🔹 사이드바에서 쓸 데이터
            headings.push({ id, level, text: rawText, number });

            // 🔹 Viewer용 마크다운 줄 만들기
            //    <a id="..."></a> + "## 1.1 제목"
            newLines.push(`<a id="${id}"></a>`);
            newLines.push(`${hashes} ${number} ${rawText}`);

            index += 1;
        } else {
            newLines.push(line);
        }
    }

    return {
        markdownWithAnchors: newLines.join('\n'),
        headings,
    };
}

// 🔹 섹션 트리에 1 / 1.1 / 1.1.1 번호 붙여주는 함수
function addHeadingNumbers(headings) {
    const counters = [0, 0, 0, 0, 0, 0, 0]; // level 1~6 사용

    return headings.map((h) => {
        const level = h.level;

        counters[level] += 1;
        // 하위 레벨 초기화
        for (let i = level + 1; i < counters.length; i++) {
            counters[i] = 0;
        }

        const nums = counters.slice(1, level + 1).filter((n) => n > 0);
        const number = nums.join('.'); // "1", "1.1", "1.1.1" ...

        return {
            ...h,
            number,
        };
    });
}


export default function DocumentPage() {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const user = useAuthStore((s) => s.user);

    const { data: doc, isLoading } = useDocument(slug);
    const { data: allDocs } = useAllDocuments();
    const updateMutation = useUpdateDocument(doc?.id, slug);
    const { showSnackbar } = useSnackbar();

    const [content, setContent] = useState('');
    const initialIsEditing = searchParams.get('mode') === 'edit';
    const [isEditing, setIsEditing] = useState(initialIsEditing);

    const viewLoggedRef = useRef(false);
    const viewerContainerRef = useRef(null);

    useEffect(() => {
        if (doc) {
            setContent(doc.content_markdown || '');
        }
    }, [doc]);

    useEffect(() => {
        const mode = searchParams.get('mode');
        setIsEditing(mode === 'edit');
    }, [searchParams]);

    useEffect(() => {
        if (!doc || !user || viewLoggedRef.current) return;

        viewLoggedRef.current = true;
        logDocumentActivity({
            userId: user.id,
            documentId: doc.id,
            action: 'viewed',
        });
    }, [doc, user]);

    const handleSave = (e) => {
        e.preventDefault();
        if (!doc) return;

        updateMutation.mutate(
            {
                title: doc.title,
                contentMarkdown: content,
            },
            {
                onSuccess: () => {
                    showSnackbar('저장 완료!');
                    setIsEditing(false);
                },
                onError: () => {
                    showSnackbar('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
                },
            },
        );
    };

    if (isLoading || !doc) {
        return (
            <div className="text-sm text-slate-500">
                {isLoading ? '문서를 불러오는 중...' : '문서를 찾을 수 없습니다.'}
            </div>
        );
    }

    // 내부 링크 파싱
    const parsedMarkdown = parseInternalLinks(content || '', allDocs);
    const { markdownWithAnchors, headings } = buildSectionTree(parsedMarkdown);
    const numberedHeadings = addHeadingNumbers(headings);

    const handleClickHeading = (id) => {
        const container = viewerContainerRef.current;
        if (!container) return;

        const el = container.querySelector(`#${id}`);
        if (!el) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        const offset = elRect.top - containerRect.top + container.scrollTop - 8;

        container.scrollTo({
            top: offset,
            behavior: 'smooth',
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col space-y-4">
            {/* 상단 바: 제목 + 보기/편집 + 저장 */}
            <form
                onSubmit={handleSave}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
                <div className="flex-1">
                    {!isEditing && (
                        <h1 className="text-2xl font-semibold text-slate-800">
                            {doc.title}
                        </h1>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isEditing && (
                        <Button
                            type="submit"
                            className="sm:w-24"
                            disabled={updateMutation.isLoading}
                        >
                            {updateMutation.isLoading ? '저장 중...' : '저장'}
                        </Button>
                    )}
                    <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-xs sm:text-sm">
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className={
                                'rounded-full px-3 py-1 transition ' +
                                (!isEditing
                                    ? 'bg-white text-slate-900 shadow'
                                    : 'text-slate-500 hover:text-slate-700')
                            }
                        >
                            보기
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className={
                                'rounded-full px-3 py-1 transition ' +
                                (isEditing
                                    ? 'bg-white text-slate-900 shadow'
                                    : 'text-slate-500 hover:text-slate-700')
                            }
                        >
                            편집
                        </button>
                    </div>
                </div>
            </form>

            {/* 섹션 트리 + 내용 영역 */}
            <div className="flex-1 min-h-0 grid auto-rows-[minmax(0,1fr)] gap-4 md:grid-cols-[260px,minmax(0,1fr)]">
                {/* 섹션 트리 패널 */}
                <aside className="hidden h-full overflow-y-auto rounded-2xl bg-white p-3 text-xs shadow-soft md:block">
                    <h2 className="mb-2 text-[11px] font-semibold text-slate-500">
                        섹션
                    </h2>

                    {headings.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                            에디터에서 제목(Heading)을 추가하면<br />
                            여기에서 섹션 트리를 볼 수 있어.
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {headings.map((h) => (
                                <li key={h.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleClickHeading(h.id)}
                                        className="w-full text-left text-[12px] text-slate-700 hover:text-primary-600"
                                        style={{ paddingLeft: (h.level - 1) * 12 }}
                                    >
                                        {/* 🔹 번호 표시 */}
                                        <span className="mr-1 text-[11px] text-slate-400">
                        {h.number}
                    </span>
                                        {h.text}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                {/* 내용 영역 – 여기만 스크롤 */}
                <div className="h-full overflow-hidden rounded-2xl bg-white p-4 shadow-soft">
                    {isEditing ? (
                        // 편집 모드: 에디터도 h-full로 맞춤
                        <div className="h-full">
                            <MarkdownEditor value={content} onChange={setContent} />
                        </div>
                    ) : (
                        // 보기 모드: Viewer 래퍼에만 스크롤
                        <div
                            ref={viewerContainerRef}
                            className="tui-viewer-wrapper h-full overflow-y-auto"
                        >
                            <Viewer
                                key={markdownWithAnchors}
                                initialValue={markdownWithAnchors}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
