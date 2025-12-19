// src/features/wiki/CategoryPage.jsx
import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useCategories } from './hooks/useCategories';
import { useDocuments } from './hooks/useDocuments';
import { useCreateDocument } from './hooks/useCreateDocument';
import { useDeleteDocument } from './hooks/useDeleteDocument';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import DocumentFilterBar from './DocumentFilterBar';
import { useDocumentFavorites, useToggleFavoriteDocument } from './hooks/useDocumentFavorites';
import { sortAndFilterDocuments } from './utils/documentListUtils';

export default function CategoryPage() {
    const navigate = useNavigate();

    const { categoryId } = useParams();
    const numericCategoryId = Number(categoryId);

    const user = useAuthStore((s) => s.user);
    const { showSnackbar } = useSnackbar();

    const { data: categories } = useCategories();
    const { data: documents, isLoading } = useDocuments(numericCategoryId);

    const createDocumentMutation = useCreateDocument(numericCategoryId);
    const deleteDocumentMutation = useDeleteDocument();

    const [newDocTitle, setNewDocTitle] = useState('');
    const [newVisibility, setNewVisibility] = useState('private');
    const [docToDelete, setDocToDelete] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
        () => sortAndFilterDocuments(documents || [], query, favoriteIdSet),
        [documents, query, favoriteIdSet],
    );

    const currentCategory =
        categoryId === 'all'
            ? null
            : categories?.find((c) => String(c.id) === String(categoryId));

    const isMyCategory =
        categoryId === 'all' || (currentCategory && currentCategory.user_id === user?.id);

    const handleCreateDocument = (e) => {
        e.preventDefault();
        const title = newDocTitle.trim();
        if (!title) return;

        createDocumentMutation.mutate(
            { title, visibility: newVisibility },
            {
                onSuccess: (newDoc) => {
                    setNewDocTitle('');
                    setNewVisibility('private');
                    setIsCreateModalOpen(false);
                    navigate(`/wiki/${newDoc.slug}`);
                },
            },
        );
    };

    const handleConfirmDelete = () => {
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
    };

    return (
        <div className="h-full overflow-y-auto rounded-2xl p-3 sm:p-4 shadow-soft ui-surface border border-border-subtle">
            <SectionHeader
                title={currentCategory ? currentCategory.name : '카테고리'}
                subtitle="이 카테고리 안의 문서를 관리해 보자."
            />

            <div className="mt-3 mb-3 sm:mt-4 sm:mb-4">
                <DocumentFilterBar value={query} onChange={setQuery} />
            </div>

            {/* 상단: 개수 + 문서 추가 */}
            <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] ui-doc-meta">
          총 {sortedDocs ? sortedDocs.length : 0}개 문서
        </span>

                {isMyCategory && (
                    <Button
                        type="button"
                        className="h-8 px-4 text-sm"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        문서 추가
                    </Button>
                )}
            </div>

            {isLoading ? (
                <p className="mt-6 text-sm page-text-muted">문서를 불러오는 중...</p>
            ) : !sortedDocs || sortedDocs.length === 0 ? (
                <EmptyState
                    icon="docs"
                    title="아직 이 카테고리에 문서가 없어."
                    description={'오른쪽 위의 "문서 추가" 버튼을 눌러서\n첫 문서를 만들어 보자.'}
                />
            ) : (
                <ul className="space-y-2">
                    {sortedDocs.map((doc) => {
                        const isOwner = doc.user_id === user?.id;
                        const isFavorite = favoriteIdSet.has(doc.id);

                        return (
                            <li
                                key={doc.id}
                                className="
                  ui-doc-item
                  flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between
                  rounded-xl px-3 py-2 text-xs sm:text-sm
                "
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
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
                                <div className="flex flex-1 items-start gap-2">
                                    {/* 즐겨찾기 */}
                                    <button
                                        data-stop-nav="true"
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleFavoriteMutation.mutate({ documentId: doc.id, isFavorite });
                                        }}
                                        className={
                                            'mt-[1px] text-lg leading-none ui-fav ' +
                                            (isFavorite ? 'ui-fav-on' : 'ui-fav-off')
                                        }
                                        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                    >
                                        {isFavorite ? '★' : '☆'}
                                    </button>

                                    <div className="flex flex-col flex-1">
                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                            <Link to={`/wiki/${doc.slug}`} className="font-medium ui-doc-title">
                                                {doc.title}
                                            </Link>

                                            {/* 공개 범위 뱃지 */}
                                            <span
                                                className={
                                                    'inline-flex items-center rounded-full px-[4px] text-[9px] sm:px-[4px] sm:text-[9px] ' +
                                                    (doc.visibility === 'friends'
                                                        ? 'ui-badge-friends'
                                                        : 'ui-badge-private')
                                                }
                                            >
                        {doc.visibility === 'friends' ? '친구 공개' : '나만 보기'}
                      </span>
                                        </div>

                                        <span className="mt-0.5 text-[10px] sm:text-[11px] ui-doc-meta">
                      작성: {new Date(doc.created_at).toLocaleString()} · 수정:{' '}
                                            {new Date(doc.updated_at).toLocaleString()}
                    </span>
                                    </div>
                                </div>

                                {/* 우측 액션 */}
                                <div className="mt-1 flex items-center justify-end gap-2 text-[11px] sm:mt-0 sm:ml-3 sm:text-xs">
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
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDocToDelete(doc);
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
            )}

            {/* 새 문서 추가 모달 */}
            {isMyCategory && isCreateModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center ui-modal-backdrop">
                    <div className="ui-modal w-full max-w-md rounded-2xl p-5">
                        <h2 className="mb-3 text-sm font-semibold ui-page-title">새 문서 추가</h2>

                        <form onSubmit={handleCreateDocument} className="space-y-3">
                            <Input
                                placeholder="새 문서 제목"
                                className="h-9 text-sm"
                                value={newDocTitle}
                                onChange={(e) => setNewDocTitle(e.target.value)}
                                autoFocus
                            />

                            <div className="flex flex-wrap items-center gap-3 text-[11px] ui-doc-meta">
                                <span className="text-[11px] ui-doc-meta">공개 범위</span>

                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        className="h-3 w-3"
                                        value="private"
                                        checked={newVisibility === 'private'}
                                        onChange={() => setNewVisibility('private')}
                                    />
                                    <span>나만 보기</span>
                                </label>

                                <label className="inline-flex items-center gap-1">
                                    <input
                                        type="radio"
                                        className="h-3 w-3"
                                        value="friends"
                                        checked={newVisibility === 'friends'}
                                        onChange={() => setNewVisibility('friends')}
                                    />
                                    <span>친구 공개</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <Button
                                    type="button"
                                    className="h-8 px-3 text-sm btn-ghost"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    disabled={createDocumentMutation.isLoading}
                                >
                                    취소
                                </Button>

                                <Button
                                    type="submit"
                                    className="h-8 px-4 text-sm"
                                    disabled={createDocumentMutation.isLoading}
                                >
                                    {createDocumentMutation.isLoading ? '생성 중...' : '추가'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 삭제 확인 다이얼로그 */}
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
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
