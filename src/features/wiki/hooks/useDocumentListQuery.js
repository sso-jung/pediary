import { useCallback, useEffect, useState } from 'react';

const DOCUMENT_QUERY_STORAGE_PREFIX = 'pediary.documentList.query';
export const DOCUMENT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const DEFAULT_DOCUMENT_QUERY = {
    searchText: '',
    sortBy: 'created_at',
    sortDir: 'desc',
    onlyFavorites: false,
    favoriteFirst: true,
    page: 1,
    pageSize: 10,
};

function normalizeQuery(query) {
    const pageSize = Number(query.pageSize);
    const safePageSize = DOCUMENT_PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10;
    const page = Number(query.page);

    return {
        ...DEFAULT_DOCUMENT_QUERY,
        ...query,
        searchText: String(query.searchText ?? ''),
        sortBy: ['created_at', 'updated_at', 'title'].includes(query.sortBy)
            ? query.sortBy
            : DEFAULT_DOCUMENT_QUERY.sortBy,
        sortDir: ['asc', 'desc'].includes(query.sortDir)
            ? query.sortDir
            : DEFAULT_DOCUMENT_QUERY.sortDir,
        onlyFavorites: Boolean(query.onlyFavorites),
        favoriteFirst: query.favoriteFirst !== false,
        page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
        pageSize: safePageSize,
    };
}

function readStoredQuery(storageKey) {
    if (typeof window === 'undefined') return DEFAULT_DOCUMENT_QUERY;

    try {
        const stored = window.sessionStorage.getItem(storageKey);
        if (!stored) return DEFAULT_DOCUMENT_QUERY;

        return normalizeQuery({
            ...DEFAULT_DOCUMENT_QUERY,
            ...JSON.parse(stored),
        });
    } catch {
        return DEFAULT_DOCUMENT_QUERY;
    }
}

export function useDocumentListQuery(scope) {
    const storageKey = `${DOCUMENT_QUERY_STORAGE_PREFIX}.${scope}`;
    const [state, setState] = useState(() => ({
        storageKey,
        query: readStoredQuery(storageKey),
    }));
    const query = state.query;

    useEffect(() => {
        setState({
            storageKey,
            query: readStoredQuery(storageKey),
        });
    }, [storageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (state.storageKey !== storageKey) return;
        window.sessionStorage.setItem(storageKey, JSON.stringify(query));
    }, [state.storageKey, storageKey, query]);

    const updateQuery = useCallback((patch) => {
        setState((prevState) => {
            const prev = prevState.query;
            const nextPatch = typeof patch === 'function' ? patch(prev) : patch;
            const next = normalizeQuery({
                ...prev,
                ...nextPatch,
            });

            if (nextPatch && !Object.prototype.hasOwnProperty.call(nextPatch, 'page')) {
                next.page = 1;
            }

            return {
                ...prevState,
                query: next,
            };
        });
    }, []);

    return [query, updateQuery];
}
