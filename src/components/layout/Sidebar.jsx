import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCategories } from '../../features/wiki/hooks/useCategories';
import { useCreateCategory } from '../../features/wiki/hooks/useCreateCategory';
import Button from '../ui/Button';

export default function Sidebar() {
    const { data: categories, isLoading } = useCategories();
    const createCategoryMutation = useCreateCategory();

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
                        {categories.map((cat) => {
                            const active = getIsActive(cat.id);
                            return (
                                <li
                                    key={cat.id}
                                    onClick={() => handleClickCategory(cat.id)}
                                    className={`rounded-lg px-2 py-1 cursor-pointer transition ${
                                        active
                                            ? 'bg-primary-100 text-primary-700 font-medium'
                                            : 'text-slate-700 hover:bg-primary-50'
                                    }`}
                                >
                                    {cat.name}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
