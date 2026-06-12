// Sidebar.jsx
import { useEffect, useState, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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

const CATEGORY_COLLAPSE_STORAGE_KEY_PREFIX = 'pediary.sidebar.categoryCollapsed';

function getCategoryCollapseStorageKey(userId) {
    return `${CATEGORY_COLLAPSE_STORAGE_KEY_PREFIX}:${userId || 'guest'}`;
}

function readCollapsedCategoryMap(storageKey) {
    try {
        return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
        return {};
    }
}

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

function SidebarCategoryTooltip({ tooltip }) {
    const tooltipRef = useRef(null);
    const [position, setPosition] = useState({
        left: 0,
        top: 0,
        arrowLeft: 0,
    });

    useLayoutEffect(() => {
        if (!tooltip) return;

        const el = tooltipRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const margin = 8;

        let left = tooltip.x - rect.width / 2;
        left = Math.max(
            margin,
            Math.min(left, window.innerWidth - rect.width - margin)
        );

        let top = tooltip.y - rect.height - 12;
        top = Math.max(margin, top);

        const arrowLeft = Math.max(
            10,
            Math.min(tooltip.x - left, rect.width - 10)
        );

        setPosition({
            left,
            top,
            arrowLeft,
        });
    }, [tooltip]);

    if (!tooltip) return null;

    return createPortal(
        <div
            ref={tooltipRef}
            className="pointer-events-none fixed z-[9999] rounded-lg px-3 py-2 text-[11px] font-semibold leading-snug text-white shadow-xl"
            style={{
                left: position.left,
                top: position.top,
                backgroundColor: 'rgb(30 41 59)',
                whiteSpace: 'nowrap',
                maxWidth: 'calc(100vw - 24px)',
            }}
        >
            {tooltip.text}

            <span
                aria-hidden
                className="absolute h-2 w-2 rotate-45"
                style={{
                    left: position.arrowLeft,
                    bottom: -4,
                    marginLeft: -4,
                    backgroundColor: 'rgb(30 41 59)',
                }}
            />
        </div>,
        document.body
    );
}

function TruncatedCategoryName({
    name,
    className = '',
    onDoubleClick,
    onTooltipShow,
    onTooltipMove,
    onTooltipHide,
}) {
    const textRef = useRef(null);
    const [isTruncated, setIsTruncated] = useState(false);

    const checkTruncated = useCallback(() => {
        const el = textRef.current;
        if (!el) return false;

        const next = el.scrollWidth > el.clientWidth + 1;
        setIsTruncated(next);
        return next;
    }, []);

    useEffect(() => {
        checkTruncated();

        const el = textRef.current;
        if (!el) return;

        let resizeObserver = null;

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(checkTruncated);
            resizeObserver.observe(el);
        }

        window.addEventListener('resize', checkTruncated);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', checkTruncated);
        };
    }, [name, checkTruncated]);

    const handleMouseEnter = (e) => {
        if (!checkTruncated()) return;

        onTooltipShow?.({
            text: name,
            x: e.clientX,
            y: e.clientY,
        });
    };

    const handleMouseMove = (e) => {
        if (!isTruncated && !checkTruncated()) return;

        onTooltipMove?.({
            text: name,
            x: e.clientX,
            y: e.clientY,
        });
    };

    return (
        <span
            ref={textRef}
            className={['max-w-full truncate', className].join(' ')}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={onTooltipHide}
            onFocus={checkTruncated}
            onDoubleClick={onDoubleClick}
        >
            {name}
        </span>
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
    const [dropIndicator, setDropIndicator] = useState(null);

    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const collapseStorageKey = useMemo(
        () => getCategoryCollapseStorageKey(user?.id),
        [user?.id]
    );

    const [loadedCollapseKey, setLoadedCollapseKey] = useState(collapseStorageKey);

    const [collapsedCategoryMap, setCollapsedCategoryMap] = useState(() =>
        readCollapsedCategoryMap(collapseStorageKey)
    );

    const navigate = useNavigate();
    const location = useLocation();

    const getCurrentCategoryId = () => {
        const match = location.pathname.match(/^\/category\/(\d+)/);
        if (!match) return null;
        return Number(match[1]);
    };
    const currentCategoryId = getCurrentCategoryId();

    const [categoryTooltip, setCategoryTooltip] = useState(null);

    const showCategoryTooltip = useCallback((tooltip) => {
        setCategoryTooltip(tooltip);
    }, []);

    const moveCategoryTooltip = useCallback((tooltip) => {
        setCategoryTooltip(tooltip);
    }, []);

    const hideCategoryTooltip = useCallback(() => {
        setCategoryTooltip(null);
    }, []);

    useEffect(() => {
        setCollapsedCategoryMap(readCollapsedCategoryMap(collapseStorageKey));
        setLoadedCollapseKey(collapseStorageKey);
    }, [collapseStorageKey]);

    useEffect(() => {
        if (loadedCollapseKey !== collapseStorageKey) return;

        try {
            localStorage.setItem(collapseStorageKey, JSON.stringify(collapsedCategoryMap));
        } catch {
            // localStorage 접근 불가 환경에서는 무시
        }
    }, [collapsedCategoryMap, collapseStorageKey, loadedCollapseKey]);

    const toggleCategoryCollapsed = (categoryId) => {
        setCollapsedCategoryMap((prev) => ({
            ...prev,
            [categoryId]: !prev[categoryId],
        }));
    };

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
            const parentId = c.parent_id ?? c.parentId ?? null;

            if (parentId == null) roots.push(c);
            else {
                const parentKey = String(parentId);
                if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
                childrenMap.get(parentKey).push(c);
            }
        });

        return { myRoots, myChildrenMap, friendRoots, friendChildrenMap };
    }, [categories, user]);

    const isRootActive = (rootId) => isCategoryActive(rootId);

    const handleDragStart = (categoryId) => setDraggingCategoryId(categoryId);
    const handleDragEnd = () => {
        setDraggingCategoryId(null);
        setDropIndicator(null);
    };
    const getDropPosition = (event, allowInside = true) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetY = event.clientY - rect.top;
        const ratio = offsetY / rect.height;

        if (ratio < 0.3) return 'before';
        if (ratio > 0.7) return 'after';

        return allowInside ? 'inside' : 'after';
    };

    const getNextSiblingId = (parentId, targetId, draggingId) => {
        if (!categories) return null;

        const siblings = categories.filter((c) => {
            const cParentId = c.parent_id ?? c.parentId ?? null;
            return cParentId === parentId && c.id !== draggingId;
        });

        const targetIndex = siblings.findIndex((c) => c.id === targetId);

        if (targetIndex < 0) return null;

        return siblings[targetIndex + 1]?.id ?? null;
    };

    const handleDragOverCategory = (targetCategory, event, allowInside = true) => {
        if (!draggingCategoryId || !targetCategory || !user) return;
        if (draggingCategoryId === targetCategory.id) return;

        const dragged = categories?.find((c) => c.id === draggingCategoryId);
        if (!dragged) return;

        // 내 카테고리만 이동 가능
        if (dragged.user_id !== user.id) return;
        if (targetCategory.user_id !== user.id) return;

        event.preventDefault();
        event.stopPropagation();

        const position = getDropPosition(event, allowInside);

        setDropIndicator({
            targetId: targetCategory.id,
            position,
        });
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
        setDropIndicator(null);
    };

    const handleDropOnCategory = (targetCategory, event, allowInside = true) => {
        if (!draggingCategoryId || !categories || !user || !targetCategory) return;

        event.preventDefault();
        event.stopPropagation();

        const dragged = categories.find((c) => c.id === draggingCategoryId);
        const target = targetCategory;

        if (!dragged || !target) {
            setDraggingCategoryId(null);
            setDropIndicator(null);
            return;
        }

        if (dragged.user_id !== user.id || target.user_id !== user.id) {
            setDraggingCategoryId(null);
            setDropIndicator(null);
            return;
        }

        if (dragged.id === target.id) {
            setDraggingCategoryId(null);
            setDropIndicator(null);
            return;
        }

        const draggedParentId = dragged.parent_id ?? dragged.parentId ?? null;
        const targetParentId = target.parent_id ?? target.parentId ?? null;

        const position =
            dropIndicator?.targetId === target.id
                ? dropIndicator.position
                : getDropPosition(event, allowInside);

        let nextParentId = targetParentId;
        let beforeCategoryId = null;

        if (position === 'inside') {
            // root 안으로 넣기
            nextParentId = target.id;
            beforeCategoryId = null;
        } else if (position === 'before') {
            // target 바로 위
            nextParentId = targetParentId;
            beforeCategoryId = target.id;
        } else if (position === 'after') {
            // target 바로 아래
            nextParentId = targetParentId;
            beforeCategoryId = getNextSiblingId(targetParentId, target.id, dragged.id);
        }

        // 2depth로 들어가는 경우: 하위 카테고리가 있는 애는 막기
        const hasChildren = categories.some((c) => {
            const parentId = c.parent_id ?? c.parentId ?? null;
            return parentId === dragged.id;
        });

        if (hasChildren && nextParentId !== null) {
            showSnackbar('하위 카테고리가 있는 카테고리는 2depth로 옮길 수 없어.');
            setDraggingCategoryId(null);
            setDropIndicator(null);
            return;
        }

        // 같은 위치면 무시
        if (
            draggedParentId === nextParentId &&
            beforeCategoryId === dragged.id
        ) {
            setDraggingCategoryId(null);
            setDropIndicator(null);
            return;
        }

        moveCategoryMutation.mutate({
            categoryId: dragged.id,
            parentId: nextParentId,
            beforeCategoryId,
        });

        setDraggingCategoryId(null);
        setDropIndicator(null);
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
        <div className="flex h-full min-h-0 flex-col gap-4 p-3">

            {/* ✅ 입력: ui-input 토큰 사용 */}
            <form onSubmit={handleAddCategory} className="shrink-0 space-y-2">
                <input
                    type="text"
                    className="ui-input doc-border-control w-full px-3 py-2 text-xs"
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
            <div className="ui-sidebar-scroll ui-surface mt-2 min-h-0 flex-1 overflow-y-auto rounded-2xl py-2.5 px-1.5 shadow-soft">
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
                                onDragOver={(e) => handleDragOverCategory(root, e, true)}
                                onDragLeave={() => {
                                    setDropIndicator((prev) =>
                                        prev?.targetId === root.id ? null : prev
                                    );
                                }}
                                onDrop={(e) => handleDropOnCategory(root, e, true)}
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
                                            const children = myChildrenMap.get(String(root.id)) || [];
                                            const isLastRoot = idx === myRoots.length - 1;
                                            const isCollapsed = !!collapsedCategoryMap[root.id];

                                            return (
                                                <li key={root.id} className="relative pl-3">
                                                    {/* ✅ 세로선: ui-tree-line */}
                                                    <span
                                                        aria-hidden
                                                        className={[
                                                            "pointer-events-none absolute left-[9px] border-l ui-tree-line",
                                                            isLastRoot ? "top-0 h-[14px]" : "top-0 bottom-0",
                                                        ].join(" ")}
                                                    />
                                                    {dropIndicator?.targetId === root.id && dropIndicator.position === 'before' && (
                                                        <span
                                                                aria-hidden
                                                                className="pointer-events-none absolute left-3 right-2 top-0 z-10 border-t border-dashed"
                                                                style={{
                                                                    borderTopWidth: '1px',
                                                                    borderTopColor: 'rgba(124, 140, 167, 0.55)',
                                                                }}
                                                            />
                                                    )}
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
                                                            dropIndicator?.targetId === root.id && dropIndicator.position === 'inside'
                                                                    ? "ui-side-drop"
                                                                    : "",
                                                        ].join(" ")}
                                                    >
                                                        <div className="relative flex min-w-0 flex-1 items-center gap-1">
                                                            {/* ✅ 가로선: ui-tree-branch (너 index.css 기준) */}
                                                            <span aria-hidden className="ui-tree-branch -left-[8px] w-[8px]" />
                                                            {children.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleCategoryCollapsed(root.id);
                                                                    }}
                                                                    className="ui-side-icon flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded hover:bg-[var(--color-panel-bg)]"
                                                                    aria-label={isCollapsed ? '카테고리 펼치기' : '카테고리 접기'}
                                                                >
                                                                    <svg
                                                                        viewBox="0 0 16 16"
                                                                        className={[
                                                                            "h-2.5 w-2.5 transition-transform",
                                                                            isCollapsed ? "-rotate-90" : "",
                                                                        ].join(" ")}
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="1.8"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        aria-hidden="true"
                                                                    >
                                                                        <path d="M4 6l4 4 4-4" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {children.length === 0 && (
                                                                <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                            )}
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
                                                                <TruncatedCategoryName
                                                                    name={root.name}
                                                                    className="text-[12.5px]"
                                                                    onTooltipShow={showCategoryTooltip}
                                                                    onTooltipMove={moveCategoryTooltip}
                                                                    onTooltipHide={hideCategoryTooltip}
                                                                    onDoubleClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEditingCategory(root);
                                                                    }}
                                                                />
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

                                                    {dropIndicator?.targetId === root.id && dropIndicator.position === 'after' && (
                                                        <span
                                                                aria-hidden
                                                                className="pointer-events-none absolute left-3 right-2 bottom-0 z-10 border-t border-dashed"
                                                                style={{
                                                                    borderTopWidth: '1px',
                                                                    borderTopColor: 'rgba(124, 140, 167, 0.55)',
                                                                }}
                                                            />
                                                    )}

                                                    {/* 2depth */}
                                                    {children.length > 0 && !isCollapsed && (
                                                        <ul className="mt-[2px] space-y-[2px]">
                                                            {children.map((child, cIdx) => {
                                                                const childActive = isCategoryActive(child.id);
                                                                const isMineChild = child.user_id === user?.id;
                                                                const isLastChild = cIdx === children.length - 1;

                                                                return (
                                                                    <li key={child.id} className="relative pl-4">
                                                                        {/* ✅ 세로선 */}
                                                                        <span
                                                                            aria-hidden
                                                                            className={[
                                                                                "pointer-events-none absolute left-[9px] border-l ui-tree-line",
                                                                                isLastChild ? "top-0 bottom-1/2" : "top-0 bottom-0",
                                                                            ].join(" ")}
                                                                        />
                                                                        {dropIndicator?.targetId === child.id && dropIndicator.position === 'before' && (
                                                                            <span
                                                                                    aria-hidden
                                                                                    className="pointer-events-none absolute left-4 right-2 top-0 z-10 border-t border-dashed"
                                                                                    style={{
                                                                                        borderTopWidth: '1px',
                                                                                        borderTopColor: 'rgba(124, 140, 167, 0.55)',
                                                                                    }}
                                                                                />
                                                                        )}
                                                                        <div
                                                                            onClick={() => handleClickCategory(child.id)}
                                                                            draggable={isMineChild}
                                                                            onDragStart={() => isMineChild && handleDragStart(child.id)}
                                                                            onDragEnd={handleDragEnd}
                                                                            onDragOver={(e) => handleDragOverCategory(child, e, false)}
                                                                            onDragLeave={() => {
                                                                                setDropIndicator((prev) =>
                                                                                    prev?.targetId === child.id ? null : prev
                                                                                );
                                                                            }}
                                                                            onDrop={(e) => handleDropOnCategory(child, e, false)}
                                                                            className={[
                                                                                "ui-side-subitem group",
                                                                                childActive ? "ui-side-item-active" : "",
                                                                                draggingCategoryId === child.id ? "opacity-60" : "",
                                                                            ].join(" ")}
                                                                        >
                                                                            <div className="relative flex min-w-0 flex-1 items-center gap-1">
                                                                                {/* ✅ 가로선 */}
                                                                                <span aria-hidden className="ui-tree-branch -left-[11px] w-[7px]" />

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
                                                                                    <TruncatedCategoryName
                                                                                        name={child.name}
                                                                                        className="text-[11.5px]"
                                                                                        onTooltipShow={showCategoryTooltip}
                                                                                        onTooltipMove={moveCategoryTooltip}
                                                                                        onTooltipHide={hideCategoryTooltip}
                                                                                        onDoubleClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            startEditingCategory(child);
                                                                                        }}
                                                                                    />
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

                                                                        {dropIndicator?.targetId === child.id && dropIndicator.position === 'after' && (
                                                                            <span
                                                                                    aria-hidden
                                                                                    className="pointer-events-none absolute left-4 right-2 bottom-0 z-10 border-t border-dashed"
                                                                                    style={{
                                                                                        borderTopWidth: '1px',
                                                                                        borderTopColor: 'rgba(124, 140, 167, 0.55)',
                                                                                    }}
                                                                                />
                                                                        )}
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
                                        const children = friendChildrenMap.get(String(root.id)) || [];
                                        const isCollapsed = !!collapsedCategoryMap[root.id];

                                        return (
                                            <li key={root.id} className="space-y-[2px]">
                                                <div
                                                    onClick={() => handleClickCategory(root.id)}
                                                    className={[
                                                        "ui-side-item",
                                                        rootActive ? "ui-side-item-active" : "",
                                                    ].join(" ")}
                                                >
                                                    {children.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleCategoryCollapsed(root.id);
                                                            }}
                                                            className="ui-side-icon flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded hover:bg-[var(--color-panel-bg)]"
                                                            aria-label={isCollapsed ? '카테고리 펼치기' : '카테고리 접기'}
                                                        >
                                                            <svg
                                                                viewBox="0 0 16 16"
                                                                className={[
                                                                    "h-2.5 w-2.5 transition-transform",
                                                                    isCollapsed ? "-rotate-90" : "",
                                                                ].join(" ")}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="1.8"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                aria-hidden="true"
                                                            >
                                                                <path d="M4 6l4 4 4-4" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {children.length === 0 && (
                                                        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                    )}
                                                    <FolderIcon className={rootActive ? "ui-side-icon-active" : "ui-side-icon"} />
                                                    <TruncatedCategoryName
                                                        name={root.name}
                                                        className="text-[12.5px]"
                                                        onTooltipShow={showCategoryTooltip}
                                                        onTooltipMove={moveCategoryTooltip}
                                                        onTooltipHide={hideCategoryTooltip}
                                                    />
                                                    <span className="ml-1 ui-badge-fixed px-2 py-[1px] text-[10px]">
                            공유받음
                          </span>
                                                </div>

                                                {children.length > 0 && !isCollapsed && (
                                                    <ul className="mt-[2px] space-y-[2px]">
                                                        {children.map((child) => {
                                                            const childActive = isCategoryActive(child.id);

                                                            return (
                                                                <li key={child.id} className="relative pl-4">
                                  <span
                                      aria-hidden
                                      className="pointer-events-none absolute left-[9px] top-0 bottom-1/2 border-l ui-tree-line"
                                  />
                                                                    <div
                                                                        onClick={() => handleClickCategory(child.id)}
                                                                        className={[
                                                                            "ui-side-subitem",
                                                                            childActive ? "ui-side-item-active" : "",
                                                                        ].join(" ")}
                                                                    >
                                                                        <div className="relative flex min-w-0 flex-1 items-center gap-1">
                                                                            <span aria-hidden className="ui-tree-branch -left-[11px] w-[7px]" />
                                                                            <TruncatedCategoryName
                                                                                name={child.name}
                                                                                onTooltipShow={showCategoryTooltip}
                                                                                onTooltipMove={moveCategoryTooltip}
                                                                                onTooltipHide={hideCategoryTooltip}
                                                                            />
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
                    "ui-surface shrink-0 rounded-2xl border px-3 py-2 text-xs font-medium transition flex items-center gap-2",
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

            <SidebarCategoryTooltip tooltip={categoryTooltip} />
        </div>
    );
}
