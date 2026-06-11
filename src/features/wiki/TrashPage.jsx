// src/features/wiki/TrashPage.jsx
import { useState } from 'react';
import { Viewer } from '@toast-ui/react-editor';
import { useDeletedDocuments } from './hooks/useDeletedDocuments';
import { useHardDeleteDocument } from './hooks/useHardDeleteDocument';
import { useRestoreDocument } from './hooks/useRestoreDocument';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import { renderFontWidgetsInMarkdown } from './wikiFontRender';

export default function TrashPage() {
    const { data: deletedDocs, isLoading } = useDeletedDocuments();
    const hardDeleteMutation = useHardDeleteDocument();
    const restoreMutation = useRestoreDocument();
    const { showSnackbar } = useSnackbar();

    const [docToHardDelete, setDocToHardDelete] = useState(null);
    const [selectedDoc, setSelectedDoc] = useState(null);

    const handleConfirmHardDelete = () => {
        if (!docToHardDelete) return;

        hardDeleteMutation.mutate(
            { documentId: docToHardDelete.id },
            {
                onSuccess: () => {
                    showSnackbar('문서를 완전히 삭제했어.');
                    setDocToHardDelete(null);
                    setSelectedDoc(null);
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
                    setSelectedDoc(null);
                },
                onError: () => showSnackbar('복구에 실패했어. 잠시 후 다시 시도해줘.'),
            },
        );
    };

    return (
        <div className="ui-surface h-full overflow-y-auto rounded-2xl p-4 shadow-soft">
            <SectionHeader
                title="휴지통"
                // subtitle="삭제한 문서가 여기에 모여 있어. 복구하거나 완전히 삭제할 수 있어."
            />

            {isLoading ? (
                <p className="mt-6 text-sm ui-page-subtitle">삭제된 문서를 불러오는 중...</p>
            ) : !deletedDocs || deletedDocs.length === 0 ? (
                <EmptyState
                    icon="trash"
                    title="휴지통이 비어 있어."
                    description={'삭제한 문서는 여기에 모여.\n아직 버린 문서가 하나도 없네.'}
                />
            ) : (
                <ul className="space-y-2 text-sm">
                    {deletedDocs.map((doc) => {
                        const deletedAtStr = doc.deleted_at
                            ? new Date(doc.deleted_at).toLocaleString()
                            : '';
                        const categoryName = doc.category?.name || '미분류';

                        const isFriends = doc.visibility === 'friends';

                        return (
                            <li key={doc.id} className="ui-list-item">
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <div className="flex min-w-0 items-center gap-2">
                    <span className="text-[11px] ui-page-subtitle whitespace-nowrap">
                      {categoryName} |
                    </span>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedDoc(doc)}
                                            className="min-w-0 truncate font-medium text-left hover:underline"
                                        >
                                            {doc.title}
                                        </button>

                                        {isFriends ? (
                                            <span className="ui-badge-fixed px-2 text-[10px] rounded-full whitespace-nowrap">
                        친구 공개
                      </span>
                                        ) : (
                                            <span className="ui-badge-off px-2 text-[10px] rounded-full whitespace-nowrap">
                        나만 보기
                      </span>
                                        )}
                                    </div>

                                    <span className="mt-0.5 text-[11px] ui-page-subtitle">
                    삭제: {deletedAtStr}
                  </span>
                                </div>

                                <div className="ml-3 flex flex-none items-center gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleRestore(doc)}
                                        disabled={restoreMutation.isLoading}
                                        className="btn-ghost rounded-lg px-2 py-1 border"
                                    >
                                        복구
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setDocToHardDelete(doc)}
                                        className="ui-btn-danger"
                                    >
                                        완전 삭제
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {selectedDoc && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6">
                    <div className="ui-modal flex max-h-full w-full max-w-4xl flex-col rounded-2xl shadow-xl">
                        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                    {selectedDoc.title}
                                </p>
                                <p className="mt-1 text-[11px] ui-page-subtitle">
                                    {selectedDoc.category?.name || '미분류'} · 삭제:{' '}
                                    {selectedDoc.deleted_at
                                        ? new Date(selectedDoc.deleted_at).toLocaleString()
                                        : ''}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn-ghost rounded-lg border px-2 py-1 text-xs"
                                onClick={() => setSelectedDoc(null)}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                            {selectedDoc.content_markdown ? (
                                <div className="tui-viewer-wrapper">
                                    <Viewer
                                        key={selectedDoc.id}
                                        initialValue={renderFontWidgetsInMarkdown(
                                            selectedDoc.content_markdown,
                                        )}
                                    />
                                </div>
                            ) : (
                                <p className="text-sm ui-page-subtitle">
                                    이 문서에는 내용이 없어.
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-border-subtle px-4 py-3 text-xs">
                            <button
                                type="button"
                                onClick={() => handleRestore(selectedDoc)}
                                disabled={restoreMutation.isLoading}
                                className="btn-ghost rounded-lg px-3 py-1.5 border"
                            >
                                {restoreMutation.isLoading ? '복구 중...' : '복구'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setDocToHardDelete(selectedDoc)}
                                className="ui-btn-danger px-3 py-1.5"
                            >
                                완전 삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!docToHardDelete}
                title="문서를 완전히 삭제할까?"
                message={
                    docToHardDelete
                        ? `"${docToHardDelete.title}" 문서를 정말 완전 삭제할까?\n이 작업은 되돌릴 수 없어.`
                        : ''
                }
                confirmText={hardDeleteMutation.isLoading ? '삭제 중...' : '완전 삭제'}
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
