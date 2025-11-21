// src/features/wiki/WikiQuickSearch.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllDocuments } from './hooks/useAllDocuments';

export default function WikiQuickSearch() {
    const navigate = useNavigate();
    const { data: allDocs } = useAllDocuments();

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);

    // 🔹 Ctrl+K (또는 Cmd+K) 로 열기
    useEffect(() => {
        const handleKey = (e) => {
            const isCmdOrCtrl = e.metaKey || e.ctrlKey;
            if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }

            if (isOpen && e.key === 'Escape') {
                e.preventDefault();
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    const filteredDocs = useMemo(() => {
        const list = allDocs || [];
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((doc) => {
            const title = doc.title?.toLowerCase() || '';
            const slug = doc.slug?.toLowerCase() || '';
            return title.includes(q) || slug.includes(q);
        });
    }, [allDocs, query]);

    const handleSelect = (doc) => {
        if (!doc) return;
        setIsOpen(false);
        setQuery('');
        setHighlightIndex(0);
        navigate(`/wiki/${doc.slug}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 pt-24">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-800">
                            문서 검색
                        </h2>
                        <span className="rounded-full bg-slate-100 px-2 py-[2px] text-[10px] text-slate-500">
                            Ctrl+K
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                        제목이나 슬러그로 검색해. ↑↓ / Enter / Esc
                    </p>
                </div>

                <div className="px-4 py-3">
                    <input
                        autoFocus
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                        placeholder="검색어를 입력해..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setHighlightIndex(0);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setHighlightIndex((prev) => {
                                    if (filteredDocs.length === 0) return 0;
                                    return (prev + 1) % filteredDocs.length;
                                });
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setHighlightIndex((prev) => {
                                    if (filteredDocs.length === 0) return 0;
                                    return (
                                        (prev - 1 + filteredDocs.length) %
                                        filteredDocs.length
                                    );
                                });
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                const doc = filteredDocs[highlightIndex];
                                if (doc) handleSelect(doc);
                            }
                        }}
                    />

                    <div className="mt-2 max-h-72 overflow-y-auto pt-1">
                        {filteredDocs.length === 0 ? (
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-400">
                                일치하는 문서가 없어.
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100 text-sm">
                                {filteredDocs.map((doc, idx) => (
                                    <li
                                        key={doc.id}
                                        onClick={() => handleSelect(doc)}
                                        className={
                                            'flex cursor-pointer items-center justify-between px-3 py-2 ' +
                                            (idx === highlightIndex
                                                ? 'bg-slate-100'
                                                : 'hover:bg-slate-50')
                                        }
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate font-medium text-slate-800">
                                                {doc.title}
                                            </div>
                                            <div className="truncate text-[11px] text-slate-400">
                                                /wiki/{doc.slug}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
