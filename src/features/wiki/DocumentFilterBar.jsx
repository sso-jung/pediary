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
        <div
            className="
        doc-filterbar
        flex flex-col gap-2 rounded-2xl
        p-2.5 sm:p-3
        sm:flex-row sm:items-center sm:justify-between
      "
        >
            {/* 왼쪽: 검색어 */}
            <div className="flex-1">
                <Input
                    placeholder="문서 제목 검색"
                    className="
            h-7 sm:h-8
            text-[12px] sm:text-[13px]
            rounded-md
            px-2.5 py-[3px] sm:px-3
            shadow-none
          "
                    value={searchText}
                    onChange={(e) => handleChange({ searchText: e.target.value })}
                />
            </div>

            {/* 오른쪽: 정렬 + 즐겨찾기 필터 */}
            <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[10px] sm:mt-0 sm:justify-end sm:text-[11px]">
                <span className="df-muted text-[10px] sm:text-[11px]">정렬</span>

                <select
                    className="
            h-7 sm:h-8
            rounded-full
            px-2 text-[10px] sm:text-[11px]
            outline-none
          "
                    value={sortBy}
                    onChange={(e) => handleChange({ sortBy: e.target.value })}
                >
                    <option value="updated_at">수정일시</option>
                    <option value="created_at">생성일시</option>
                    <option value="title">제목</option>
                </select>

                <select
                    className="
            h-7 sm:h-8
            rounded-full
            px-2 text-[10px] sm:text-[11px]
            outline-none
          "
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
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <label
                            className="
                df-pill
                inline-flex cursor-pointer items-center gap-1 rounded-full
                px-2 py-[3px] text-[10px] sm:text-[11px]
              "
                        >
                            <input
                                type="checkbox"
                                className="h-3 w-3"
                                checked={favoriteFirst}
                                onChange={(e) => handleChange({ favoriteFirst: e.target.checked })}
                            />
                            <span>즐겨찾기 우선</span>
                        </label>

                        <label
                            className="
                df-pill
                inline-flex cursor-pointer items-center gap-1 rounded-full
                px-2 py-[3px] text-[10px] sm:text-[11px]
              "
                        >
                            <input
                                type="checkbox"
                                className="h-3 w-3"
                                checked={onlyFavorites}
                                onChange={(e) => handleChange({ onlyFavorites: e.target.checked })}
                            />
                            <span>즐겨찾기만</span>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}
