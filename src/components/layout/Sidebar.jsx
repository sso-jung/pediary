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
import {useUpdateCategoryName} from "../../features/wiki/hooks/useUpdateCategoryName.js";

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

    // 🔹 인라인 이름 수정용 상태
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const navigate = useNavigate();
    const location = useLocation();

    const handleAddCategory = (e) => {
        e.preventDefault();
        const name = newCategoryName.trim();
        if (!name) return;

        // 🔹 현재 선택된 카테고리 기준으로 parentId 결정
        let parentId = null;

        if (currentCategoryId && categories && user) {
            const selected = categories.find((c) => c.id === currentCategoryId);

            if (selected && selected.user_id === user.id) {
                if (selected.parent_id == null) {
                    // 1depth 선택 → 선택한 카테고리의 하위(2depth)로 추가
                    parentId = selected.id;
                } else {
                    // 2depth 선택 → 같은 부모를 가지는 형제로 추가
                    parentId = selected.parent_id;
                }
            }
            // ⚠ selected 가 친구 카테고리거나 없으면 parentId 그대로 null (1depth로 추가)
        }

        createCategoryMutation.mutate(
            { name, parentId }, // ✅ parentId 함께 전달
            {
                onSuccess: () => setNewCategoryName(''),
            },
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
                        `"${categoryToDelete.name}" 카테고리를 삭제했어.\n해당 카테고리의 문서들은 휴지통으로 이동했어.`,
                    );

                    if (
                        location.pathname.startsWith(
                            `/category/${categoryToDelete.id}`,
                        )
                    ) {
                        navigate('/docs');
                    }

                    setCategoryToDelete(null);
                },
                onError: () => {
                    showSnackbar(
                        '카테고리 삭제에 실패했어. 잠시 후 다시 시도해줘.',
                    );
                    setCategoryToDelete(null);
                },
            },
        );
    };

    const isAllActive = location.pathname === '/docs';
    const isTrashActive = location.pathname === '/trash';

    const getCurrentCategoryId = () => {
        const match = location.pathname.match(/^\/category\/(\d+)/);
        if (!match) return null;
        return Number(match[1]);
    };

    const currentCategoryId = getCurrentCategoryId();

    const isCategoryActive = (catId) => currentCategoryId === catId;

    const {
        myRoots,
        myChildrenMap,
        friendRoots,
        friendChildrenMap,
    } = useMemo(() => {
        const list = categories || [];
        const myRoots = [];
        const friendRoots = [];
        const myChildrenMap = new Map();
        const friendChildrenMap = new Map();

        list.forEach((c) => {
            const isMine = user && c.user_id === user.id;
            const roots = isMine ? myRoots : friendRoots;
            const childrenMap = isMine ? myChildrenMap : friendChildrenMap;

            if (c.parent_id == null) {
                roots.push(c);
            } else {
                if (!childrenMap.has(c.parent_id)) {
                    childrenMap.set(c.parent_id, []);
                }
                childrenMap.get(c.parent_id).push(c);
            }
        });

        return { myRoots, myChildrenMap, friendRoots, friendChildrenMap };
    }, [categories, user]);

    const isRootActive = (rootId) => isCategoryActive(rootId);

    const handleDragStart = (categoryId) => {
        setDraggingCategoryId(categoryId);
    };
    const handleDragEnd = () => {
        setDraggingCategoryId(null);
    };

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
            showSnackbar(
                '하위 카테고리가 있는 카테고리는 2depth로 옮길 수 없어.',
            );
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
        if (category.user_id !== user.id) return; // 공유받은 카테고리는 수정 불가

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

        // 비어 있거나 이름이 안 바뀌었으면 그냥 취소
        if (!name || name === original.name) {
            cancelEditingCategory();
            return;
        }

        updateCategoryNameMutation.mutate(
            { categoryId: editingCategoryId, name },
            {
                onSuccess: () => {
                    cancelEditingCategory();
                },
                onError: () => {
                    showSnackbar('카테고리 이름을 바꾸는 데 실패했어.');
                    cancelEditingCategory();
                },
            },
        );
    };

    return (
        <div className="flex h-full flex-col gap-4 p-3">
            {/* 카드 헤더 */}
            <div className="rounded-2xl bg-primary-50 p-3 text-sm text-slate-700 shadow-soft">
                <p className="font-semibold">목차</p>
                <p className="mt-1 text-xs text-slate-500">
                    카테고리를 트리 구조로 정리해서
                    <br />
                    문서를 더 깔끔하게 관리해 보자.
                </p>
            </div>

            {/* 카테고리 추가 폼 */}
            <form onSubmit={handleAddCategory} className="space-y-2">
                <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200"
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

            {/* 카테고리 목록 */}
            <div className="mt-2 flex-1 overflow-y-auto rounded-2xl bg-white py-2.5 px-1.5 shadow-soft">
                {isLoading ? (
                    <p className="text-xs text-slate-500">
                        카테고리를 불러오는 중...
                    </p>
                ) : !categories || categories.length === 0 ? (
                    <EmptyState
                        icon="folder"
                        title="아직 카테고리가 없어."
                        description={
                            '위 버튼을 눌러 카테고리를 추가하고 카테고리 별 문서를 관리해 보자.'
                        }
                    />
                ) : (
                    <div className="space-y-4 text-sm">
                        {/* ▸ 내 카테고리 트리 */}
                        <ul className="space-y-1">
                            {/* 🔹 최상단: 전체 (루트) */}
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
                                className={`flex cursor-pointer items-center rounded-lg px-1.5 py-1 text-[13px] transition ${
                                    isAllActive
                                        ? 'bg-primary-100 text-primary-700 font-semibold'
                                        : 'text-slate-700 hover:bg-primary-50'
                                } ${
                                    draggingCategoryId
                                        ? 'ring-1 ring-primary-200'
                                        : ''
                                }`}
                            >
                                <FolderIcon
                                    className={
                                        isAllActive
                                            ? 'text-primary-500'
                                            : 'text-slate-400'
                                    }
                                />
                                <span className="ml-2 text-[12.5px]">전체</span>
                            </li>

                            {/* 🔹 전체 밑에 내 1depth 카테고리들 */}
                            {myRoots.length > 0 && (
                                <li>
                                    <ul className="space-y-[2px]">
                                        {myRoots.map((root, idx) => {
                                            const rootActive = isRootActive(root.id);
                                            const isMineRoot =
                                                root.user_id === user?.id;
                                            const children =
                                                myChildrenMap.get(root.id) ||
                                                [];

                                            const isLastRoot =
                                                idx === myRoots.length - 1;

                                            return (
                                                <li
                                                    key={root.id}
                                                    className="relative pl-5"
                                                >
                                                    {/* ▸ 전체에서 내려오는 세로선 */}
                                                    <span
                                                        aria-hidden
                                                        className={`pointer-events-none absolute left-[14px] border-l border-dashed border-slate-200 ${
                                                            isLastRoot
                                                                ? 'top-0 bottom-1/2'
                                                                : 'top-0 bottom-0'
                                                        }`}
                                                    />

                                                    {/* 1depth 행 */}
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
                                                        className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-1.5 py-1 transition ${
                                                            rootActive
                                                                ? 'bg-primary-50 text-primary-700 font-semibold'
                                                                : 'text-slate-700 hover:bg-primary-50'
                                                        } ${draggingCategoryId === root.id ? 'opacity-60' : ''}`}
                                                    >
                                                        <div className="relative flex min-w-0 flex-1 items-center gap-1.5">
                                                            {/* ─ 가로 점선 */}
                                                            <span
                                                                aria-hidden
                                                                className="pointer-events-none absolute -left-[13px] top-1/2 h-px w-[12px] -translate-y-1/2 border-t border-dashed border-slate-200"
                                                            />
                                                            <FolderIcon
                                                                className={
                                                                    rootActive ? 'text-primary-500' : 'text-slate-400'
                                                                }
                                                            />
                                                            {editingCategoryId === root.id ? (
                                                                // 🔹 인라인 편집 input
                                                                <input
                                                                    autoFocus
                                                                    value={editingName}
                                                                    onChange={(e) => setEditingName(e.target.value)}
                                                                    onBlur={submitEditingCategory}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            submitEditingCategory();
                                                                        } else if (e.key === 'Escape') {
                                                                            cancelEditingCategory();
                                                                        }
                                                                    }}
                                                                    className="max-w-[140px] rounded-sm border border-primary-200 bg-white px-1 py-0.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-primary-300"
                                                                />
                                                            ) : (
                                                                <span
                                                                    className="max-w-full truncate text-[12.5px]"
                                                                    title={root.name}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();        // 더블클릭 시 네비게이션 막기
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
                                                                className="ml-1 inline-flex items-center justify-center rounded-md pl-0.5 py-0.5 text-[9px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                                                                aria-label="카테고리 삭제"
                                                            >
                                                                삭제
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* 2depth */}
                                                    {children.length > 0 && (
                                                        <ul className="mt-[2px] space-y-[2px]">
                                                            {children.map(
                                                                (
                                                                    child,
                                                                    cIdx,
                                                                ) => {
                                                                    const childActive =
                                                                        isCategoryActive(
                                                                            child.id,
                                                                        );
                                                                    const isMineChild =
                                                                        child.user_id ===
                                                                        user?.id;
                                                                    const isLastChild =
                                                                        cIdx ===
                                                                        children.length - 1;

                                                                    return (
                                                                        <li
                                                                            key={
                                                                                child.id
                                                                            }
                                                                            className="relative pl-7"
                                                                        >
                                                                            {/* ▸ 1depth에서 내려오는 세로선 */}
                                                                            <span
                                                                                aria-hidden
                                                                                className={`pointer-events-none absolute left-[14px] border-l border-dashed border-slate-200 ${
                                                                                    isLastChild
                                                                                        ? 'top-0 bottom-1/2'
                                                                                        : 'top-0 bottom-0'
                                                                                }`}
                                                                            />

                                                                            <div
                                                                                onClick={() => handleClickCategory(child.id)}
                                                                                draggable={isMineChild}
                                                                                onDragStart={() => isMineChild && handleDragStart(child.id)}
                                                                                onDragEnd={handleDragEnd}
                                                                                className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-1.5 py-1 text-[13px] transition ${
                                                                                    childActive
                                                                                        ? 'bg-primary-50 text-primary-700 font-semibold'
                                                                                        : 'text-slate-600 hover:bg-primary-50'
                                                                                } ${draggingCategoryId === child.id ? 'opacity-60' : ''}`}
                                                                            >
                                                                                <div
                                                                                    className="relative flex min-w-0 flex-1 items-center gap-1">
                                                                                    {/* ─ 가로 점선 */}
                                                                                    <span
                                                                                        aria-hidden
                                                                                        className="pointer-events-none absolute -left-[18px] top-1/2 h-px w-[12px] -translate-y-1/2 border-t border-dashed border-slate-200"
                                                                                    />

                                                                                    {editingCategoryId === child.id ? (
                                                                                        <input
                                                                                            autoFocus
                                                                                            value={editingName}
                                                                                            onChange={(e) => setEditingName(e.target.value)}
                                                                                            onBlur={submitEditingCategory}
                                                                                            onKeyDown={(e) => {
                                                                                                if (e.key === 'Enter') {
                                                                                                    submitEditingCategory();
                                                                                                } else if (e.key === 'Escape') {
                                                                                                    cancelEditingCategory();
                                                                                                }
                                                                                            }}
                                                                                            className="max-w-full rounded-sm border border-primary-200 bg-white px-1 py-0.5 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-primary-300"
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
                                                                                        className="ml-1 inline-flex items-center justify-center rounded-md pl-0.5 py-0.5 text-[9px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                                                                                        aria-label="카테고리 삭제"
                                                                                    >
                                                                                    삭제
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </li>
                                                                    );
                                                                },
                                                            )}
                                                        </ul>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                            )}
                        </ul>

                        {/* ▸ 공유받은 카테고리 섹션 (드래그 불가) */}
                        {friendRoots.length > 0 && (
                            <div className="border-t border-slate-100 pt-2">
                                <div className="mb-1 px-1 text-[11px] font-semibold text-slate-400">
                                    공유받은 카테고리
                                </div>
                                <ul className="space-y-1 text-sm">
                                    {friendRoots.map((root) => {
                                        const rootActive = isRootActive(root.id);
                                        const children =
                                            friendChildrenMap.get(root.id) ||
                                            [];

                                        return (
                                            <li
                                                key={root.id}
                                                className="space-y-[2px]"
                                            >
                                                <div
                                                    onClick={() =>
                                                        handleClickCategory(
                                                            root.id,
                                                        )
                                                    }
                                                    className={`flex cursor-pointer items-center justify-between rounded-lg px-1.5 py-1 transition ${
                                                        rootActive
                                                            ? 'bg-fuchsia-50 text-fuchsia-800 font-semibold'
                                                            : 'text-slate-700 hover:bg-fuchsia-50/60'
                                                    }`}
                                                >
                                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                        <FolderIcon
                                                            className={
                                                                rootActive
                                                                    ? 'text-primary-500'
                                                                    : 'text-slate-400'
                                                            }
                                                        />
                                                        <span
                                                            className="max-w-full truncate text-[12.5px]"
                                                            title={root.name}
                                                        >
                                                            {root.name}
                                                        </span>
                                                        <span className="ml-1 inline-flex flex-none items-center rounded-full bg-fuchsia-100 px-2 py-[1px] text-[10px] text-fuchsia-800">
                                                            공유받음
                                                        </span>
                                                    </div>
                                                </div>

                                                {children.length > 0 && (
                                                    <ul className="mt-[2px] space-y-[2px]">
                                                        {children.map(
                                                            (child) => {
                                                                const childActive =
                                                                    isCategoryActive(
                                                                        child.id,
                                                                    );

                                                                return (
                                                                    <li
                                                                        key={
                                                                            child.id
                                                                        }
                                                                        className="relative pl-7"
                                                                    >
                                                                        {/* 공유 트리 세로선 */}
                                                                        <span
                                                                            aria-hidden
                                                                            className="pointer-events-none absolute left-[14px] top-0 bottom-1/2 border-l border-dashed border-slate-200"
                                                                        />

                                                                        <div
                                                                            onClick={() =>
                                                                                handleClickCategory(
                                                                                    child.id,
                                                                                )
                                                                            }
                                                                            className={`relative flex cursor-pointer items-center justify-between rounded-lg pr-1.5 py-1 text-[13px] transition ${
                                                                                childActive
                                                                                    ? 'bg-fuchsia-50 text-fuchsia-800 font-semibold'
                                                                                    : 'text-slate-600 hover:bg-fuchsia-50/60'
                                                                            }`}
                                                                        >
                                                                            <div className="relative flex min-w-0 flex-1 items-center gap-1">
                                                                                <span
                                                                                    aria-hidden
                                                                                    className="pointer-events-none absolute -left-[18px] top-1/2 h-px w-[12px] -translate-y-1/2 border-t border-dashed border-slate-200"
                                                                                />
                                                                                <span
                                                                                    className="max-w-full truncate"
                                                                                    title={child.name}
                                                                                >
                                                                                    {
                                                                                        child.name
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            },
                                                        )}
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

            {/* 휴지통 버튼 */}
            <button
                type="button"
                onClick={() => navigate('/trash')}
                className={`mt-2 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition ${
                    isTrashActive
                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
                }`}
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
                confirmText={
                    deleteCategoryMutation.isLoading ? '삭제 중...' : '삭제'
                }
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
