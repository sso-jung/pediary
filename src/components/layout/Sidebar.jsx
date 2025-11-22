// src/components/layout/Sidebar.jsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCategories } from '../../features/wiki/hooks/useCategories';
import { useCreateCategory } from '../../features/wiki/hooks/useCreateCategory';
import { useAuthStore } from '../../store/authStore';
import Button from '../ui/Button';

export default function Sidebar() {
    const { data: categories, isLoading } = useCategories();
    const createCategoryMutation = useCreateCategory();
    const user = useAuthStore((s) => s.user);

    const [newCategoryName, setNewCategoryName] = useState('');

    const navigate = useNavigate();
    const location = useLocation();

    const handleAddCategory = (e) => {
        e.preventDefault();
        const name = newCategoryName.trim();
        if (!name) return;

        createCategoryMutation.mutate(
            { name },
            {
                onSuccess: () => {
                    setNewCategoryName('');
                },
            },
        );
    };

    const handleClickCategory = (catId) => {
        navigate(`/category/${catId}`);
    };

    const getIsActive = (catId) => {
        return location.pathname.startsWith(`/category/${catId}`);
    };

    const isAllActive = location.pathname === '/docs';
    const isTrashActive = location.pathname === '/trash';

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            {/* 카드 헤더 */}
            <div className="rounded-2xl bg-primary-50 p-3 text-sm text-slate-700 shadow-soft">
                <p className="font-semibold">목차</p>
                <p className="mt-1 text-xs text-slate-500">
                    카테고리를 만들고 그 안에 문서를 정리해 보자.
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
            <div className="mt-2 flex-1 overflow-y-auto rounded-2xl bg-white p-3 shadow-soft">
                {isLoading ? (
                    <p className="text-xs text-slate-500">카테고리를 불러오는 중...</p>
                ) : !categories || categories.length === 0 ? (
                    <p className="text-xs text-slate-400">
                        아직 카테고리가 없어. 위에서 하나 추가해 볼까?
                    </p>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {/* 🔹 맨 위 '전체' */}
                        <li
                            onClick={() => navigate('/docs')}
                            className={`rounded-lg px-2 py-1 cursor-pointer transition ${
                                isAllActive
                                    ? 'bg-primary-100 text-primary-700 font-medium'
                                    : 'text-slate-700 hover:bg-primary-50'
                            }`}
                        >
                            전체
                        </li>

                        {categories.map((cat) => {
                            const active = getIsActive(cat.id);
                            const isMine = cat.user_id === user?.id;

                            return (
                                <li
                                    key={cat.id}
                                    onClick={() => handleClickCategory(cat.id)}
                                    className={`flex items-center justify-between rounded-lg px-2 py-1 cursor-pointer transition ${
                                        active
                                            ? 'bg-primary-100 text-primary-700 font-medium'
                                            : 'text-slate-700 hover:bg-primary-50'
                                    }`}
                                >
                                    <span>{cat.name}</span>

                                    {!isMine && (
                                        <span className="ml-2 inline-flex items-center rounded-full bg-fuchsia-50 px-2 py-[1px] text-[10px] text-fuchsia-700">
                                            친구 공유
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* 🔹 휴지통 버튼 */}
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
        </div>
    );
}
