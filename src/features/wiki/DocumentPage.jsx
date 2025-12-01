// src/features/wiki/DocumentPage.jsx
import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { Viewer } from '@toast-ui/react-editor';
import 'tui-color-picker/dist/tui-color-picker.css';
import '@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css';

import { useDocument } from './hooks/useDocument';
import { useUpdateDocument } from './hooks/useUpdateDocument';
import { useAllDocuments } from './hooks/useAllDocuments';
import { useCategories } from './hooks/useCategories';

import Button from '../../components/ui/Button';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import { parseInternalLinks } from '../../lib/internalLinkParser';
import { useAuthStore } from '../../store/authStore';
import { logDocumentActivity, updateSectionLinksForDocument } from '../../lib/wikiApi';
import MarkdownEditor from './MarkdownEditor';
import { parseInternalLinkInner } from '../../lib/internalLinkFormat';
import ListIcon from '../../components/icons/ListIcon.jsx'
import { downloadDocumentExcel } from '../../lib/exportMyDocumentsExcel';

// =========================
// 유틸 함수들
// =========================
function stripHeadingText(rawText = '') {
    let s = rawText;
    s = s.replace(/<[^>]*>/g, '');
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
    s = s.replace(/[*_`~]/g, '');
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

    const counters = [0, 0, 0, 0, 0, 0, 0]; // 1~6 레벨 카운터
    const usedIds = new Set();

    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (!match) {
            newLines.push(line);
            continue;
        }

        const hashes = match[1];
        const level = hashes.length;
        const rawText = match[2].trim();
        const plainText = stripHeadingText(rawText);

        if (!plainText) {
            newLines.push(line);
            continue;
        }

        counters[level] += 1;
        for (let i = level + 1; i < counters.length; i++) {
            counters[i] = 0;
        }
        const nums = counters.slice(1, level + 1).filter((n) => n > 0);
        const number = nums.join('.');

        const sectionKey = number.replace(/\./g, '-');
        let id = `sec-${sectionKey}`;

        let suffix = 2;
        while (usedIds.has(id)) {
            id = `sec-${sectionKey}-${suffix}`;
            suffix += 1;
        }
        usedIds.add(id);

        headings.push({ id, level, text: plainText, number });

        newLines.push('');
        newLines.push(`<a id="${id}"></a>`);
        newLines.push(
            `${hashes} <span class="wiki-heading-number">${number}.</span> ${rawText}`,
        );
    }

    return {
        markdownWithAnchors: newLines.join('\n'),
        headings,
    };
}

// 🔹 역링크 계산 로직을 커스텀 훅으로 분리
function useBacklinks(doc, allDocs) {
    return useMemo(() => {
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
}

// =========================
// 서브 컴포넌트들
// =========================

function DocumentHeader({
                            doc,
                            user,
                            isOwner,
                            canEdit,
                            isEditing,
                            visibility,
                            setVisibility,
                            categoryId,
                            setCategoryId,
                            categories,
                            autosaveStatus,
                            updateLoading,
                            onClickTitleArea,
                            onClickView,
                            onClickEdit,
                            onClickGoList,
                            onClickExportExcel,
                            exporting,
                        }) {
    const handleChangeCategory = (e) => {
        const value = e.target.value;
        const newCatId = value === '' ? null : Number(value);
        setCategoryId(newCatId);
    };

    return (
        <div
            className={`flex flex-col gap-2 sm:flex-row sm:items-center ${
                !isEditing ? 'cursor-pointer' : ''
            }`}
            onClick={!isEditing ? onClickTitleArea : undefined}
        >
            {/* 왼쪽 영역 */}
            <div className="flex-1">
                {/* 편집 모드에서 보이는 카테고리 말머리 */}
                {isOwner && isEditing && (
                    <div className="mb flex flex-wrap items-center gap-2 text-[10pt] pl-[10px]">
                        <span className="text-slate-400">카테고리</span>
                        <select
                            className="rounded-full border border-slate-200 bg-white px-2 py-[3px] text-[10pt] outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                            value={categoryId ?? ''}
                            onChange={handleChangeCategory}
                            disabled={updateLoading}
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
                        <h1 className="text-xl lg:text-[20px] xl:text-2xl font-semibold tracking-tight text-slate-900">
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

            {/* 오른쪽 컨트롤 묶음 */}
            <div className="flex items-center gap-1 sm:gap-2">
                {/* 보기 모드 전용: 엑셀 다운로드 */}
                {!isEditing && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClickExportExcel?.();
                        }}
                        disabled={exporting}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-60"
                    >
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 4h16v6H4z" />
                            <path d="M9 4v6" />
                            <path d="M15 4v6" />
                            <path d="M6 14l3 3-3 3" />
                            <path d="M10 20h8" />
                        </svg>
                        <span>{exporting ? '엑셀 생성 중...' : '엑셀다운로드'}</span>
                    </button>
                )}
                {/* 🔹 보기 모드 전용: 목록으로 이동 버튼 (모바일/태블릿 전용) */}
                {!isEditing && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClickGoList?.();
                        }}
                        className="
                          md:hidden
                          inline-flex items-center
                          rounded-md border border-slate-200
                          bg-white px-2.5 py-1
                          text-[10px] md:text-[11px] text-slate-600
                          shadow-sm hover:bg-slate-50
                        "
                    >
                        목록
                    </button>
                )}

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
                                // 보기 모드로 전환은 상위가 state 관리
                                // 여기서는 form submit 아님
                                onClickView?.();
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
                                    // 실제 isEditing 토글은 상위 DocumentPage에서 해줌
                                    // 여기서 직접 set은 안 함
                                    onClickEdit?.();
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

                {/* 자동저장 상태 + 저장 버튼 */}
                {canEdit && isEditing && (
                    <>
                        <span className="text-[10px] text-slate-400 mr-2">
                            {autosaveStatus === 'dirty' && '작성 중…'}
                            {autosaveStatus === 'saving' && '자동 저장 중…'}
                            {autosaveStatus === 'saved' && '저장됨'}
                            {autosaveStatus === 'error' && '자동 저장 실패'}
                        </span>
                        {autosaveStatus === 'saving' && (
                            <span
                                className="
                                  ml-1 inline-block h-[10px] w-[10px]
                                  rounded-full border border-slate-300 border-t-transparent
                                  animate-spin
                                "
                            />
                        )}

                        <button
                            type="submit"
                            className="text-[11px] w-12 px-2.5 lg:px-3 !py-1 bg-[#8498c4] rounded-xl text-white hover:bg-[#687ba6]"
                            disabled={updateLoading}
                        >
                            {updateLoading ? '저장 중...' : '저장'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function SectionSidebar({ headings, isEditing, onClickHeading }) {
    return (
        <aside
            className="hidden md:block h-full overflow-y-auto rounded-2xl bg-white
             p-2 text-[10px] shadow-soft
             basic:p-2.5 xl:p-3"
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
                                // 👉 편집/보기 상관없이 항상 콜백 호출, 대신 heading 객체 전체를 넘김
                                onClick={() => onClickHeading?.(h)}
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
    );
}

function BacklinksPanel({
                            docTitle,
                            backlinks,
                            totalBacklinkCount,
                            showBacklinks,
                            setShowBacklinks,
                        }) {
    return (
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
                            <span className="font-mono">[[{docTitle}]]</span> 형식으로
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
    );
}

// =========================
// 메인 컴포넌트
// =========================

export default function DocumentPage() {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);

    const { data: doc, isLoading } = useDocument(slug);
    const { data: allDocs } = useAllDocuments();
    const updateMutation = useUpdateDocument(doc?.id, slug);
    const { showSnackbar } = useSnackbar();

    const { data: categories } = useCategories();

    const [categoryId, setCategoryId] = useState(null);
    const [content, setContent] = useState('');
    const initialIsEditing = searchParams.get('mode') === 'edit';
    const [isEditing, setIsEditing] = useState(initialIsEditing);
    const [showBacklinks, setShowBacklinks] = useState(false);
    const [visibility, setVisibility] = useState('private');
    const [exporting, setExporting] = useState(false);

    const [autosaveStatus, setAutosaveStatus] = useState('idle');
    const lastSavedRef = useRef({
        content: '',
        visibility: '',
        categoryId: null,
    });

    const isOwner = doc && user && doc.user_id === user.id;
    const canEdit = isOwner;

    const viewLoggedRef = useRef(false);
    const viewerContainerRef = useRef(null);

    const handleGoList = () => {
        if (doc?.category_id) {
            navigate(`/category/${doc.category_id}`);
        } else {
            navigate('/docs');
        }
    };

    const initializedRef = useRef(false);
    const lastUpdateLogRef = useRef({
        time: 0,
        documentId: null,
    });

    // 문서 로딩 / 변경 시 기본 값 세팅
    useEffect(() => {
        if (!doc) return;

        const baseVisibility = doc.visibility || 'private';
        const baseCategoryId = doc.category_id ?? null;
        const baseContent = doc.content_markdown || '';

        // 공통: 항상 최신 카테고리/가시성은 반영
        setCategoryId(baseCategoryId);
        setVisibility(baseVisibility);

        // 1) 첫 초기화 시점: 무조건 문서 내용까지 세팅
        if (!initializedRef.current) {
            setContent(baseContent);
            lastSavedRef.current = {
                content: baseContent,
                visibility: baseVisibility,
                categoryId: baseCategoryId,
            };
            initializedRef.current = true;
            return;
        }

        // 2) 그 이후에는 "편집 중이 아닐 때만" 서버 내용 반영
        if (!isEditing) {
            setContent(baseContent);
            lastSavedRef.current = {
                content: baseContent,
                visibility: baseVisibility,
                categoryId: baseCategoryId,
            };
        }
    }, [doc, isEditing]);

    // 최초 viewed 로그
    useEffect(() => {
        if (!doc || !user || viewLoggedRef.current) return;

        viewLoggedRef.current = true;
        logDocumentActivity({
            userId: user.id,
            documentId: doc.id,
            action: 'viewed',
        });
    }, [doc, user]);

    // 내부 링크 파싱
    let parsedMarkdown = parseInternalLinks(content || '', allDocs);
    const { markdownWithAnchors, headings } = buildSectionTree(parsedMarkdown);

    // 사이드바 섹션 클릭 시 스크롤
    const handleClickHeading = (heading) => {
        if (!heading) return;

        // 🔹 편집 모드일 때: 에디터 쪽으로 스크롤
        if (isEditing) {
            // DOM 렌더 이후에 찾도록
            requestAnimationFrame(() => {
                const editorBody = document.querySelector('.toastui-editor-contents');
                if (!editorBody) return;

                const targetText = (heading.text || '').replace(/\s+/g, ' ').trim();

                const headingEls = editorBody.querySelectorAll('h1, h2, h3, h4, h5, h6');

                const targetEl = Array.from(headingEls).find((el) => {
                    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    return text === targetText;
                });

                if (targetEl && targetEl.scrollIntoView) {
                    targetEl.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    });
                }
            });
            return;
        }

        // 🔹 보기 모드일 때: 기존 Viewer 컨테이너 스크롤
        const container = viewerContainerRef.current;
        if (!container) return;

        const el = container.querySelector(`#${heading.id}`);
        if (!el) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        const offset = elRect.top - containerRect.top + container.scrollTop - 8;

        container.scrollTo({
            top: offset,
            behavior: 'smooth',
        });
    };

    // URL 해시 → 해당 섹션으로 스크롤
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

    // 역링크 훅 사용
    const backlinks = useBacklinks(doc, allDocs);
    const totalBacklinkCount = useMemo(
        () => backlinks.reduce((sum, b) => sum + b.links.length, 0),
        [backlinks],
    );

    const AUTO_LOG_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5분

    const saveDocument = async ({ isAuto = false } = {}) => {
      if (!doc) return;

      try {
        await updateSectionLinksForDocument({
          documentId: doc.id,
          oldMarkdown: doc.content_markdown || '',
          newMarkdown: content || '',
        });

        await new Promise((resolve, reject) => {
          updateMutation.mutate(
            {
              title: doc.title,
              contentMarkdown: content,
              visibility,
              categoryId,
            },
            {
              onSuccess: () => resolve(),
              onError: () => reject(),
            },
          );
        });

        // ✅ 마지막 저장 스냅샷 업데이트
        lastSavedRef.current = {
          content,
          visibility,
          categoryId,
        };

        // ✅ 여기서 updated 활동 로그 찍기 (자동/수동 분리)
        if (user) {
          const now = Date.now();
          const last = lastUpdateLogRef.current;

          if (!isAuto) {
            // 👉 수동 저장은 무조건 로그 남김
            logDocumentActivity({
              userId: user.id,
              documentId: doc.id,
              action: 'updated',
            });
            lastUpdateLogRef.current = {
              time: now,
              documentId: doc.id,
            };
          } else {
            // 👉 자동 저장은 5분에 1번만 로그 남김
            const sameDoc = last.documentId === doc.id;
            const tooOld = !last.time || now - last.time > AUTO_LOG_MIN_INTERVAL_MS;

            if (!sameDoc || tooOld) {
              logDocumentActivity({
                userId: user.id,
                documentId: doc.id,
                action: 'updated',
              });
              lastUpdateLogRef.current = {
                time: now,
                documentId: doc.id,
              };
            }
          }
        }

        if (isAuto) {
          setAutosaveStatus('saved');
        } else {
          showSnackbar('저장 완료!');
          setIsEditing(false);
        }
      } catch (err) {
        console.error(err);

        if (isAuto) {
          setAutosaveStatus('error');
        } else {
          showSnackbar('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
      }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!canEdit) {
            showSnackbar('이 문서는 보기만 가능합니다.');
            return;
        }
        saveDocument({ isAuto: false });
    };

    const handleExportExcel = async () => {
        if (!doc) return;
        if (exporting) return;

        try {
            setExporting(true);
            await downloadDocumentExcel(doc);
        } catch (err) {
            console.error(err);
            showSnackbar('엑셀 다운로드 중 오류가 발생했어.');
        } finally {
            setExporting(false);
        }
    };

    const handleClickTitleArea = () => {
        setIsEditing(false);
    };

    // 🔹 자동저장 디바운스 (Hook은 항상 top-level, 조건은 내부에서)
    useEffect(() => {
        if (!isEditing) return;
        if (!doc) return;

        const hasChanged =
            content !== lastSavedRef.current.content ||
            visibility !== lastSavedRef.current.visibility ||
            categoryId !== lastSavedRef.current.categoryId;

        if (!hasChanged) return;

        const isEmptyDraft =
            !content || content.trim() === '';

        const wasEmptyBefore =
            !lastSavedRef.current.content ||
            lastSavedRef.current.content.trim() === '';

        // 🔹 이전 저장본은 내용이 있었는데, 지금은 완전 비어 있으면 → 자동저장 스킵
        if (isEmptyDraft && !wasEmptyBefore) {
            setAutosaveStatus('idle');
            return;
        }

        setAutosaveStatus('dirty');

        const timer = setTimeout(() => {
            setAutosaveStatus('saving');
            saveDocument({ isAuto: true });
        }, 1000);

        return () => clearTimeout(timer);
    }, [content, visibility, categoryId, isEditing, doc]);

    if (isLoading || !doc) {
        return (
            <div className="text-sm text-slate-500">
                {isLoading ? '문서를 불러오는 중...' : '문서를 찾을 수 없습니다.'}
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col space-y-2 lg:space-y-[10px]">
            {/* 상단 바 */}
            <div className="grid gap-3 md:grid-cols-[200px,minmax(0,1fr)] basic:grid-cols-[210px,minmax(0,1fr)]
                                       lg:grid-cols-[220px,minmax(0,1fr)] xl:grid-cols-[240px,minmax(0,1fr)]">
                {/* 🔹 데스크탑 전용 왼쪽 영역: 목록 버튼 */}
                <div className="hidden md:flex items-end">
                    <button
                        type="button"
                        onClick={handleGoList}
                        className="inline-flex items-center text-center
                                   rounded-md border border-slate-200
                                   bg-white px-2 py-[5px]
                                   text-[11px] text-slate-600
                                   shadow-sm hover:bg-slate-50"
                    >
                        <ListIcon />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-2">
                    <DocumentHeader
                        doc={doc}
                        user={user}
                        isOwner={isOwner}
                        canEdit={canEdit}
                        isEditing={isEditing}
                        visibility={visibility}
                        setVisibility={setVisibility}
                        categoryId={categoryId}
                        setCategoryId={setCategoryId}
                        categories={categories}
                        autosaveStatus={autosaveStatus}
                        updateLoading={updateMutation.isLoading}
                        onClickTitleArea={handleClickTitleArea}
                        onClickView={() => setIsEditing(false)}
                        onClickEdit={() => canEdit && setIsEditing(true)}
                        onClickGoList={handleGoList}
                        onClickExportExcel={handleExportExcel}
                        exporting={exporting}
                    />
                </form>
            </div>

            {/* 섹션 트리 + 내용 영역 */}
            <div
                className="flex-1 min-h-0 grid auto-rows-[minmax(0,1fr)] gap-3
           md:grid-cols-[190px,minmax(0,1fr)]
           basic:grid-cols-[200px,minmax(0,1fr)]
           lg:grid-cols-[210px,minmax(0,1fr)]
           xl:grid-cols-[230px,minmax(0,1fr)]"
            >
                <SectionSidebar
                    headings={headings}
                    isEditing={isEditing}
                    onClickHeading={handleClickHeading}
                />

                <div className="wiki-doc-main-card h-full rounded-2xl bg-white shadow-soft overflow-x-hidden">
                    {isEditing ? (
                        <div className="h-full w-full p-3 lg:p-4 box-border">
                            <div className="h-full">
                                <MarkdownEditor
                                    value={content}
                                    onChange={setContent}
                                    allDocs={allDocs || []}
                                    fullHeight
                                />
                            </div>
                        </div>
                    ) : (
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

            {/* 역링크 패널 */}
            {!isEditing && (
                <BacklinksPanel
                    docTitle={doc.title}
                    backlinks={backlinks}
                    totalBacklinkCount={totalBacklinkCount}
                    showBacklinks={showBacklinks}
                    setShowBacklinks={setShowBacklinks}
                />
            )}
        </div>
    );
}
