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
        p-2.5 sm:p-2.5
        sm:flex-row sm:items-center sm:justify-between
      "
        >
            {/* 왼쪽: 검색어 */}
            <div className="min-w-0 flex-1">
                <Input
                    placeholder="문서 제목 검색"
                    className="
            h-8 sm:h-8
            text-[12px] sm:text-[13px]
            rounded-full
            px-2.5 py-[3px] sm:px-3
            shadow-none
          "
                    value={searchText}
                    onChange={(e) => handleChange({ searchText: e.target.value })}
                />
            </div>

            {/* 오른쪽: 정렬 + 즐겨찾기 필터 */}
            <div className="mt-1 flex flex-nowrap items-center gap-1 text-[10px] sm:mt-0 sm:flex-wrap sm:justify-end sm:gap-2.5 sm:text-[11px]">
                <span className="df-muted mr-0.5 hidden text-[10px] sm:inline sm:text-[11px]">정렬</span>

                <select
                    className="
            h-7 sm:h-8
            rounded-full
            w-[76px] px-2 text-[10px] sm:w-auto sm:px-2 sm:text-[11px]
            outline-none
          "
                    value={sortBy}
                    onChange={(e) => handleChange({ sortBy: e.target.value })}
                >
                    <option value="created_at">생성일시</option>
                    <option value="updated_at">수정일시</option>
                    <option value="title">제목</option>
                </select>

                <select
                    className="
            h-7 sm:h-8
            rounded-full
            w-[72px] px-2 text-[10px] sm:w-auto sm:px-2 sm:text-[11px]
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
                    <div className="flex items-center gap-1 sm:gap-2">
                        <label
                            className="
                df-pill
                inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full
                px-0 py-0 text-[10px] sm:h-auto sm:w-auto sm:gap-1 sm:px-2 sm:py-[3px] sm:text-[11px]
              "
                            title="즐겨찾기 우선"
                        >
                            <input
                                type="checkbox"
                                className="sr-only sm:not-sr-only sm:h-3 sm:w-3"
                                checked={favoriteFirst}
                                onChange={(e) => handleChange({ favoriteFirst: e.target.checked })}
                            />
                            <svg
                                viewBox="0 0 20 20"
                                className="h-3.5 w-3.5 sm:hidden"
                                fill={favoriteFirst ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeWidth="1.6"
                                aria-hidden="true"
                            >
                                <path d="m10 2.8 2.1 4.2 4.6.7-3.3 3.2.8 4.6-4.2-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.7L10 2.8Z" />
                                <path d="M14.5 15.5h3" />
                                <path d="M16 14v3" />
                            </svg>
                            <span className="hidden sm:inline">즐겨찾기 우선</span>
                        </label>

                        <label
                            className="
                df-pill
                inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full
                px-0 py-0 text-[10px] sm:h-auto sm:w-auto sm:gap-1 sm:px-2 sm:py-[3px] sm:text-[11px]
              "
                            title="즐겨찾기만"
                        >
                            <input
                                type="checkbox"
                                className="sr-only sm:not-sr-only sm:h-3 sm:w-3"
                                checked={onlyFavorites}
                                onChange={(e) => handleChange({ onlyFavorites: e.target.checked })}
                            />
                            <svg
                                viewBox="0 0 20 20"
                                className="h-3.5 w-3.5 sm:hidden"
                                fill={onlyFavorites ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeWidth="1.6"
                                aria-hidden="true"
                            >
                                <path d="m10 2.8 2.1 4.2 4.6.7-3.3 3.2.8 4.6-4.2-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.7L10 2.8Z" />
                            </svg>
                            <span className="hidden sm:inline">즐겨찾기만</span>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}
