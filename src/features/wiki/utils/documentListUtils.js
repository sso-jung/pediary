// src/features/wiki/utils/documentListUtils.js

export function sortAndFilterDocuments(docs, query, favoriteIds = new Set()) {
    if (!Array.isArray(docs)) return [];

    const {
        searchText,
        sortBy,
        sortDir,
        onlyFavorites,
        favoriteFirst = true,   // 🔹 기본값은 true (우선 정렬 켜진 상태)
    } = query;

    // 1) 검색어 필터
    let result = docs;
    if (searchText && searchText.trim()) {
        const lower = searchText.trim().toLowerCase();
        result = result.filter((doc) =>
            (doc.title || '').toLowerCase().includes(lower),
        );
    }

    // 2) 즐겨찾기만 보기 필터
    if (onlyFavorites) {
        result = result.filter((doc) => favoriteIds.has(doc.id));
    }

    // 3) 정렬
    const dir = sortDir === 'asc' ? 1 : -1;

    result = [...result].sort((a, b) => {
        const aFav = favoriteIds.has(a.id);
        const bFav = favoriteIds.has(b.id);

        // 🔹 즐겨찾기 우선 옵션이 켜져 있을 때만, 위로 올리기
        if (favoriteFirst && aFav !== bFav) {
            return aFav ? -1 : 1;
        }

        let vA;
        let vB;

        switch (sortBy) {
            case 'title':
                vA = (a.title || '').toLowerCase();
                vB = (b.title || '').toLowerCase();
                return vA < vB ? -1 * dir : vA > vB ? 1 * dir : 0;
            case 'created_at':
                vA = new Date(a.created_at).getTime();
                vB = new Date(b.created_at).getTime();
                return (vA - vB) * dir;
            case 'updated_at':
            default:
                vA = new Date(a.updated_at).getTime();
                vB = new Date(b.updated_at).getTime();
                return (vA - vB) * dir;
        }
    });

    return result;
}
