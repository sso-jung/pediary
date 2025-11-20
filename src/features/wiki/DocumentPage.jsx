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
import { applyTextAlignBlocks } from '../../lib/wikiTextAlign';

// 🔹 마크다운에서 heading 찾아서 번호 + 앵커(id) 붙이는 함수
function buildSectionTree(markdown) {
    if (!markdown) {
        return { markdownWithAnchors: '', headings: [] };
    }

    const lines = markdown.split('\n');
    const headings = [];
    const newLines = [];

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
            const number = nums.join('.'); // "1", "1.1", "1.1.1" ...

            // 🔹 앵커 id를 "sec-1-1-1" 형식으로
            const sectionKey = number.replace(/\./g, '-'); // "1.2.1" → "1-2-1"
            const id = `sec-${sectionKey}`;

            // 🔹 사이드바에서 쓸 데이터
            headings.push({ id, level, text: rawText, number });

            // 🔹 Viewer용 마크다운 줄 만들기
            //    항상 앞에 빈 줄을 하나 넣어서 Markdown 파서가 확실히 헤딩으로 인식하도록 한다.
            newLines.push(''); // 빈 줄
            newLines.push(`<a id="${id}"></a>`);
            newLines.push(`${hashes} ${number} ${rawText}`);
        } else {
            newLines.push(line);
        }
    }

    return {
        markdownWithAnchors: newLines.join('\n'),
        headings,
    };
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

    // 🔹 doc 내용 → 에디터 content 동기화
    useEffect(() => {
        if (doc) {
            setContent(doc.content_markdown || '');
        }
    }, [doc]);

    // 🔹 URL 쿼리(mode)로 보기/편집 모드 동기화
    useEffect(() => {
        const mode = searchParams.get('mode');
        setIsEditing(mode === 'edit');
    }, [searchParams]);

    // 🔹 최초 viewed 로그 기록
    useEffect(() => {
        if (!doc || !user || viewLoggedRef.current) return;

        viewLoggedRef.current = true;
        logDocumentActivity({
            userId: user.id,
            documentId: doc.id,
            action: 'viewed',
        });
    }, [doc, user]);

    // 🔹 내부 링크 파싱 + 정렬 블록 적용 (doc 유무와 상관없이 안전하게 동작)
    let parsedMarkdown = parseInternalLinks(content || '', allDocs);
    parsedMarkdown = applyTextAlignBlocks(parsedMarkdown);

    // 🔹 섹션 트리 & 앵커 생성
    const { markdownWithAnchors, headings } = buildSectionTree(parsedMarkdown);

    // 🔹 사이드바에서 섹션 클릭 시 스크롤
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

    // 🔹 Viewer 안의 [[문서#1.2.1]] 같은 내부 링크 클릭 시, 같은 문서면 해당 섹션으로 스크롤
    useEffect(() => {
        const container = viewerContainerRef.current;
        if (!container) return;

        const handleClick = (e) => {
            const anchor = e.target.closest('a.wiki-link');
            if (!anchor) return;

            const href = anchor.getAttribute('href') || '';
            if (!href.startsWith('/wiki/')) return;

            const [path, hash] = href.split('#');
            const currentPath = `/wiki/${slug}`;

            // 다른 문서로 가는 링크는 그대로 두기
            if (path !== currentPath) return;

            // 같은 문서인데 섹션이 없으면 기본 동작
            if (!hash) return;

            e.preventDefault(); // 기본 브라우저 해시 스크롤 막기

            const id = decodeURIComponent(hash); // "sec-2-1" 같은 값
            const el = container.querySelector(`#${id}`);
            if (!el) return;

            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();

            const offset =
                elRect.top - containerRect.top + container.scrollTop - 8;

            container.scrollTo({
                top: offset,
                behavior: 'smooth',
            });
        };

        container.addEventListener('click', handleClick);
        return () => {
            container.removeEventListener('click', handleClick);
        };
    }, [slug, markdownWithAnchors]); // 🔹 항상 같은 위치에서 호출되므로 Hook 순서가 안정적

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

    // 🔹 여기서는 더 이상 Hook을 새로 호출하지 않으므로, 조건부 return은 안전
    if (isLoading || !doc) {
        return (
            <div className="text-sm text-slate-500">
                {isLoading ? '문서를 불러오는 중...' : '문서를 찾을 수 없습니다.'}
            </div>
        );
    }

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
