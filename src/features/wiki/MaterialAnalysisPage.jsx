// src/features/wiki/MaterialAnalysisPage.jsx
import { useRef, useState, useEffect } from 'react';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import { useAuthStore } from '../../store/authStore';
import { extractMaterialFromPdfWithAi } from '../../lib/materialPdfParser';
import { downloadMaterialGridExcel } from '../../lib/exportMaterialGridExcel';
import { supabase } from '../../lib/supabaseClient';
import { useMaterialGrid } from './hooks/useMaterialGrid';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const ADMIN_USER_IDS = [
    '1a39ccd8-775f-480e-a03a-a11d6a6cebe4',
    'ee98923e-c31e-4fcc-973f-5026bccb196b',
];

// 🔹 useMaterialGrid와 같은 버킷 이름
const PDF_BUCKET = 'material-pdfs';

export default function MaterialAnalysisPage() {
    const { showSnackbar } = useSnackbar();
    const user = useAuthStore((s) => s.user);

    // ✅ DB에서 읽어오는 훅 (refetch 포함)
    const { data: gridData, loading: gridLoading, refetch } = useMaterialGrid();

    const fileInputRef = useRef(null);

    const [columns, setColumns] = useState([
        { key: 'originalFileName', label: '원본 파일명', hiddenInGrid: true },
        { key: 'materialName', label: '물질명' },
        { key: 'brandName', label: '상표명' },
        // { key: 'materialType', label: '물질 종류' },
    ]);
    const [rows, setRows] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const visibleColumns = columns.filter((c) => !c.hiddenInGrid);

    const handleClickUpload = () => {
        fileInputRef.current?.click();
    };

    // ✅ 업로드 시: 로컬 setRows로 직접 추가 ❌, DB/Storage 처리 후 refetch ✅
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!user) {
            showSnackbar?.('로그인 후에 업로드할 수 있어.');
            return;
        }

        setUploading(true);
        try {
            // 🔹 현재까지 DB에 있는 property 컬럼들
            const existingColumns = gridData?.columns ?? [];

            // 1) AI 분석 + DB insert (parse-material-sheet)
            const parsed = await extractMaterialFromPdfWithAi(file, user, existingColumns);

            const originalFileName = file.name;

            // 2) PDF를 Supabase Storage에 업로드 (경로 = 파일명)
            const { error: uploadError } = await supabase.storage
                .from(PDF_BUCKET)
                .upload(originalFileName, file, {
                    upsert: true,
                });

            if (uploadError) {
                console.error('PDF upload error:', uploadError);
                showSnackbar?.('PDF 파일 업로드 중 오류가 났어.');
            }

            // 3) DB 다시 조회해서 grid 갱신
            await refetch();

            showSnackbar?.('PDF를 분석해서 자료에 추가했어.');
        } catch (err) {
            console.error(err);
            showSnackbar?.('PDF를 분석하는 중 오류가 났어. 파일 형식을 확인해줘.');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleOpenPdf = (row) => {
        if (!row?.pdfUrl) return;
        window.open(row.pdfUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDownloadExcel = async () => {
        if (!rows.length) {
            showSnackbar?.('엑셀로 내보낼 자료가 아직 없어.');
            return;
        }
        try {
            setDownloading(true);
            await downloadMaterialGridExcel(rows, columns);
            showSnackbar?.('자료 분석 결과를 엑셀로 내려받았어.');
        } catch (err) {
            console.error(err);
            showSnackbar?.('엑셀 내보내기에 실패했어. 잠시 후 다시 시도해줘.');
        } finally {
            setDownloading(false);
        }
    };

    const toggleRowSelection = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const hasRows = rows.length > 0;
    const allSelected = hasRows && selectedIds.length === rows.length;

    const toggleAllSelection = () => {
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(rows.map((r) => r.id));
        }
    };

    // 삭제 버튼 클릭 시: 단순히 confirm open
    const handleClickDelete = () => {
        if (!selectedIds.length) return;
        setConfirmDeleteOpen(true);
    };

    const handleCancelDelete = () => {
        setConfirmDeleteOpen(false);
    };

    // ✅ 실제 삭제 (DB 하드 삭제 + 화면 반영)
    const handleConfirmDelete = async () => {
        if (!selectedIds.length) {
            setConfirmDeleteOpen(false);
            return;
        }

        if (!user) {
            showSnackbar?.('로그인 후에 삭제할 수 있어.');
            setConfirmDeleteOpen(false);
            return;
        }

        const isAdmin = ADMIN_USER_IDS.includes(user.id);

        try {
            let query = supabase.from('material_sheets').delete();

            if (isAdmin) {
                query = query.in('id', selectedIds);
            } else {
                query = query.in('id', selectedIds).eq('user_id', user.id);
            }

            const { error } = await query;

            if (error) {
                console.error('delete error:', error);
                showSnackbar?.('삭제 중 오류가 발생했어.');
                setConfirmDeleteOpen(false);
                return;
            }

            setRows((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
            setSelectedIds([]);
            showSnackbar?.('선택한 데이터가 삭제됐어.');
        } catch (err) {
            console.error(err);
            showSnackbar?.('삭제 중 알 수 없는 오류가 발생했어.');
        } finally {
            setConfirmDeleteOpen(false); // ✅ 다이얼로그 닫기
        }
    };

    // ✅ DB에서 가져온 gridData → 화면 rows/columns로 매핑
    useEffect(() => {
        if (!gridData) return;

        const { rows: dbRows, columns: propLabels } = gridData;

        // 1) 동적 컬럼 추가
        setColumns((prev) => {
            const existingKeys = new Set(prev.map((c) => c.key));
            const next = [...prev];

            propLabels.forEach((label) => {
                if (!existingKeys.has(label)) {
                    next.push({ key: label, label });
                    existingKeys.add(label);
                }
            });

            return next;
        });

        // 2) dbRows → 화면용 rows
        const mappedRows = dbRows.map((r) => {
            const baseRow = {
                id: r.id,
                materialName: r.materialName,
                brandName: r.brandName,
                materialType: '',
                originalFileName: r.pdfPath,
                pdfUrl: r.pdfUrl, // ✅ Storage에서 만든 public URL
            };

            const rowWithProps = { ...baseRow };
            for (const [label, value] of r.props.entries()) {
                rowWithProps[label] = value;
            }

            return rowWithProps;
        });

        // ✅ 기본 정렬: 물질명 오름차순 (한글 기준)
        mappedRows.sort((a, b) =>
            (a.materialName || '').localeCompare(b.materialName || '', 'ko'),
        );

        setRows(mappedRows);
    }, [gridData]);

return (
    <div className="flex h-full min-h-0 flex-col">
        {/* 상단 인사 + 버튼들 (홈 레이아웃과 톤 맞춤) */}
        <section className="shrink-0">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="pediary-heading flex items-center gap-[7px] text-2xl font-semibold text-slate-800">
                        <span>자료 분석</span>
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        플라스틱 물성표 PDF를 올리면, 주요 물성값을 표로 정리해 줄게.
                    </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                    {/* PDF 업로드 – 🔴 붉은색 버튼 */}
                    <button
                        type="button"
                        onClick={handleClickUpload}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-60"
                    >
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 4h16v6H4z" />
                            <path d="M12 10v10" />
                            <path d="M9 15l3-3 3 3" />
                        </svg>
                        <span>{uploading ? '분석 중...' : 'PDF 업로드'}</span>
                    </button>

                    {/* 엑셀 다운로드 – 🟢 기존 엑셀 백업 버튼과 동일한 톤 */}
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        disabled={downloading || !hasRows}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-60"
                    >
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 4h16v6H4z" />
                            <path d="M9 4v6" />
                            <path d="M15 4v6" />
                            <path d="M6 14l3 3-3 3" />
                            <path d="M10 20h8" />
                        </svg>
                        <span>{downloading ? '내보내는 중...' : '엑셀 다운로드'}</span>
                    </button>

                    {/* ✅ 데이터 삭제 버튼 */}
                    <button
                        type="button"
                        onClick={handleClickDelete}
                        disabled={!selectedIds.length}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-60"
                    >
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M6 6l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                            <path d="M10 11v7" />
                            <path d="M14 11v7" />
                        </svg>
                        <span>데이터 삭제</span>
                    </button>
                </div>
            </div>

            {/* 숨겨진 파일 input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
            />
        </section>

        {/* 메인 영역 – 홈 레이아웃과 동일한 카드 스타일 */}
        <section className="mt-3 flex-1 min-h-0 rounded-2xl bg-white px-4 py-3 shadow-soft overflow-y-auto">
            {!hasRows ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border border-slate-300 border-t-slate-500" />
                            <span>PDF를 분석하는 중이야. 잠깐만 기다려줘.</span>
                        </div>
                    ) : (
                        <>
                            아직 업로드된 PDF가 없어. 상단의&nbsp;
                            <span className="font-semibold text-rose-500">PDF 업로드</span>
                            &nbsp;버튼을 눌러서 물성표를 올려줘.
                        </>
                    )}
                </div>
            ) : (
                // ✅ 업로드 중일 때 오버레이로 로딩 표시
                <div className="relative mt-1">
                    {uploading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                            <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
                                <div className="h-5 w-5 animate-spin rounded-full border border-slate-300 border-t-slate-500" />
                                <span>새 PDF를 분석하는 중이야...</span>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table
                            className="min-w-full border-collapse text-[13px] border border-slate-100 rounded-xl overflow-hidden">
                            <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                {/* ✅ 체크박스 헤더 */}
                                <th className="border border-slate-100 px-2 py-2 text-center">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAllSelection}
                                    />
                                </th>
                                {visibleColumns.map((col) => (
                                    <th
                                        key={col.key}
                                        className="min-w-[120px] whitespace-nowrap border border-slate-100 px-3 py-2 text-left text-[11px] font-semibold text-slate-600"
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-slate-100 hover:bg-slate-50/60"
                                >
                                    {/* ✅ 행 체크박스 */}
                                    <td className="px-2 py-1.5 align-top text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(row.id)}
                                            onChange={() => toggleRowSelection(row.id)}
                                        />
                                    </td>

                                    {visibleColumns.map((col) => (
                                        <td
                                            key={col.key}
                                            className="min-w-[120px] border border-slate-100 px-3 py-1.5 align-top text-[12px] text-slate-700"
                                        >
                                            {col.key === 'materialName' ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="truncate">{row[col.key] ?? ''}</span>

                                                    {row.pdfUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenPdf(row)}
                                                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                                                            title="원본 PDF 열기"
                                                        >
                                                            <svg
                                                                className="h-3 w-3"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="1.6"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <path d="M7 2h8l5 5v15H7z"/>
                                                                <path d="M15 2v5h5"/>
                                                                <path d="M10 11h2.5a2 2 0 0 1 0 4H10z"/>
                                                                <path d="M10 15v4"/>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                row[col.key] ?? ''
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
        <ConfirmDialog
            open={confirmDeleteOpen}
            title="데이터 삭제"
            message={
                selectedIds.length === 1
                    ? '선택한 데이터를 정말 삭제할까?\n삭제 후에는 복구할 수 없어.'
                    : `선택한 ${selectedIds.length}개의 데이터를 정말 삭제할까?\n삭제 후에는 복구할 수 없어.`
            }
            confirmText="삭제"
            cancelText="취소"
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
        />
    </div>
);
}
