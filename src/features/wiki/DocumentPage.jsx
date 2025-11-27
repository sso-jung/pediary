// src/features/wiki/DocumentPage.jsx
import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Viewer } from '@toast-ui/react-editor';
import 'tui-color-picker/dist/tui-color-picker.css';
import '@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css';

import { useDocument } from './hooks/useDocument';
import { useUpdateDocument } from './hooks/useUpdateDocument';
import { useAllDocuments } from './hooks/useAllDocuments';
import { useCategories } from './hooks/useCategories';
import { useUpdateDocumentCategory } from './hooks/useUpdateDocumentCategory';

import Button from '../../components/ui/Button';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import { parseInternalLinks } from '../../lib/internalLinkParser';
import { useAuthStore } from '../../store/authStore';
import { logDocumentActivity, updateSectionLinksForDocument } from '../../lib/wikiApi';
import MarkdownEditor from './MarkdownEditor';
import { applyTextAlignBlocks } from '../../lib/wikiTextAlign';
import { parseInternalLinkInner } from '../../lib/internalLinkFormat';

function stripHeadingText(rawText = '') {
    let s = rawText;

    // 1) HTML 태그 제거
    s = s.replace(/<[^>]*>/g, '');

    // 2) [텍스트](링크) → 텍스트
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');

    // 3) **굵게**, *이탤릭*, `코드` 등 기호 제거
    s = s.replace(/[*_`~]/g, '');

    // 4) 공백 정리
    s = s.replace(/\s+/g, ' ');

    return s.trim();
}

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
            const hashes = match[1]; // "##"
            const level = hashes.length; // 2
            const rawText = match[2].trim(); // 원래 제목 텍스트
            const plainText = stripHeadingText(rawText);

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
            headings.push({ id, level, text: plainText, number });

            // 🔹 Viewer용 마크다운 줄 만들기
            newLines.push(''); // 빈 줄
            newLines.push(`<a id="${id}"></a>`);
            newLines.push(
                `${hashes} <span class="wiki-heading-number">${number}.</span> ${rawText}`,
            );
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

    const { data: categories } = useCategories();

    // 🔹 현재 문서의 카테고리 상태 (select value로 사용)
    const [categoryId, setCategoryId] = useState(null);

    const [content, setContent] = useState('');
    const initialIsEditing = searchParams.get('mode') === 'edit';
    const [isEditing, setIsEditing] = useState(initialIsEditing);
    const [showBacklinks, setShowBacklinks] = useState(false); // 🔹 역링크 패널 토글
    const [visibility, setVisibility] = useState('private');

    // 🔹 소유자 여부 / 편집 가능 여부
    const isOwner = doc && user && doc.user_id === user.id;
    const canEdit = isOwner; // 나중에 친구 편집 허용 플래그

    const viewLoggedRef = useRef(false);
    const viewerContainerRef = useRef(null);

    // 🔹 문서 로딩 시 카테고리 초기값 세팅
    useEffect(() => {
        if (doc) {
            setCategoryId(doc.category_id ?? null);
        }
    }, [doc]);

    // 🔹 doc 내용 → 에디터 content 동기화
    useEffect(() => {
        if (doc) {
            setContent(doc.content_markdown || '');
            setVisibility(doc.visibility || 'private');

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

    // 🔹 사이드바에서 섹션 클릭 시 스크롤 (보기 모드에서만)
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

    // 🔹 URL 해시(#sec-2-1)가 바뀔 때마다 해당 섹션으로 스크롤 (보기 모드에서만)
    useEffect(() => {
        const { hash } = location;
        if (!hash) return;
        if (isEditing) return;

        const container = viewerContainerRef.current;
        if (!container) return;

        const id = hash.slice(1);
        const el = container.querySelector(`#${id}`);
        if (!el) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        const offset = elRect.top - containerRect.top + container.scrollTop - 8;

        container.scrollTo({
            top: offset,
            behavior: 'smooth',
        });
    }, [location.hash, isEditing, markdownWithAnchors]);

    // 🔹 역링크 계산
    const backlinks = useMemo(() => {
        if (!doc || !Array.isArray(allDocs)) return [];
        const currentDocId = doc.id;
        if (currentDocId == null) return [];

        const result = [];

        for (const other of allDocs) {
            if (!other || other.id === currentDocId) continue;

            const raw = other.content_markdown || '';
            if (!raw) continue;

            const normalized = raw
                .replace(/\\\[/g, '[')
                .replace(/\\\]/g, ']')
                .replace(/\\#/g, '#')
                .replace(/\\\|/g, '|')
                .replace(/\\\./g, '.');

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
                    const inner = m[1];

                    const parsed = parseInternalLinkInner(inner);
                    if (!parsed) continue;
                    if (parsed.docId !== currentDocId) continue;

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

    const handleSave = async (e) => {
        e.preventDefault();
        if (!doc) return;
        if (!canEdit) {
            showSnackbar('이 문서는 보기만 가능합니다.');
            return;
        }

        try {
            await updateSectionLinksForDocument({
                documentId: doc.id,
                oldMarkdown: doc.content_markdown || '',
                newMarkdown: content || '',
            });

            updateMutation.mutate(
                {
                    title: doc.title,
                    contentMarkdown: content,
                    visibility,
                    categoryId,
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
        } catch (err) {
            console.error(err);
            showSnackbar('링크 업데이트 중 오류가 발생했어. 나중에 다시 시도해줘.');
        }
    };

    const handleChangeCategory = (e) => {
        const value = e.target.value;
        const newCatId = value === '' ? null : Number(value);
        setCategoryId(newCatId);
    };

    const handleClickTitleArea = () => {
        setIsEditing(false);
    };

    if (isLoading || !doc) {
        return (
            <div className="text-sm text-slate-500">
                {isLoading ? '문서를 불러오는 중...' : '문서를 찾을 수 없습니다.'}
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col space-y-2 lg:space-y-[10px]">
            {/* 🔹 상단 바: (데스크톱에서만) 섹션 패널 폭만큼 띄우고 오른쪽에 제목/버튼 배치 */}
            <div className="grid gap-3 lg:grid-cols-[190px,minmax(0,1fr)] xl:grid-cols-[230px,minmax(0,1fr)]">
                {/* 섹션 패널 자리만 확보하는 빈 칸 – lg 이상에서만 필요 */}
                <div className="hidden lg:block" />

                <form onSubmit={handleSave} className="flex flex-col gap-2">
                    <div
                        className={`flex flex-col gap-2 sm:flex-row sm:items-center ${
                            !isEditing ? 'cursor-pointer' : ''
                        }`}
                        onClick={!isEditing ? handleClickTitleArea : undefined}
                    >
                        {/* 왼쪽 영역 */}
                        <div className="flex-1">
                            {/* 🔹 편집 모드에서 보이는 카테고리 말머리 */}
                            {isOwner && isEditing && (
                                <div className="mb flex flex-wrap items-center gap-2 text-[10pt] pl-[10px]">
                                    <span className="text-slate-400">카테고리</span>
                                    <select
                                        className="rounded-full border border-slate-200 bg-white px-2 py-[3px] text-[10pt] outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                                        value={categoryId ?? ''}
                                        onChange={handleChangeCategory}
                                        disabled={updateMutation.isLoading}
                                    >
                                        <option value="">미분류</option>
                                        {categories
                                            ?.filter((c) => c.user_id === user?.id && !c.deleted_at)
                                            .map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {/* 보기 모드: 제목 + 공개범위 뱃지 */}
                            {!isEditing && (
                                <div className="flex flex-wrap items-baseline gap-2">
                                    <h1 className="text-xl lg:text-[20px] xl:text-2xl font-semibold italic tracking-tight text-slate-900">
                                        {doc.title}
                                    </h1>

                                    {isOwner && (
                                        <span
                                            className={
                                                'inline-flex items-center rounded-full px-2 py-[2px] text-[11px] ' +
                                                (visibility === 'friends'
                                                    ? 'bg-fuchsia-50 text-fuchsia-700'
                                                    : 'bg-slate-100 text-slate-500')
                                            }
                                        >
                      {visibility === 'friends' ? '친구 공개' : '나만 보기'}
                    </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 오른쪽 컨트롤 묶음 – 모바일에서 한 줄에 정렬 */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* 편집 중일 때만 공개 범위 토글 */}
                            {canEdit && isEditing && (
                                <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-[10px] lg:text-[11px]">
      <span className="ml-2 mr-1 hidden text-slate-500 sm:inline">
        공개 범위
      </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setVisibility('private');
                                        }}
                                        className={
                                            'rounded-full px-2.5 lg:px-3 py-1 ' +
                                            (visibility === 'private'
                                                ? 'bg-white text-slate-900 shadow'
                                                : 'text-slate-500 hover:text-slate-700')
                                        }
                                    >
                                        나만 보기
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setVisibility('friends');
                                        }}
                                        className={
                                            'rounded-full px-2.5 lg:px-3 py-1 ' +
                                            (visibility === 'friends'
                                                ? 'bg-white text-slate-900 shadow'
                                                : 'text-slate-500 hover:text-slate-700')
                                        }
                                    >
                                        친구 공개
                                    </button>
                                </div>
                            )}

                            {/* 보기 / 편집 탭 */}
                            {isOwner && (
                                <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-[10px] lg:text-[11px] whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditing(false);
                                        }}
                                        className={
                                            'rounded-full px-2.5 lg:px-3 py-1 transition ' +
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsEditing(true);
                                            }}
                                            className={
                                                'rounded-full px-2.5 lg:px-3 py-1 transition ' +
                                                (isEditing
                                                    ? 'bg-white text-slate-900 shadow'
                                                    : 'text-slate-500 hover:text-slate-700')
                                            }
                                        >
                                            편집
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* 저장 버튼 – 모바일에서도 보기/편집과 같은 줄에 */}
                            {canEdit && isEditing && (
                                <Button
                                    type="submit"
                                    className="
                                        !h-8 !px-3 !text-xs !w-auto         /* 모바일용 – 작게 */
                                        sm:!h-9 sm:!text-[11px] sm:w-20    /* 태블릿 이상은 기존 느낌 */
                                        lg:w-24
                                      "
                                    disabled={updateMutation.isLoading}
                                >
                                    {updateMutation.isLoading ? '저장 중...' : '저장'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {/* 섹션 트리 + 내용 영역 */}
            <div
                className="flex-1 min-h-0 grid auto-rows-[minmax(0,1fr)] gap-3
           md:grid-cols-[160px,minmax(0,1fr)]
           lg:grid-cols-[190px,minmax(0,1fr)]
           xl:grid-cols-[230px,minmax(0,1fr)]"
            >
                {/* 섹션 트리 패널 */}
                <aside
                    className="hidden md:block h-full overflow-y-auto rounded-2xl bg-white
             p-2 text-[10px] shadow-soft
             lg:p-2.5 xl:p-3"
                >
                    <h2 className="mb-2 text-[10px] font-semibold text-slate-500">
                        섹션
                    </h2>

                    {headings.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                            에디터에서 제목(Heading)을 추가하면
                            <br />
                            여기에서 섹션 트리를 볼 수 있어.
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {headings.map((h) => (
                                <li key={h.id}>
                                    <button
                                        type="button"
                                        onClick={() => !isEditing && handleClickHeading(h.id)}
                                        className="w-full text-left text-[12px] text-slate-700 hover:text-primary-600"
                                        style={{ paddingLeft: (h.level - 1) * 12 }}
                                    >
                    <span className="mr-1 text-[11px] text-slate-400">
                      {h.number}.
                    </span>
                                        {h.text}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                {/* 메인 내용 카드 – 보기/편집 공통 레이아웃 */}
                <div className="wiki-doc-main-card h-full rounded-2xl bg-white shadow-soft overflow-x-hidden">
                    {isEditing ? (
                        // 🔹 편집 모드: 에디터는 내용만, 스크롤은 카드가 담당
                        <div className="h-full w-full overflow-y-auto p-3 lg:p-4 box-border">
                            <MarkdownEditor
                                value={content}
                                onChange={setContent}
                                allDocs={allDocs || []}
                            />
                        </div>
                    ) : (
                        // 🔹 보기 모드: Viewer도 같은 카드 안에서 스크롤
                        <div
                            ref={viewerContainerRef}
                            className="tui-viewer-wrapper h-full overflow-y-auto p-3 lg:p-4"
                        >
                            <Viewer
                                key={markdownWithAnchors}
                                initialValue={markdownWithAnchors}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* 🔹 역링크 패널 – 보기 모드에서만 */}
            {!isEditing && (
                <div className="rounded-2xl bg-white p-2.5 lg:p-3 shadow-soft text-xs">
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
