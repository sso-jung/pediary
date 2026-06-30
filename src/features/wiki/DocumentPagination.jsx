import { DOCUMENT_PAGE_SIZE_OPTIONS } from './hooks/useDocumentListQuery';

function getPageNumbers(page, pageCount) {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, page - half);
    const end = Math.min(pageCount, start + maxVisible - 1);

    start = Math.max(1, end - maxVisible + 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function DocumentPagination({
                                               totalCount,
                                               page,
                                               pageSize,
                                               onChange,
                                           }) {
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(Math.max(1, page), pageCount);
    const startNo = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endNo = Math.min(totalCount, currentPage * pageSize);
    const pageNumbers = getPageNumbers(currentPage, pageCount);

    const movePage = (nextPage) => {
        if (nextPage < 1 || nextPage > pageCount || nextPage === currentPage) return;
        onChange({ page: nextPage });
    };

    return (
        <div className="mt-[15px] flex flex-wrap items-center gap-1.5 text-[10px] sm:mt-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-2 sm:text-[11px] sm:items-center">
            <div className="flex shrink-0 justify-start">
                <label className="inline-flex items-center gap-1.5 ui-doc-meta">
                    <span>페이지당</span>
                    <select
                        className="h-7 rounded-full border px-2 text-[10px] outline-none sm:text-[11px]"
                        style={{
                            backgroundColor: 'var(--color-page-surface)',
                            borderColor: 'var(--color-panel-border)',
                            color: 'var(--color-text-muted)',
                        }}
                        value={pageSize}
                        onChange={(e) => onChange({ pageSize: Number(e.target.value), page: 1 })}
                    >
                        {DOCUMENT_PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                                {size}개
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-1 sm:justify-center">
                <button
                    type="button"
                    className="ui-doc-action rounded-full border px-1.5 py-1 disabled:opacity-40 sm:px-2"
                    style={{ borderColor: 'var(--color-panel-border)' }}
                    disabled={currentPage <= 1}
                    onClick={() => movePage(1)}
                >
                    처음
                </button>

                <button
                    type="button"
                    className="ui-doc-action rounded-full border px-1.5 py-1 disabled:opacity-40 sm:px-2"
                    style={{ borderColor: 'var(--color-panel-border)' }}
                    disabled={currentPage <= 1}
                    onClick={() => movePage(currentPage - 1)}
                >
                    이전
                </button>

                {pageNumbers.map((pageNo) => (
                    <button
                        key={pageNo}
                        type="button"
                        className={
                            'rounded-full border px-1.5 py-1 transition sm:px-2 ' +
                            (pageNo === currentPage ? '' : 'hidden sm:inline-flex ') +
                            (pageNo === currentPage
                                ? 'ui-side-subitem-active font-semibold'
                                : 'ui-doc-action')
                        }
                        style={{ borderColor: 'var(--color-panel-border)' }}
                        onClick={() => movePage(pageNo)}
                    >
                        {pageNo}
                    </button>
                ))}

                <button
                    type="button"
                    className="ui-doc-action rounded-full border px-1.5 py-1 disabled:opacity-40 sm:px-2"
                    style={{ borderColor: 'var(--color-panel-border)' }}
                    disabled={currentPage >= pageCount}
                    onClick={() => movePage(currentPage + 1)}
                >
                    다음
                </button>

                <button
                    type="button"
                    className="ui-doc-action rounded-full border px-1.5 py-1 disabled:opacity-40 sm:px-2"
                    style={{ borderColor: 'var(--color-panel-border)' }}
                    disabled={currentPage >= pageCount}
                    onClick={() => movePage(pageCount)}
                >
                    마지막
                </button>
            </div>

            <div className="ui-doc-meta basis-full text-left text-[11px] sm:basis-auto sm:text-right">
                {startNo}-{endNo} / 총 {totalCount}개
            </div>
        </div>
    );
}
