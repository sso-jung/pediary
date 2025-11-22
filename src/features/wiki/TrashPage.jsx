// src/features/wiki/TrashPage.jsx
import { useState } from 'react';
import { useDeletedDocuments } from './hooks/useDeletedDocuments';
import { useHardDeleteDocument } from './hooks/useHardDeleteDocument';
import { useRestoreDocument } from './hooks/useRestoreDocument';
import { useCategories } from './hooks/useCategories';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';

export default function TrashPage() {
    const { data: deletedDocs, isLoading } = useDeletedDocuments();
    const { data: categories } = useCategories();
    const hardDeleteMutation = useHardDeleteDocument();
    const restoreMutation = useRestoreDocument();
    const { showSnackbar } = useSnackbar();

    const [docToHardDelete, setDocToHardDelete] = useState(null);

    const getCategoryName = (categoryId) => {
        if (!categoryId || !categories) return '미분류';
        const found = categories.find((c) => c.id === categoryId);
        return found ? found.name : '미분류';
    };

    const handleConfirmHardDelete = () => {
        if (!docToHardDelete) return;

        hardDeleteMutation.mutate(
            { documentId: docToHardDelete.id },
            {
                onSuccess: () => {
                    showSnackbar('문서를 완전히 삭제했어.');
                    setDocToHardDelete(null);
                },
                onError: () => {
                    showSnackbar('완전 삭제에 실패했어. 잠시 후 다시 시도해줘.');
                    setDocToHardDelete(null);
                },
            },
        );
    };

    const handleRestore = (doc) => {
        restoreMutation.mutate(
            { documentId: doc.id },
            {
                onSuccess: () => {
                    showSnackbar('문서를 복구했어.');
                },
                onError: () => {
                    showSnackbar('복구에 실패했어. 잠시 후 다시 시도해줘.');
                },
            },
        );
    };

    return (
        <div className="h-full overflow-y-auto rounded-2xl bg-white p-4 shadow-soft">
            <SectionHeader
                title="휴지통"
                subtitle="삭제한 문서가 여기에 모여 있어. 복구하거나 완전히 삭제할 수 있어."
            />

            {isLoading ? (
                <p className="mt-6 text-sm text-slate-500">
                    삭제된 문서를 불러오는 중...
                </p>
            ) : !deletedDocs || deletedDocs.length === 0 ? (
                <EmptyState
                    icon="trash"
                    title="휴지통이 비어 있어."
                    description={
                        '삭제한 문서는 여기에 모여.\n아직 버린 문서가 하나도 없네.'
                    }
                />
            ) : (
                <ul className="space-y-2 text-sm">
                    {deletedDocs.map((doc) => {
                        const deletedAtStr = doc.deleted_at
                            ? new Date(doc.deleted_at).toLocaleString()
                            : '';
                        const categoryName = getCategoryName(doc.category_id);

                        return (
                            <li
                                key={doc.id}
                                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                            >
                                <div className="flex flex-col flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-400">
                                            {categoryName} |
                                        </span>
                                        <span className="font-medium text-slate-800">
                                            {doc.title}
                                        </span>
                                        <span
                                            className={
                                                'inline-flex items-center rounded-full px-2 py-[2px] text-[10px] ' +
                                                (doc.visibility === 'friends'
                                                    ? 'bg-fuchsia-50 text-fuchsia-700'
                                                    : 'bg-slate-100 text-slate-500')
                                            }
                                        >
                                            {doc.visibility === 'friends'
                                                ? '친구 공개'
                                                : '나만 보기'}
                                        </span>
                                    </div>

                                    <span className="mt-0.5 text-[11px] text-slate-400">
                                        삭제: {deletedAtStr}
                                    </span>
                                </div>

                                <div className="ml-3 flex items-center gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleRestore(doc)}
                                        className="text-primary-500 hover:text-primary-700"
                                        disabled={restoreMutation.isLoading}
                                    >
                                        복구
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDocToHardDelete(doc)}
                                        className="text-rose-500 hover:text-rose-700"
                                    >
                                        완전 삭제
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ConfirmDialog
                open={!!docToHardDelete}
                title="문서를 완전히 삭제할까?"
                message={
                    docToHardDelete
                        ? `"${docToHardDelete.title}" 문서를 정말 완전 삭제할까?\n이 작업은 되돌릴 수 없어.`
                        : ''
                }
                confirmText={
                    hardDeleteMutation.isLoading ? '삭제 중...' : '완전 삭제'
                }
                cancelText="취소"
                onCancel={() => {
                    if (hardDeleteMutation.isLoading) return;
                    setDocToHardDelete(null);
                }}
                onConfirm={handleConfirmHardDelete}
            />
        </div>
    );
}
