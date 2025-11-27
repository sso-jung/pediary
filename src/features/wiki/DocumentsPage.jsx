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
import { useDocumentFavorites, useToggleFavoriteDocument } from './hooks/useDocumentFavorites';
import { sortAndFilterDocuments } from './utils/documentListUtils';

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

    const [query, setQuery] = useState({
        searchText: '',
        sortBy: 'updated_at',
        sortDir: 'desc',
        onlyFavorites: false,
        favoriteFirst: true,
    });

    const favoriteIdSet = useMemo(
        () => new Set((favorites || []).map((f) => f.document_id)),
        [favorites],
    );

    const sortedDocs = useMemo(
        () => sortAndFilterDocuments(docs || [], query, favoriteIdSet),
        [docs, query, favoriteIdSet],
    );

    const getCategoryName = (categoryId) => {
        if (!categoryId || !categories) return '미분류';
        const found = categories.find((c) => c.id === categoryId);
        return found ? found.name : '미분류';
    };

    return (
        <div className="h-full overflow-y-auto rounded-2xl bg-white p-4 shadow-soft">
            <SectionHeader
                title="전체 문서"
                subtitle="카테고리와 상관없이, 내가 볼 수 있는 문서를 모두 모아 볼 수 있어."
            />

            {/* 🔹 조회조건 바 */}
            <div className="mt-4 mb-4">
                <DocumentFilterBar value={query} onChange={setQuery} />
            </div>

            {isLoading ? (
                <p className="mt-6 text-sm text-slate-500">문서를 불러오는 중...</p>
            ) : !sortedDocs || sortedDocs.length === 0 ? (
                <EmptyState
                    icon="docs"
                    title="아직 볼 수 있는 문서가 없어."
                    description={
                        '왼쪽 사이드바에서 카테고리를 만들고\n그 안에 첫 문서를 추가해 볼까?'
                    }
                />
            ) : (
                <ul className="space-y-2">
                    {sortedDocs.map((doc) => {
                        const isOwner = doc.user_id === user?.id;
                        const categoryName = getCategoryName(doc.category_id);
                        const isFavorite = favoriteIdSet.has(doc.id);

                        return (
                            <li
                                key={doc.id}
                                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-primary-50"
                            >
                                <div className="flex flex-1 items-start gap-2">
                                    {/* 🔹 즐겨찾기 버튼 */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            toggleFavoriteMutation.mutate({
                                                documentId: doc.id,
                                                isFavorite,
                                            })
                                        }
                                        className={
                                            'mt-[1px] text-lg leading-none ' +
                                            (isFavorite
                                                ? 'text-amber-400'
                                                : 'text-slate-300 hover:text-slate-500')
                                        }
                                        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                    >
                                        {isFavorite ? '★' : '☆'}
                                    </button>

                                    <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-2">
                                            {/* 카테고리 | 제목 */}
                                            <span className="text-[12px] text-slate-400">
                      {categoryName} |
                    </span>
                                            <Link
                                                to={`/wiki/${doc.slug}`}
                                                className="font-medium text-slate-800 hover:text-primary-600"
                                            >
                                                {doc.title}
                                            </Link>

                                            {/* 공개 범위 뱃지 */}
                                            <span
                                                className={
                                                    'inline-flex items-center rounded-full px-2 py-[2px] text-[10px] ' +
                                                    (doc.visibility === 'friends'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-slate-100 text-slate-500')
                                                }
                                            >
                      {doc.visibility === 'friends' ? '친구 공개' : '나만 보기'}
                    </span>
                                        </div>

                                        <span className="mt-0.5 text-[11px] text-slate-400">
                    작성:{' '}
                                            {new Date(doc.created_at).toLocaleString()}{' '}
                                            · 수정:{' '}
                                            {new Date(doc.updated_at).toLocaleString()}
                  </span>
                                    </div>
                                </div>

                                <div className="ml-3 flex items-center gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(`/wiki/${doc.slug}?mode=edit`)
                                        }
                                        className="text-slate-400 hover:text-slate-700"
                                    >
                                        편집
                                    </button>
                                    {isOwner && (
                                        <button
                                            type="button"
                                            onClick={() => setDocToDelete(doc)}
                                            className="text-rose-400 hover:text-rose-700"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ConfirmDialog
                open={!!docToDelete}
                title="문서를 삭제할까?"
                message={
                    docToDelete
                        ? `"${docToDelete.title}" 문서를 삭제할까?\n삭제한 문서는 휴지통으로 들어가.`
                        : ''
                }
                confirmText={
                    deleteDocumentMutation.isLoading ? '삭제 중...' : '삭제할래'
                }
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
                                showSnackbar(
                                    '삭제에 실패했어. 잠시 후 다시 시도해줘.',
                                );
                            },
                        },
                    );
                }}
            />
        </div>
    );
}
