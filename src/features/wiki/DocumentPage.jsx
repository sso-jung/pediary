// src/features/wiki/DocumentPage.jsx
import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
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
    const location = useLocation();
    const user = useAuthStore((s) => s.user);

    const { data: doc, isLoading } = useDocument(slug);
    const { data: allDocs } = useAllDocuments();
    const updateMutation = useUpdateDocument(doc?.id, slug);
    const { showSnackbar } = useSnackbar();

    const [content, setContent] = useState('');
    const initialIsEditing = searchParams.get('mode') === 'edit';
    const [isEditing, setIsEditing] = useState(initialIsEditing);
    const [showBacklinks, setShowBacklinks] = useState(false); // 🔹 역링크 패널 토글
    const [visibility, setVisibility] = useState('private');

    // 🔹 소유자 여부 / 편집 가능 여부
    const isOwner = doc && user && doc.user_id === user.id;
    // 나중에 친구 편집 허용 플래그 붙일 수 있는 자리
    const canEdit = isOwner; // || doc?.allow_friend_edit === true;

    const viewLoggedRef = useRef(false);
    const viewerContainerRef = useRef(null);

    // 🔹 doc 내용 → 에디터 content 동기화
    useEffect(() => {
        if (doc) {
            setContent(doc.content_markdown || '');
            setVisibility(doc.visibility || 'private');

            // URL에 mode=edit 이 있어도, 편집 권한 없으면 강제로 보기 모드
            const mode = searchParams.get('mode');
            if (mode === 'edit' && canEdit) {
                setIsEditing(true);
            } else {
                setIsEditing(false);
            }
        }
    }, [doc, searchParams, canEdit]);

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

    // 🔹 내부 링크 파싱 + 정렬 블록 적용
    let parsedMarkdown = parseInternalLinks(content || '', allDocs);
    // parsedMarkdown = applyTextAlignBlocks(parsedMarkdown);

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

    // 🔹 URL 해시(#sec-2-1)가 바뀔 때마다 해당 섹션으로 스크롤
    useEffect(() => {
        const { hash } = location;
        const container = viewerContainerRef.current;
        if (!container) return;
        if (!hash) return;
        if (isEditing) return; // 편집 모드에서는 이동 안 함

        const id = hash.slice(1); // "#sec-2-1" → "sec-2-1"
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
    }, [location.hash, isEditing, markdownWithAnchors]);

    // 🔹 역링크 계산
    //  - 다른 문서의 마크다운을 한 줄씩 보면서
    //  - heading 번호(1, 1.1, 1.1.1 ...)를 계산
    //  - 그 섹션 안에 [[현재제목]] / [[현재제목#...]] 이 있으면
    //    → 그 섹션 하나를 "업무#1.1.1" 같은 링크로 한 번만 추가
    const backlinks = useMemo(() => {
        if (!doc || !Array.isArray(allDocs)) return [];
        const currentTitle = doc.title?.trim();
        if (!currentTitle) return [];

        const result = [];

        for (const other of allDocs) {
            if (!other || other.id === doc.id) continue;

            const raw = other.content_markdown || '';
            if (!raw) continue;

            // 🔹 sanitizer가 붙인 역슬래시를 한 번 풀어준다
            const normalized = raw
                .replace(/\\\[/g, '[')
                .replace(/\\\]/g, ']')
                .replace(/\\#/g, '#')
                .replace(/\\\|/g, '|')
                .replace(/\\\./g, '.');

            // 🔹 실제 [[ 가 없으면 스킵
            if (!normalized.includes('[[')) continue;

            const lines = normalized.split('\n');
            const counters = [0, 0, 0, 0, 0, 0, 0];

            let currentSectionNumber = null;
            let currentSectionId = null;

            const sectionMap = new Map();

            for (const line of lines) {
                const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
                if (hMatch) {
                    const level = hMatch[1].length;
                    counters[level] += 1;
                    for (let i = level + 1; i < counters.length; i++) {
                        counters[i] = 0;
                    }
                    const nums = counters.slice(1, level + 1).filter((n) => n > 0);
                    const number = nums.join('.');
                    const sectionKey = number.replace(/\./g, '-');
                    currentSectionNumber = number;
                    currentSectionId = `sec-${sectionKey}`;
                }

                const linkRegex = /\[\[([^[\]]+)\]\]/g;
                let m;
                while ((m = linkRegex.exec(line)) !== null) {
                    const inner = m[1]; // "요리#1.1|보쌈 & 무김치"
                    const [rawTitle] = inner.split('#');
                    if (rawTitle.trim() !== currentTitle) continue;

                    const key = currentSectionId || '__no_section__';

                    if (!sectionMap.has(key)) {
                        let href = `/wiki/${other.slug}`;
                        let label = other.title;

                        if (currentSectionId && currentSectionNumber) {
                            href = `${href}#${currentSectionId}`;
                            label = `${other.title}#${currentSectionNumber}`;
                        }

                        sectionMap.set(key, { href, label });
                    }
                }
            }

            if (sectionMap.size > 0) {
                result.push({
                    docId: other.id,
                    docTitle: other.title,
                    links: Array.from(sectionMap.values()),
                });
            }
        }

        return result;
    }, [doc, allDocs]);

    const totalBacklinkCount = useMemo(
        () => backlinks.reduce((sum, b) => sum + b.links.length, 0),
        [backlinks],
    );

    const handleSave = (e) => {
        e.preventDefault();
        if (!doc) return;
        if (!canEdit) {
            showSnackbar('이 문서는 보기만 가능합니다.');
            return;
        }

        updateMutation.mutate(
            {
                title: doc.title,
                contentMarkdown: content,
                visibility,
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
                    {!isEditing && isOwner && (
                        <div className="mt-1 text-[11px]">
                            <span
                                className={
                                    'inline-flex items-center rounded-full px-2 py-[2px] ' +
                                    (visibility === 'friends'
                                        ? 'bg-fuchsia-50 text-fuchsia-700'
                                        : 'bg-slate-100 text-slate-500')
                                }
                            >
                                {visibility === 'friends' ? '친구 공개' : '나만 보기'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    {/* 🔹 편집 가능할 때만 공개 범위 토글 + 저장 버튼 노출 */}
                    {canEdit && isEditing && (
                        <>
                            <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-[11px]">
                                <span className="ml-2 mr-1 hidden text-slate-500 sm:inline">
                                    공개 범위
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setVisibility('private')}
                                    className={
                                        'rounded-full px-3 py-1 ' +
                                        (visibility === 'private'
                                            ? 'bg-white text-slate-900 shadow'
                                            : 'text-slate-500 hover:text-slate-700')
                                    }
                                >
                                    나만 보기
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVisibility('friends')}
                                    className={
                                        'rounded-full px-3 py-1 ' +
                                        (visibility === 'friends'
                                            ? 'bg-white text-slate-900 shadow'
                                            : 'text-slate-500 hover:text-slate-700')
                                    }
                                >
                                    친구 공개
                                </button>
                            </div>

                            <Button
                                type="submit"
                                className="sm:w-24"
                                disabled={updateMutation.isLoading}
                            >
                                {updateMutation.isLoading ? '저장 중...' : '저장'}
                            </Button>
                        </>
                    )}

                    {/* 보기/편집 토글 */}
                    {isOwner && (
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

                        {canEdit && (
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
                        )}
                        {/* 🔹 편집 권한 없으면 '편집' 버튼을 아예 안 보여줌 */}
                    </div>
                     )}
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
                            <MarkdownEditor
                                value={content}
                                onChange={setContent}
                                allDocs={allDocs || []}
                            />
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

            {/* 🔹 역링크 패널 – 접었다 펼치는 아코디언 형태 */}
            {!isEditing && (
                <div className="rounded-2xl bg-white p-3 shadow-soft text-xs">
                    <button
                        type="button"
                        onClick={() => setShowBacklinks((v) => !v)}
                        className="flex w-full items-center justify-between text-left"
                    >
                        <span className="text-[11px] font-semibold text-slate-500">
                            이 문서를 참조하는 문서
                            {totalBacklinkCount > 0 && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-[1px] text-[10px] text-slate-500">
                                    {totalBacklinkCount}개
                                </span>
                            )}
                        </span>
                        <span className="text-[10px] text-slate-400">
                            {showBacklinks ? '숨기기 ▲' : '보기 ▼'}
                        </span>
                    </button>

                    {showBacklinks && (
                        <div className="mt-2 border-t border-slate-100 pt-2">
                            {backlinks.length === 0 ? (
                                <p className="text-[11px] text-slate-400">
                                    아직 이 문서를{' '}
                                    <span className="font-mono">[[{doc.title}]]</span> 형식으로
                                    참조하는 다른 문서가 없어.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {backlinks.map((b) => (
                                        <li key={b.docId}>
                                            <div className="text-[12px] font-semibold text-slate-800">
                                                {b.docTitle}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {b.links.map((l, idx) => (
                                                    <Link
                                                        key={idx}
                                                        to={l.href}
                                                        className="rounded-full bg-slate-100 px-2 py-[2px] text-[11px] text-slate-700 hover:bg-slate-200"
                                                    >
                                                        {l.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
