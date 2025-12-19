// Sidebar.jsx
import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCategories } from '../../features/wiki/hooks/useCategories';
import { useCreateCategory } from '../../features/wiki/hooks/useCreateCategory';
import { useDeleteCategory } from '../../features/wiki/hooks/useDeleteCategory';
import { useMoveCategory } from '../../features/wiki/hooks/useMoveCategory';
import { useAuthStore } from '../../store/authStore';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useSnackbar } from '../ui/SnackbarContext';
import EmptyState from '../ui/EmptyState.jsx';
import { useUpdateCategoryName } from "../../features/wiki/hooks/useUpdateCategoryName.js";

function FolderIcon({ className = '' }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 flex-none ${className}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.3a1.5 1.5 0 0 1 1.06.44L11.8 8H19.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z" />
        </svg>
    );
}

export default function Sidebar() {
    const { data: categories, isLoading } = useCategories();
    const createCategoryMutation = useCreateCategory();
    const deleteCategoryMutation = useDeleteCategory();
    const moveCategoryMutation = useMoveCategory();
    const updateCategoryNameMutation = useUpdateCategoryName();
    const user = useAuthStore((s) => s.user);

    const { showSnackbar } = useSnackbar();

    const [newCategoryName, setNewCategoryName] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [draggingCategoryId, setDraggingCategoryId] = useState(null);

    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const navigate = useNavigate();
    const location = useLocation();

    const getCurrentCategoryId = () => {
        const match = location.pathname.match(/^\/category\/(\d+)/);
        if (!match) return null;
        return Number(match[1]);
    };
    const currentCategoryId = getCurrentCategoryId();

    const handleAddCategory = (e) => {
        e.preventDefault();
        const name = newCategoryName.trim();
        if (!name) return;

        let parentId = null;

        if (currentCategoryId && categories && user) {
            const selected = categories.find((c) => c.id === currentCategoryId);

            if (selected && selected.user_id === user.id) {
                if (selected.parent_id == null) parentId = selected.id;
                else parentId = selected.parent_id;
            }
        }

        createCategoryMutation.mutate(
            { name, parentId },
            { onSuccess: () => setNewCategoryName('') }
        );
    };

    const handleClickCategory = (catId) => {
        navigate(`/category/${catId}`);
    };

    const handleConfirmDeleteCategory = () => {
        if (!categoryToDelete) return;

        deleteCategoryMutation.mutate(
            { categoryId: categoryToDelete.id },
            {
                onSuccess: () => {
                    showSnackbar(
                        `"${categoryToDelete.name}" 카테고리를 삭제했어.\n해당 카테고리의 문서들은 휴지통으로 이동했어.`
                    );

                    if (location.pathname.startsWith(`/category/${categoryToDelete.id}`)) {
                        navigate('/docs');
                    }
                    setCategoryToDelete(null);
                },
                onError: () => {
                    showSnackbar('카테고리 삭제에 실패했어. 잠시 후 다시 시도해줘.');
                    setCategoryToDelete(null);
                },
            }
        );
    };

    const isAllActive = location.pathname === '/docs';
    const isTrashActive = location.pathname === '/trash';
    const isCategoryActive = (catId) => currentCategoryId === catId;

    const { myRoots, myChildrenMap, friendRoots, friendChildrenMap } = useMemo(() => {
        const list = categories || [];
        const myRoots = [];
        const friendRoots = [];
        const myChildrenMap = new Map();
        const friendChildrenMap = new Map();

        list.forEach((c) => {
            const isMine = user && c.user_id === user.id;
            const roots = isMine ? myRoots : friendRoots;
            const childrenMap = isMine ? myChildrenMap : friendChildrenMap;

            if (c.parent_id == null) roots.push(c);
            else {
                if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, []);
                childrenMap.get(c.parent_id).push(c);
            }
        });

        return { myRoots, myChildrenMap, friendRoots, friendChildrenMap };
    }, [categories, user]);

    const isRootActive = (rootId) => isCategoryActive(rootId);

    const handleDragStart = (categoryId) => setDraggingCategoryId(categoryId);
    const handleDragEnd = () => setDraggingCategoryId(null);

    const handleDropOnRootLevel = () => {
        if (!draggingCategoryId || !categories || !user) return;

        const cat = categories.find((c) => c.id === draggingCategoryId);
        if (!cat) return;
        if (cat.user_id !== user.id) return;

        moveCategoryMutation.mutate({
            categoryId: cat.id,
            parentId: null,
            beforeCategoryId: null,
        });

        setDraggingCategoryId(null);
    };

    const handleDropOnRootCategory = (targetRootId, event) => {
        if (!draggingCategoryId || !categories || !user) return;

        const dragged = categories.find((c) => c.id === draggingCategoryId);
        const target = categories.find((c) => c.id === targetRootId);
        if (!dragged || !target) return;

        if (dragged.user_id !== user.id) {
            setDraggingCategoryId(null);
            return;
        }
        if (target.parent_id != null) {
            setDraggingCategoryId(null);
            return;
        }
        if (dragged.id === target.id) {
            setDraggingCategoryId(null);
            return;
        }

        const draggedParent = dragged.parent_id ?? null;
        const targetParent = target.parent_id ?? null;
        const sameParent = draggedParent === targetParent;

        const rect = event.currentTarget.getBoundingClientRect();
        const offsetY = event.clientY - rect.top;
        const ratio = offsetY / rect.height;

        if (sameParent && ratio < 0.35) {
            moveCategoryMutation.mutate({
                categoryId: dragged.id,
                parentId: draggedParent,
                beforeCategoryId: target.id,
            });
            setDraggingCategoryId(null);
            return;
        }

        const hasChildren = categories.some((c) => c.parent_id === dragged.id);
        if (hasChildren && targetRootId !== null) {
            showSnackbar('하위 카테고리가 있는 카테고리는 2depth로 옮길 수 없어.');
            setDraggingCategoryId(null);
            return;
        }

        if (dragged.parent_id === targetRootId) {
            setDraggingCategoryId(null);
            return;
        }

        moveCategoryMutation.mutate({
            categoryId: dragged.id,
            parentId: targetRootId,
            beforeCategoryId: null,
        });

        setDraggingCategoryId(null);
    };

    const startEditingCategory = (category) => {
        if (!category || !user) return;
        if (category.user_id !== user.id) return;

        setEditingCategoryId(category.id);
        setEditingName(category.name || '');
    };

    const cancelEditingCategory = () => {
        setEditingCategoryId(null);
        setEditingName('');
    };

    const submitEditingCategory = () => {
        const name = (editingName || '').trim();
        if (!editingCategoryId) return;

        const original = categories?.find((c) => c.id === editingCategoryId);
        if (!original) {
            cancelEditingCategory();
            return;
        }

        if (!name || name === original.name) {
            cancelEditingCategory();
            return;
        }

        updateCategoryNameMutation.mutate(
            { categoryId: editingCategoryId, name },
            {
                onSuccess: cancelEditingCategory,
                onError: () => {
                    showSnackbar('카테고리 이름을 바꾸는 데 실패했어.');
                    cancelEditingCategory();
                },
            }
        );
    };

    return (
        <div className="flex h-full flex-col gap-4 p-3">
            {/* ✅ 헤더: ui-panel 토큰 사용 */}
            <div className="ui-panel rounded-2xl p-3 shadow-soft">
                <p className="font-semibold ui-page-title">목차</p>
                <p className="mt-1 text-xs ui-page-subtitle">
                    카테고리를 트리 구조로 정리해서
                    <br />
                    문서를 더 깔끔하게 관리해 보자.
                </p>
            </div>

            {/* ✅ 입력: ui-input 토큰 사용 */}
            <form onSubmit={handleAddCategory} className="space-y-2">
                <input
                    type="text"
                    className="ui-input w-full px-3 py-2 text-xs"
                    placeholder="새 카테고리 이름"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button
                    type="submit"
                    className="w-full"
                    disabled={createCategoryMutation.isLoading}
                >
                    {createCategoryMutation.isLoading ? '추가 중...' : '카테고리 추가'}
                </Button>
            </form>

            {/* ✅ 목록 컨테이너: ui-surface 토큰 사용 */}
            <div className="ui-surface mt-2 flex-1 overflow-y-auto rounded-2xl py-2.5 px-1.5 shadow-soft">
                {isLoading ? (
                    <p className="text-xs ui-page-subtitle">카테고리를 불러오는 중...</p>
                ) : !categories || categories.length === 0 ? (
                    <EmptyState
                        icon="folder"
                        title="아직 카테고리가 없어."
                        description="위 버튼을 눌러 카테고리를 추가하고 카테고리 별 문서를 관리해 보자."
                    />
                ) : (
                    <div className="space-y-4 text-sm">
                        <ul className="space-y-1">
                            {/* ✅ 전체 */}
                            <li
                                onClick={() => navigate('/docs')}
                                onDragOver={(e) => {
                                    if (!draggingCategoryId) return;
                                    e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    if (!draggingCategoryId) return;
                                    e.preventDefault();
                                    handleDropOnRootLevel();
                                }}
                                className={[
                                    "ui-side-item",
                                    isAllActive ? "ui-side-item-active" : "",
                                    draggingCategoryId ? "ui-side-drop" : "",
                                ].join(" ")}
                            >
                                <FolderIcon className={isAllActive ? "ui-side-icon-active" : "ui-side-icon"} />
                                <span className="text-[12.5px]">전체</span>
                            </li>

                            {/* 내 카테고리 */}
                            {myRoots.length > 0 && (
                                <li>
                                    <ul className="space-y-[2px]">
                                        {myRoots.map((root, idx) => {
                                            const rootActive = isRootActive(root.id);
                                            const isMineRoot = root.user_id === user?.id;
                                            const children = myChildrenMap.get(root.id) || [];
                                            const isLastRoot = idx === myRoots.length - 1;

                                            return (
                                                <li key={root.id} className="relative pl-5">
                                                    {/* ✅ 세로선: ui-tree-line */}
                                                    <span
                                                        aria-hidden
                                                        className={[
                                                            "pointer-events-none absolute left-[14px] border-l border-dashed ui-tree-line",
                                                            isLastRoot ? "top-0 bottom-1/2" : "top-0 bottom-0",
                                                        ].join(" ")}
                                                    />

                                                    <div
                                                        onClick={() => handleClickCategory(root.id)}
                                                        draggable={isMineRoot}
                                                        onDragStart={() => isMineRoot && handleDragStart(root.id)}
                                                        onDragEnd={handleDragEnd}
                                                        onDragOver={(e) => {
                                                            if (!draggingCategoryId) return;
                                                            e.preventDefault();
                                                        }}
                                                        onDrop={(e) => {
                                                            if (!draggingCategoryId) return;
                                                            e.preventDefault();
                                                            handleDropOnRootCategory(root.id, e);
                                                        }}
                                                        className={[
                                                            "ui-side-item group",
                                                            rootActive ? "ui-side-item-active" : "",
                                                            draggingCategoryId === root.id ? "opacity-60" : "",
                                                        ].join(" ")}
                                                    >
                                                        <div className="relative flex min-w-0 flex-1 items-center gap-1.5">
                                                            {/* ✅ 가로선: ui-tree-branch (너 index.css 기준) */}
                                                            <span aria-hidden className="ui-tree-branch -left-[12px] w-[12px]" />
                                                            <FolderIcon className={rootActive ? "ui-side-icon-active" : "ui-side-icon"} />

                                                            {editingCategoryId === root.id ? (
                                                                <input
                                                                    autoFocus
                                                                    value={editingName}
                                                                    onChange={(e) => setEditingName(e.target.value)}
                                                                    onBlur={submitEditingCategory}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') submitEditingCategory();
                                                                        else if (e.key === 'Escape') cancelEditingCategory();
                                                                    }}
                                                                    className="ui-input max-w-[160px] px-2 py-1 text-[12.5px]"
                                                                />
                                                            ) : (
                                                                <span
                                                                    className="max-w-full truncate text-[12.5px]"
                                                                    title={root.name}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEditingCategory(root);
                                                                    }}
                                                                >
                                  {root.name}
                                </span>
                                                            )}
                                                        </div>

                                                        {isMineRoot && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCategoryToDelete(root);
                                                                }}
                                                                className="ui-danger-text ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[11px]"
                                                                aria-label="카테고리 삭제"
                                                            >
                                                                삭제
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* 2depth */}
                                                    {children.length > 0 && (
                                                        <ul className="mt-[2px] space-y-[2px]">
                                                            {children.map((child, cIdx) => {
                                                                const childActive = isCategoryActive(child.id);
                                                                const isMineChild = child.user_id === user?.id;
                                                                const isLastChild = cIdx === children.length - 1;

                                                                return (
                                                                    <li key={child.id} className="relative pl-7">
                                                                        {/* ✅ 세로선 */}
                                                                        <span
                                                                            aria-hidden
                                                                            className={[
                                                                                "pointer-events-none absolute left-[14px] border-l border-dashed ui-tree-line",
                                                                                isLastChild ? "top-0 bottom-1/2" : "top-0 bottom-0",
                                                                            ].join(" ")}
                                                                        />

                                                                        <div
                                                                            onClick={() => handleClickCategory(child.id)}
                                                                            draggable={isMineChild}
                                                                            onDragStart={() => isMineChild && handleDragStart(child.id)}
                                                                            onDragEnd={handleDragEnd}
                                                                            className={[
                                                                                "ui-side-subitem group",
                                                                                childActive ? "ui-side-item-active" : "",
                                                                                draggingCategoryId === child.id ? "opacity-60" : "",
                                                                            ].join(" ")}
                                                                        >
                                                                            <div className="relative flex min-w-0 flex-1 items-center gap-1">
                                                                                {/* ✅ 가로선 */}
                                                                                <span aria-hidden className="ui-tree-branch -left-[18px] w-[12px]" />

                                                                                {editingCategoryId === child.id ? (
                                                                                    <input
                                                                                        autoFocus
                                                                                        value={editingName}
                                                                                        onChange={(e) => setEditingName(e.target.value)}
                                                                                        onBlur={submitEditingCategory}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') submitEditingCategory();
                                                                                            else if (e.key === 'Escape') cancelEditingCategory();
                                                                                        }}
                                                                                        className="ui-input max-w-full px-2 py-1 text-[11.5px]"
                                                                                    />
                                                                                ) : (
                                                                                    <span
                                                                                        className="max-w-full truncate text-[11.5px]"
                                                                                        title={child.name}
                                                                                        onDoubleClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            startEditingCategory(child);
                                                                                        }}
                                                                                    >
                                            {child.name}
                                          </span>
                                                                                )}
                                                                            </div>

                                                                            {isMineChild && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setCategoryToDelete(child);
                                                                                    }}
                                                                                    className="ui-danger-text ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[11px]"
                                                                                    aria-label="카테고리 삭제"
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
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                            )}
                        </ul>

                        {/* 공유받은 카테고리 */}
                        {friendRoots.length > 0 && (
                            <div className="border-t pt-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                                <div className="mb-1 px-1 text-[11px] font-semibold ui-page-subtitle">
                                    공유받은 카테고리
                                </div>
                                <ul className="space-y-1 text-sm">
                                    {friendRoots.map((root) => {
                                        const rootActive = isRootActive(root.id);
                                        const children = friendChildrenMap.get(root.id) || [];

                                        return (
                                            <li key={root.id} className="space-y-[2px]">
                                                <div
                                                    onClick={() => handleClickCategory(root.id)}
                                                    className={[
                                                        "ui-side-item",
                                                        rootActive ? "ui-side-item-active" : "",
                                                    ].join(" ")}
                                                >
                                                    <FolderIcon className={rootActive ? "ui-side-icon-active" : "ui-side-icon"} />
                                                    <span className="max-w-full truncate text-[12.5px]" title={root.name}>
                            {root.name}
                          </span>
                                                    <span className="ml-1 ui-badge-fixed px-2 py-[1px] text-[10px]">
                            공유받음
                          </span>
                                                </div>

                                                {children.length > 0 && (
                                                    <ul className="mt-[2px] space-y-[2px]">
                                                        {children.map((child) => {
                                                            const childActive = isCategoryActive(child.id);

                                                            return (
                                                                <li key={child.id} className="relative pl-7">
                                  <span
                                      aria-hidden
                                      className="pointer-events-none absolute left-[14px] top-0 bottom-1/2 border-l border-dashed ui-tree-line"
                                  />
                                                                    <div
                                                                        onClick={() => handleClickCategory(child.id)}
                                                                        className={[
                                                                            "ui-side-subitem",
                                                                            childActive ? "ui-side-item-active" : "",
                                                                        ].join(" ")}
                                                                    >
                                                                        <div className="relative flex min-w-0 flex-1 items-center gap-1">
                                                                            <span aria-hidden className="ui-tree-branch -left-[18px] w-[12px]" />
                                                                            <span className="max-w-full truncate" title={child.name}>
                                        {child.name}
                                      </span>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ✅ 휴지통: ui-trash 토큰 사용 */}
            <button
                type="button"
                onClick={() => navigate('/trash')}
                className={[
                    "ui-surface rounded-2xl border px-3 py-2 text-xs font-medium transition flex items-center gap-2",
                    isTrashActive ? "ui-trash-active" : "ui-trash",
                ].join(" ")}
            >
                <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                <span>휴지통</span>
            </button>

            <ConfirmDialog
                open={!!categoryToDelete}
                title="카테고리를 삭제할까?"
                message={
                    categoryToDelete
                        ? `"${categoryToDelete.name}" 카테고리를 삭제할까?\n이 카테고리 안의 문서들은 모두 휴지통으로 이동해.`
                        : ''
                }
                confirmText={deleteCategoryMutation.isLoading ? '삭제 중...' : '삭제'}
                cancelText="취소"
                onCancel={() => {
                    if (deleteCategoryMutation.isLoading) return;
                    setCategoryToDelete(null);
                }}
                onConfirm={handleConfirmDeleteCategory}
            />
        </div>
    );
}
