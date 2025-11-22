// src/features/wiki/CategoryPage.jsx
import { useState } from 'react';
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

    const currentCategory =
        categoryId === 'all'
            ? null
            : categories?.find((c) => String(c.id) === String(categoryId));

    const isMyCategory =
        categoryId === 'all' ||
        (currentCategory && currentCategory.user_id === user.id);

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
        <div className="space-y-4">
            {/* 헤더 */}
            <SectionHeader
                title={currentCategory ? currentCategory.name : '카테고리'}
                subtitle="이 카테고리 안의 문서를 관리해 보자."
            />

            {/* 문서 추가 폼 */}
            {isMyCategory && (
                <form
                    onSubmit={handleCreateDocument}
                    className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-soft sm:flex-row"
                >
                    <div className="flex-1 space-y-2">
                        <Input
                            placeholder="새 문서 제목"
                            className="h-8"
                            value={newDocTitle}
                            onChange={(e) => setNewDocTitle(e.target.value)}
                        />
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                            <span className="text-[11px] text-slate-500">
                                공개 범위
                            </span>
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
                    </div>

                    <Button
                        type="submit"
                        className="shrink-0 sm:w-32 h-8"
                        disabled={createDocumentMutation.isLoading}
                    >
                        {createDocumentMutation.isLoading ? '생성 중...' : '문서 추가'}
                    </Button>
                </form>
            )}

            {/* 문서 목록 */}
            <div className="rounded-2xl bg-white p-4 shadow-soft">
                {isLoading ? (
                    <p className="text-sm text-slate-500">문서를 불러오는 중...</p>
                ) : !documents || documents.length === 0 ? (
                    <EmptyState
                        icon="docs"
                        title="아직 이 카테고리에 문서가 없어."
                        description={
                            '위의 입력창에서 새 문서를 추가하고\n이 카테고리에 차곡차곡 정리해 보자.'
                        }
                    />
                ) : (
                    <ul className="space-y-2">
                        {documents.map((doc) => {
                            const isOwner = doc.user_id === user?.id;

                            return (
                                <li
                                    key={doc.id}
                                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-primary-50"
                                >
                                    <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-2">
                                            {/* 제목 */}
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
                                                {doc.visibility === 'friends'
                                                    ? '친구 공개'
                                                    : '나만 보기'}
                                            </span>
                                        </div>

                                        <span className="mt-0.5 text-[11px] text-slate-400">
                                            작성:{' '}
                                            {new Date(
                                                doc.created_at,
                                            ).toLocaleString()}{' '}
                                            · 수정:{' '}
                                            {new Date(
                                                doc.updated_at,
                                            ).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="ml-3 flex items-center gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate(
                                                    `/wiki/${doc.slug}?mode=edit`,
                                                )
                                            }
                                            className="text-slate-400 hover:text-slate-700"
                                        >
                                            편집
                                        </button>
                                        {isOwner && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setDocToDelete(doc)
                                                }
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
            </div>

            {/* 삭제 확인 다이얼로그 */}
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
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
