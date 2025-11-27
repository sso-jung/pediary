// src/features/wiki/DocumentFilterBar.jsx
import Input from '../../components/ui/Input';

export default function DocumentFilterBar({
                                              value,
                                              onChange,
                                              showFavoritesFilter = true,
                                          }) {
    const { searchText, sortBy, sortDir, onlyFavorites, favoriteFirst } = value;

    const handleChange = (patch) => {
        onChange({ ...value, ...patch });
    };

    const isTitleSort = sortBy === 'title';

    return (
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            {/* 왼쪽: 검색어 */}
            <div className="flex-1">
                <Input
                    placeholder="문서 제목 검색"
                    // 🔹 좀 더 얄쌍하고 각진 느낌으로
                    className="h-8 text-[13px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1 shadow-none focus:bg-white focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                    value={searchText}
                    onChange={(e) => handleChange({ searchText: e.target.value })}
                />
            </div>

            {/* 오른쪽: 정렬 + 즐겨찾기 필터 */}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-600 sm:mt-0 sm:justify-end">
                <span className="text-[11px] text-slate-500">정렬</span>

                {/* 무엇으로 정렬할지 */}
                <select
                    className="h-8 rounded-full border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                    value={sortBy}
                    onChange={(e) => handleChange({ sortBy: e.target.value })}
                >
                    <option value="updated_at">수정일시</option>
                    <option value="created_at">생성일시</option>
                    <option value="title">제목</option>
                </select>

                {/* 방향: 제목이면 오름/내림, 날짜면 최신/오래된 */}
                <select
                    className="h-8 rounded-full border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                    value={sortDir}
                    onChange={(e) => handleChange({ sortDir: e.target.value })}
                >
                    {isTitleSort ? (
                        <>
                            <option value="asc">오름차순</option>
                            <option value="desc">내림차순</option>
                        </>
                    ) : (
                        <>
                            <option value="desc">최신 순</option>
                            <option value="asc">오래된 순</option>
                        </>
                    )}
                </select>

                {showFavoritesFilter && (
                    <div className="flex items-center gap-2">
                        {/* 🔹 즐겨찾기 우선 옵션 */}
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-slate-50 px-2 py-[3px]">
                            <input
                                type="checkbox"
                                className="h-3 w-3"
                                checked={favoriteFirst}
                                onChange={(e) =>
                                    handleChange({ favoriteFirst: e.target.checked })
                                }
                            />
                            <span>즐겨찾기 우선</span>
                        </label>

                        {/* 🔹 즐겨찾기만 보기 옵션 */}
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-slate-50 px-2 py-[3px]">
                            <input
                                type="checkbox"
                                className="h-3 w-3"
                                checked={onlyFavorites}
                                onChange={(e) =>
                                    handleChange({ onlyFavorites: e.target.checked })
                                }
                            />
                            <span>즐겨찾기만</span>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}
