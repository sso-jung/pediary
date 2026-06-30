// src/features/wiki/DocumentsPage.jsx
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVisibleDocuments } from './hooks/useVisibleDocuments';
import { useCategories } from './hooks/useCategories';
import { useDeleteDocument } from './hooks/useDeleteDocument';
import { useAuthStore } from '../../store/authStore';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import DocumentFilterBar from './DocumentFilterBar';
import DocumentPagination from './DocumentPagination';
import { useDocumentFavorites, useToggleFavoriteDocument } from './hooks/useDocumentFavorites';
import { getCategoryPath, sortAndFilterDocuments } from './utils/documentListUtils';
import { useDocumentListQuery } from './hooks/useDocumentListQuery';
import { useDocumentListScroll } from './hooks/useDocumentListScroll';

export default function DocumentsPage() {
    const { data: docs, isLoading } = useVisibleDocuments();
    const { data: categories } = useCategories();
    const navigate = useNavigate();

    const user = useAuthStore((s) => s.user);
    const deleteDocumentMutation = useDeleteDocument();
    const { showSnackbar } = useSnackbar();
    const [docToDelete, setDocToDelete] = useState(null);

    const { data: favorites } = useDocumentFavorites();
    const toggleFavoriteMutation = useToggleFavoriteDocument();

    const [query, setQuery] = useDocumentListQuery('all');

    const favoriteIdSet = useMemo(
        () => new Set((favorites || []).map((f) => f.document_id)),
        [favorites],
    );

    const sortedDocs = useMemo(
        () => sortAndFilterDocuments(docs || [], query, favoriteIdSet),
        [docs, query, favoriteIdSet],
    );

    const pageSize = query.pageSize || 10;
    const pageCount = Math.max(1, Math.ceil(sortedDocs.length / pageSize));
    const currentPage = Math.min(Math.max(1, query.page || 1), pageCount);
    const pagedDocs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedDocs.slice(start, start + pageSize);
    }, [sortedDocs, currentPage, pageSize]);
    const scrollRef = useDocumentListScroll('all', !isLoading, `${currentPage}.${pagedDocs.length}`);

    return (
        <div ref={scrollRef} className="h-full overflow-y-auto rounded-2xl p-3 sm:p-3.5 shadow-soft ui-surface border border-border-subtle">
            <SectionHeader
                title="전체 문서"
                subtitle=""
            />

            <div className="mt-2.5 mb-[18px] sm:mt-3.5 sm:mb-5">
                <DocumentFilterBar value={query} onChange={setQuery} />
            </div>

            {isLoading ? (
                <p className="mt-6 text-sm page-text-muted">문서를 불러오는 중...</p>
            ) : !sortedDocs || sortedDocs.length === 0 ? (
                <EmptyState
                    icon="docs"
                    title="아직 볼 수 있는 문서가 없어."
                    description={'왼쪽 사이드바에서 카테고리를 만들고\n그 안에 첫 문서를 추가해 볼까?'}
                />
            ) : (
                <>
                <ul className="space-y-[7px]">
                    {pagedDocs.map((doc) => {
                        const isOwner = doc.user_id === user?.id;
                        const categoryPath = getCategoryPath(doc.category_id, categories);
                        const isFavorite = favoriteIdSet.has(doc.id);

                        return (
                            <li
                                key={doc.id}
                                className="
                                    ui-doc-item
                                    grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-row sm:items-center sm:justify-between
                                    rounded-xl px-3 py-1.5 text-xs sm:text-sm
                                  "
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    // 액션 영역에서 클릭하면 이동 금지
                                    if (e.defaultPrevented) return;
                                    if (e.target.closest('a, button')) return;
                                    if (e.target.closest('[data-stop-nav="true"]')) return;

                                    navigate(`/wiki/${doc.slug}`);
                                }}
                                onKeyDown={(e) => {
                                    if (e.target.closest('[data-stop-nav="true"]')) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        navigate(`/wiki/${doc.slug}`);
                                    }
                                }}
                            >
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                    {/* 즐겨찾기 */}
                                    <button
                                        data-stop-nav="true"
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleFavoriteMutation.mutate({documentId: doc.id, isFavorite})
                                        }}
                                        className={'mt-[1px] text-lg leading-none ui-fav ' + (isFavorite ? 'ui-fav-on' : 'ui-fav-off')}
                                        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                    >
                                        {isFavorite ? '★' : '☆'}
                                    </button>

                                    <div className="flex min-w-0 flex-col flex-1">
                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span className="text-[11px] sm:text-[12px] ui-doc-meta">
                        {categoryPath} |
                      </span>

                                            <Link to={`/wiki/${doc.slug}`} className="font-medium ui-doc-title">
                                                {doc.title}
                                            </Link>

                                            {/* 공개 범위 뱃지 */}
                                            <span
                                                className={
                                                    'inline-flex items-center rounded-full px-[4px] text-[9px] sm:px-[4px] sm:text-[9px] ' +
                                                    (doc.visibility === 'friends' ? 'ui-badge-friends' : 'ui-badge-private')
                                                }
                                            >
                        {doc.visibility === 'friends' ? '친구 공개' : '나만 보기'}
                      </span>
                                        </div>

                                        <span className="mt-0.5 text-[10px] sm:text-[11px] ui-doc-meta">
                      <span className="sm:hidden">작성: {new Date(doc.created_at).toLocaleString()}</span>
                      <span className="hidden sm:inline">작성: {new Date(doc.created_at).toLocaleString()} · 수정: {new Date(doc.updated_at).toLocaleString()}</span>
                    </span>
                                    </div>
                                </div>

                                <div
                                    className="flex shrink-0 flex-col items-end justify-center gap-1 text-[11px] sm:mt-0 sm:ml-3 sm:flex-row sm:items-center sm:gap-2 sm:text-xs">
                                    <button
                                        data-stop-nav="true"
                                        type="button"
                                        onClick={(e) => {
                                               e.preventDefault();
                                               e.stopPropagation();
                                               navigate(`/wiki/${doc.slug}?mode=edit`);
                                        }}
                                        className="ui-doc-action"
                                    >
                                        편집
                                    </button>

                                    {isOwner && (
                                        <button
                                            data-stop-nav="true"
                                            type="button"
                                            onClick={(e) =>{
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDocToDelete(doc)
                                            }}
                                            className="ui-doc-action ui-doc-action-danger"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>

                <DocumentPagination
                    totalCount={sortedDocs.length}
                    page={currentPage}
                    pageSize={pageSize}
                    onChange={setQuery}
                />
                </>
            )}

            {/* ConfirmDialog 그대로 */}
            <ConfirmDialog
                open={!!docToDelete}
                title="문서를 삭제할까?"
                message={
                    docToDelete
                        ? `"${docToDelete.title}" 문서를 삭제할까?\n삭제한 문서는 휴지통으로 들어가.`
                        : ''
                }
                confirmText={deleteDocumentMutation.isLoading ? '삭제 중...' : '삭제할래'}
                cancelText="취소"
                onCancel={() => {
                    if (deleteDocumentMutation.isLoading) return;
                    setDocToDelete(null);
                }}
                onConfirm={() => {
                    if (!docToDelete) return;
                    deleteDocumentMutation.mutate(
                        { documentId: docToDelete.id },
                        {
                            onSuccess: () => {
                                setDocToDelete(null);
                                showSnackbar('삭제가 완료됐어.');
                            },
                            onError: () => {
                                setDocToDelete(null);
                                showSnackbar('삭제에 실패했어. 잠시 후 다시 시도해줘.');
                            },
                        },
                    );
                }}
            />
        </div>
    );
}
