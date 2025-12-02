// src/lib/exportMaterialGridExcel.js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// 간단 헤더 스타일 (기존 함수랑 비슷하게)
function applyHeaderStyle(cell) {
    if (!cell) return;
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
    };
    cell.font = {
        name: '맑은 고딕',
        bold: true,
        size: 10,
        color: { argb: 'FF000000' },
    };
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
    };
}

/**
 * 자료 분석 Grid 전체를 엑셀로 다운로드
 * @param {Array} rows - [{ id, materialName, brandName, polymerType, originalFileName, ...props }]
 * @param {Array} columns - [{ key, label }]
 */
export async function downloadMaterialGridExcel(rows, columns) {
    if (!rows || rows.length === 0) {
        throw new Error('엑셀로 내보낼 자료가 없어.');
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Materials');

    // 컬럼 폭 대략 설정
    columns.forEach((c, idx) => {
        const col = ws.getColumn(idx + 1);
        col.width = c.key === 'materialName' || c.key === 'brandName'
            ? 20
            : 18;
    });

    // 헤더
    const headerLabels = columns.map((c) => c.label);
    const headerRow = ws.addRow(headerLabels);
    headerRow.eachCell((cell) => applyHeaderStyle(cell));

    // 데이터
    rows.forEach((row) => {
        const values = columns.map((c) => row[c.key] ?? '');
        const dataRow = ws.addRow(values);
        dataRow.eachCell((cell) => {
            cell.font = {
                name: '맑은 고딕',
                size: 10,
                color: { argb: 'FF000000' },
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'left',
                wrapText: true,
            };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    saveAs(blob, `pediary-materials-${dateStr}.xlsx`);
}
