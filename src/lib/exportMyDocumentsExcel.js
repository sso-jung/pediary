// src/lib/exportMyDocumentsExcel.js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { fetchMyDocuments, fetchCategories } from './wikiApi';
import { parseInternalLinkInner } from './internalLinkFormat';

// 🔹 내부 위키 링크 제거: [[doc:7#2.1|드마리스]] → "드마리스"
function stripInternalLinks(md = '') {
    if (!md) return '';

    // sanitizer 로 인해 \[\[... 형태인 것도 풀어줌
    let text = md
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\#/g, '#')
        .replace(/\\\|/g, '|')
        .replace(/\\\./g, '.');

    // [[...]] 패턴을 찾아서 label만 남기기
    text = text.replace(/\[\[([^\]]+)\]\]/g, (match, inner) => {
        const parsed = parseInternalLinkInner(inner);
        if (parsed && parsed.label) {
            return parsed.label; // 레이블만 남김
        }
        return ''; // label 없으면 통째로 제거
    });

    return text;
}

// 🔹 css color → ARGB 로 변환 (#hex, rgb(51,51,51) 둘 다 지원)
function cssColorToArgb(css) {
    if (!css) return null;
    const s = css.trim().toLowerCase();

    if (s.startsWith('#')) {
        let hex = s.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map((ch) => ch + ch).join('');
        }
        if (hex.length === 6) {
            return 'FF' + hex.toUpperCase();
        }
        return null;
    }

    const m = s.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (m) {
        const r = Number(m[1]);
        const g = Number(m[2]);
        const b = Number(m[3]);
        if (
            Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) &&
            r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255
        ) {
            const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
            return 'FF' + toHex(r) + toHex(g) + toHex(b);
        }
    }
    return null;
}

// 🔹 Markdown → 라인 배열 (텍스트 + 스타일 정보)
function markdownToLines(md = '', title = '') {
    const result = [];

    // 문서 제목을 제일 위에 헤딩1으로 추가
    if (title) {
        result.push({
            text: `[${title}]`,
            isHeading: true,
            level: 1,
            bold: true,
            italic: false,
            underline: false,
            strike: false,
            color: null,
        });
    }

    if (!md) return result;

    let s = stripInternalLinks(md);
    s = s.replace(/\r\n/g, '\n');
    const rawLines = s.split('\n');

    for (let raw of rawLines) {
        let line = raw;

        if (!line.trim()) continue;

        // ── 수평선(*** / --- / ___) 은 그대로 한 줄로만 보냄
        const trimmed = line.trim();
        if (trimmed === '***' || trimmed === '---' || trimmed === '___') {
            result.push({
                text: '***',
                isHeading: false,
                level: null,
                bold: false,
                italic: false,
                underline: false,
                strike: false,
                color: null,
            });
            continue;
        }

        let isHeading = false;
        let level = null;
        let bold = false;
        let italic = false;
        let underline = false;
        let strike = false;
        let color = null;

        // ── span 색상 추출
        const spanColorMatch = line.match(
            /<span[^>]*style=["'][^"']*color\s*:\s*([^;"']+)/i,
        );
        if (spanColorMatch) {
            const argb = cssColorToArgb(spanColorMatch[1]);
            if (argb) color = argb;
        }
        line = line.replace(/<\/?span[^>]*>/gi, '');

        // 밑줄 <u>...</u>
        if (/<u[^>]*>/.test(line)) {
            underline = true;
        }
        line = line.replace(/<\/?u[^>]*>/gi, '');

        // 나머지 HTML 태그 제거
        line = line.replace(/<[^>]+>/g, '');

        // ── 헤딩(# ...)
        const hMatch = line.match(/^(#{1,6})\s*(.*)$/);
        if (hMatch) {
            isHeading = true;
            level = hMatch[1].length;
            line = hMatch[2];
        }

        // 리스트: "- 항목" → "• 항목"
        line = line.replace(/^[-*+]\s+/g, '• ');

        // 외부 링크: [텍스트](url) → "텍스트 (url)"
        line = line.replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1 ($2)');

        // ── 인라인 스타일 마크업 감지 (줄 어디에 있어도 플래그 ON)
        // if (/~~(.+?)~~/.test(line)) {
        //     strike = true;
        // }
        if (/\*\*(.+?)\*\*/.test(line)) {
            bold = true;
        }
        // *...* (단, **..** 는 위에서 이미 잡았으니 남은 건 기울임)
        if (/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/.test(line)) {
            italic = true;
        }

        // 실제 텍스트에서 마크업 제거
        line = line
            // .replace(/~~(.+?)~~/g, '$1')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1$2');

        // 인라인 코드 `code`
        line = line.replace(/`([^`]+)`/g, '$1');

        // 역슬래시 제거
        line = line.replace(/\\/g, '');

        // 공백 정리
        line = line.replace(/[ \t]+/g, ' ').trimEnd();
        if (!line.trim()) continue;

        result.push({
            text: line,
            isHeading,
            level,
            bold,
            italic,
            underline,
            // strike: false,
            color,
        });
    }

    return result;
}


// 🔹 카테고리 트리 헬퍼
function buildCategoryMaps(categories) {
    const byId = new Map();
    for (const c of categories || []) {
        byId.set(c.id, c);
    }
    return { byId };
}

// 🔹 문서의 상/하위 폴더 정보
function resolveCategoryPath(doc, categoryMap) {
    const { byId } = categoryMap;
    if (!doc.category_id) {
        return {
            depth1: '(미분류)',
            depth2: '',
        };
    }

    const cat = byId.get(doc.category_id);
    if (!cat) {
        return {
            depth1: '(알 수 없음)',
            depth2: '',
        };
    }

    if (cat.parent_id == null) {
        // 1depth
        return {
            depth1: cat.name,
            depth2: '',
        };
    }

    const parent = byId.get(cat.parent_id);
    if (!parent) {
        return {
            depth1: cat.name,
            depth2: '',
        };
    }

    // parent: 1depth, cat: 2depth
    return {
        depth1: parent.name,
        depth2: cat.name,
    };
}

// 🔹 헤더/내용 라벨 스타일 (회색 배경 + 검은 Bold + 가운데 정렬)
function applyHeaderStyle(cell) {
    if (!cell) return;
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }, // 회색
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

// 🔹 한 chunk 안의 ~~취소선~~을 부분 strike 로 바꾸는 헬퍼
function buildRichTextFromChunk(chunkText, baseFont) {
    const text = chunkText || '';
    const runs = [];
    const re = /~~(.*?)~~/g;

    let lastIndex = 0;
    let m;

    while ((m = re.exec(text)) !== null) {
        const matchIndex = m.index;
        const fullMatch = m[0]; // "~~...~~"
        const inner = m[1];     // 안쪽 텍스트

        // 1) 앞부분 (취소선 아닌 텍스트)
        if (matchIndex > lastIndex) {
            const before = text.slice(lastIndex, matchIndex);
            if (before) {
                runs.push({
                    text: before,
                    font: { ...baseFont },
                });
            }
        }

        // 2) 취소선 부분
        if (inner) {
            runs.push({
                text: inner,
                font: { ...baseFont, strike: true },
            });
        }

        lastIndex = matchIndex + fullMatch.length;
    }

    // 3) 마지막 나머지
    if (lastIndex < text.length) {
        const tail = text.slice(lastIndex);
        if (tail) {
            runs.push({
                text: tail,
                font: { ...baseFont },
            });
        }
    }

    // 취소선이 전혀 없는 경우: 통짜 run 하나
    if (runs.length === 0) {
        runs.push({
            text,
            font: { ...baseFont },
        });
    }

    return { richText: runs };
}

// 🔹 ~~취소선~~ 구간을 안 가르면서 maxLen 기준으로 텍스트 쪼개기
function splitTextWithStrikeSafe(text, maxLen) {
    const result = [];
    const len = text.length;
    if (!text || len <= maxLen) {
        return text ? [text] : [];
    }

    // 전체 텍스트에서 ~~...~~ 구간 인덱스 수집
    const intervals = [];
    const re = /~~(.*?)~~/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length; // "~~...~~" 전체
        intervals.push([start, end]);
    }

    let start = 0;
    while (start < len) {
        let end = Math.min(start + maxLen, len);

        // end 가 어떤 ~~...~~ 구간의 중간이면 그 구간 끝까지로 당겨줌
        for (const [s, e] of intervals) {
            if (end > s && end < e) {
                end = e;
                break;
            }
        }

        // 혹시라도 이상한 경우엔 그냥 maxLen 만큼 잘라서 탈출
        if (end <= start) {
            end = Math.min(start + maxLen, len);
        }

        result.push(text.slice(start, end));
        start = end;
    }

    return result;
}

// 🔹 markdownToLines 결과에 heading 번호 1 / 1.1 / 1.1.1 ... 붙이기
function addHeadingNumbers(lines = []) {
    const counters = [0, 0, 0, 0, 0, 0, 0]; // 1~6

    return lines.map((line) => {
        if (!line.isHeading || !line.level) return line;

        const level = Math.min(Math.max(line.level, 1), 6);
        counters[level] += 1;
        for (let i = level + 1; i < counters.length; i += 1) {
            counters[i] = 0;
        }

        const nums = counters.slice(1, level + 1).filter((n) => n > 0);
        const number = nums.join('.');

        return {
            ...line,
            number,
        };
    });
}

// 🔹 엑셀 시트명 유니크하게 만들기 (31자 제한 + 중복 방지)
function makeUniqueSheetName(baseName, usedNames) {
    let name = (baseName || 'Sheet').replace(/[\\/?*\[\]:]/g, ' ');
    name = name.slice(0, 31).trim() || 'Sheet';

    if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
    }

    let idx = 2;
    // "이름-2", "이름-3" ... 식으로 붙여가며 중복 피하기
    while (true) {
        const suffix = `-${idx}`;
        const truncated = name.slice(0, 31 - suffix.length) + suffix;
        if (!usedNames.has(truncated)) {
            usedNames.add(truncated);
            return truncated;
        }
        idx += 1;
    }
}

// 🔹 마크다운 테이블 한 줄 파싱: "| a | b |" → ["a", "b"]
function parseMarkdownTableRow(text = '') {
    let t = text.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split('|').map((c) => c.trim());
}

// 🔹 실제 엑셀 파일 생성 + 다운로드 (exceljs)
export async function downloadMyDocumentsExcel(userId) {
    if (!userId) {
        throw new Error('로그인된 사용자가 없어.');
    }

    // 1) 내 문서 + 내 카테고리 조회
    const [docs, categories] = await Promise.all([
        fetchMyDocuments(userId),
        fetchCategories(userId),
    ]);

    const catMap = buildCategoryMaps(categories || []);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // 2) 카테고리별로 문서 그룹핑 (1depth 기준)
    const docsByRootName = new Map(); // rootName -> 문서 배열

    for (const doc of docs || []) {
        const { depth1, depth2 } = resolveCategoryPath(doc, catMap);
        const key = depth1 || '(미분류)';

        if (!docsByRootName.has(key)) {
            docsByRootName.set(key, []);
        }
        docsByRootName.get(key).push({
            doc,
            depth1,
            depth2,
        });
    }

    // 3) 워크북 생성
    const workbook = new ExcelJS.Workbook();

    // 3-1) Summary 시트
    const summary = workbook.addWorksheet('Summary');

    // 컬럼 폭
    summary.getColumn(1).width = 30; // 백업일시
    summary.getColumn(2).width = 15; // 문서 수

    // 🔹 헤더 행: "항목/값" 제거하고 바로 "백업일시 / 문서 수"를 헤더로 사용
    const summaryHeaderRow = summary.addRow(['백업일시', '문서 수']);
    applyHeaderStyle(summary.getCell(1, 1));
    applyHeaderStyle(summary.getCell(1, 2));

    // 🔹 데이터 행
    const backupTimeStr = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const summaryDataRow = summary.addRow([
        backupTimeStr,
        docs?.length || 0,
    ]);

    // 데이터도 맑은고딕 + 가운데 정렬
    summaryDataRow.eachCell((cell) => {
        cell.font = {
            name: '맑은 고딕',
            size: 10,
            color: { argb: 'FF000000' },
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
        };
    });

    const headers = ['상위폴더', '하위폴더', '생성일', '수정일'];

    // 3-2) 1depth 카테고리별 시트
    for (const [rootName, docListRaw] of docsByRootName.entries()) {
        if (!docListRaw || docListRaw.length === 0) continue;

        // 같은 폴더(하위폴더)끼리 붙어 나오도록 정렬
        const docList = [...docListRaw].sort((a, b) => {
            const d1 = (a.depth2 || '').localeCompare(b.depth2 || '');
            if (d1 !== 0) return d1;
            return (a.doc.title || '').localeCompare(b.doc.title || '');
        });

        // 시트 생성
        let sheetName = rootName || '카테고리';
        sheetName = sheetName.slice(0, 31); // 엑셀 시트명 제한
        const ws = workbook.addWorksheet(sheetName);

        // 컬럼 폭: 대략 100px, 100px, 200px, 200px
        ws.getColumn(1).width = 26; // 상위폴더
        ws.getColumn(2).width = 26; // 하위폴더
        ws.getColumn(3).width = 36; // 생성일
        ws.getColumn(4).width = 36; // 수정일

        let currentRow = 0; // 1-based가 아니라 내부 카운터용

        for (let idx = 0; idx < docList.length; idx += 1) {
            const { doc, depth1, depth2 } = docList[idx];

            const createdStr = doc.created_at
                ? new Date(doc.created_at).toLocaleString()
                : '';
            const updatedStr = doc.updated_at
                ? new Date(doc.updated_at).toLocaleString()
                : '';

            const lines = markdownToLines(doc.content_markdown || '', doc.title);

            // 문서 사이 한 줄 띄우기 (첫 문서 제외)
            if (idx > 0) {
                ws.addRow(['', '', '', '']);
                currentRow += 1;
            }

            // 1) 헤더 행: 상위폴더/하위폴더/생성일/수정일
            const headerRow = ws.addRow(headers);
            currentRow += 1;
            headerRow.eachCell((cell) => applyHeaderStyle(cell));

            // 2) 메타 정보 행
            const metaRow = ws.addRow([depth1, depth2, createdStr, updatedStr]);
            currentRow += 1;
            metaRow.eachCell((cell) => {
                cell.font = {
                    name: '맑은 고딕',
                    size: 10,
                    color: { argb: 'FF000000' },
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });

            // 3) "내용" 라벨 행 (A~D 병합 + 헤더 스타일)
            const labelRowIndex = currentRow + 1;
            const labelRow = ws.addRow(['내용', null, null, null]);
            currentRow += 1;
            ws.mergeCells(labelRowIndex, 1, labelRowIndex, 4);
            const labelCell = ws.getCell(labelRowIndex, 1);
            applyHeaderStyle(labelCell);

// 4) 내용 각 줄을 한 행씩 (A~D 병합)
//    - 헤딩이 나오면 그 위에 한 줄 비우기
            const MAX_CHARS_PER_ROW = 80;
            let isFirstContentLine = true;

            for (const line of lines) {
                if (!isFirstContentLine && line.isHeading) {
                    const emptyRowIdx = currentRow + 1;
                    ws.addRow(['', '', '', '']);
                    currentRow += 1;
                    ws.mergeCells(emptyRowIdx, 1, emptyRowIdx, 4);
                }
                isFirstContentLine = false;

                const fullText = line.text || '';
                const chunks = splitTextWithStrikeSafe(fullText, MAX_CHARS_PER_ROW);

                // ───────── baseFont 결정 (색/볼드/기울임/헤딩 반영) ─────────
                let fontSize = 10;
                let fontBold = !!line.bold;
                const fontItalic = !!line.italic;
                const fontUnderline = line.underline ? true : undefined;
                const fontColor = line.color || 'FF000000';

                if (line.isHeading) {
                    const lvl = line.level || 1;
                    if (lvl === 1) fontSize = 16;      // 제목
                    else if (lvl === 2) fontSize = 14; // 헤딩2
                    else fontSize = 12;                // 헤딩3~
                    fontBold = true;
                }

                const baseFont = {
                    name: '맑은 고딕',
                    size: fontSize,
                    bold: fontBold,
                    italic: fontItalic,
                    underline: fontUnderline,
                    color: { argb: fontColor },
                };

                chunks.forEach((chunkText, idx) => {
                    const row = ws.addRow([null, null, null, null]);
                    currentRow += 1;

                    const rowIndex = row.number;
                    ws.mergeCells(rowIndex, 1, rowIndex, 4);
                    const cell = ws.getCell(rowIndex, 1);

                    // 헤딩이면 첫 chunk 기준으로 높이 보정
                    if (line.isHeading && idx === 0) {
                        const approxHeight = fontSize * 1.5;
                        row.height = Math.max(row.height || 0, approxHeight);
                    }

                    // 🔹 chunk 안의 ~~..~~을 부분 스트로크로
                    cell.value = buildRichTextFromChunk(chunkText, baseFont);

                    cell.alignment = {
                        wrapText: true,
                        vertical: 'top',
                        horizontal: 'left',
                    };
                });
            }
        }
    }

    // 4) 파일로 저장
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileName = `pediary-backup-${dateStr}.xlsx`;
    saveAs(blob, fileName);
}


// =========================================================
// 🔹 단일 문서 엑셀 다운로드 (보기 화면에서 쓰는 용도)
//    - 파일명: 문서 제목.xlsx
//    - 시트명: 문서 안의 H1 헤딩들
//    - Heading 텍스트: "1. 제목", "1.1. 소제목" 처럼 번호 붙임
//    - [[doc:7#2.1|라벨]] → "라벨" 로만 보이도록 stripInternalLinks 재사용
//    - Heading 레벨별로 한 칸씩 오른쪽 셀부터 시작 (들여쓰기)
// =========================================================
export async function downloadDocumentExcel(doc) {
    if (!doc) {
        throw new Error('문서 정보가 없어.');
    }

    const workbook = new ExcelJS.Workbook();
    const usedSheetNames = new Set();

    const markdown = doc.content_markdown || '';

    // 🔹 기존 파서 재사용 (내부 링크 label만 남기는 stripInternalLinks 포함)
    const allLines = markdownToLines(markdown, ''); // 제목은 일부러 안 넣음
    const numberedLines = addHeadingNumbers(allLines);

    // 🔹 H1 기준으로 시트 나누기
    const sections = [];
    let currentSection = null;
    let h1Index = 0;

    numberedLines.forEach((line) => {
        if (line.isHeading && line.level === 1) {
            const baseName = line.text || `섹션 ${h1Index + 1}`;
            const sheetName = makeUniqueSheetName(baseName, usedSheetNames);

            if (currentSection) {
                sections.push(currentSection);
            }

            h1Index += 1;
            currentSection = {
                sheetName,
                lines: [],
            };
        }

        // H1 나오기 전에 내용이 있으면, 문서 제목으로 기본 시트 생성
        if (!currentSection) {
            const baseName = doc.title || '문서';
            const sheetName = makeUniqueSheetName(baseName, usedSheetNames);
            currentSection = {
                sheetName,
                lines: [],
            };
        }

        currentSection.lines.push(line);
    });

    if (currentSection) {
        sections.push(currentSection);
    }

    const MAX_CHARS_PER_ROW = 80;
    const MAX_INDENT_COL = 10; // 들여쓰기에 쓸 최대 컬럼 수

    // 🔹 각 섹션(=시트)에 내용 쓰기
    for (const section of sections) {
        const ws = workbook.addWorksheet(section.sheetName);

        let lastHeadingLevel = 1;

        for (let i = 0; i < section.lines.length; i += 1) {
            const line = section.lines[i];
            const rawText = line.text || '';
            const trimmed = rawText.trim();

            // 현재 헤딩 레벨 기억
            if (line.isHeading && line.level) {
                lastHeadingLevel = line.level;
            }

            // ─────────────────────────────
            // 1) 마크다운 테이블 처리
            //    "| a | b |" + "| --- | --- |" 구조를 잡아서
            //    실제 여러 컬럼으로 뿌려줌
            // ─────────────────────────────
            const next = section.lines[i + 1];
            const nextTrimmed = next?.text ? next.text.trim() : '';

            const looksLikeTableHeader =
                trimmed.startsWith('|') && trimmed.includes('|');
            const looksLikeTableDivider =
                nextTrimmed &&
                nextTrimmed.startsWith('|') &&
                /---/.test(nextTrimmed);

            if (looksLikeTableHeader && looksLikeTableDivider) {
                const headerCells = parseMarkdownTableRow(trimmed);
                const bodyRows = [];

                // 두 번째 줄(구분선)은 건너뛰기
                let j = i + 2;

                while (j < section.lines.length) {
                    const t = (section.lines[j].text || '').trim();
                    if (!t.startsWith('|') || !t.includes('|')) break;
                    bodyRows.push(parseMarkdownTableRow(t));
                    j += 1;
                }

                // 들여쓰기 기준: 마지막 헤딩 레벨
                const startCol = Math.min(lastHeadingLevel, MAX_INDENT_COL);

                // 헤더 행
                const headerRow = ws.addRow([]);
                let colIdx = startCol;
                headerCells.forEach((val) => {
                    const cell = headerRow.getCell(colIdx++);
                    cell.value = val;
                    applyHeaderStyle(cell); // 회색 배경 + bold + 가운데 정렬
                });

                // 바디 행
                bodyRows.forEach((rowCells) => {
                    const row = ws.addRow([]);
                    let cIdx = startCol;
                    rowCells.forEach((val) => {
                        const cell = row.getCell(cIdx++);
                        cell.value = val || '';
                        cell.font = {
                            name: '맑은 고딕',
                            size: 10,
                            color: { argb: 'FF000000' },
                        };
                        cell.alignment = {
                            vertical: 'top',
                            horizontal: 'left',
                            wrapText: true,
                        };
                    });
                });

                // i를 테이블 마지막 줄까지 스킵
                i = j - 1;
                continue;
            }

            // ─────────────────────────────
            // 2) 일반 텍스트 / 헤딩 처리
            //    → 헤딩 레벨별로 들여쓰기 컬럼 달리 사용
            // ─────────────────────────────
            const baseText = rawText;
            const displayText =
                line.isHeading && line.number
                    ? `${line.number}. ${baseText}`
                    : baseText;

            if (!displayText.trim()) continue;

            // 들여쓰기 정도 (셀은 그대로 1번, indent 로만 밀기)
            let indentLevel = 0;

              if (line.isHeading && line.level) {
                // H1: 0, H2: 1, H3: 2 ...  (대략 1단계당 20~25px 느낌)
                    indentLevel = Math.max(0, line.level - 1);
              } else {
                const isBullet = displayText.trimStart().startsWith('• ');
                if (isBullet) {
                      // 리스트는 마지막 헤딩보다 한 단계 더 깊게
                          indentLevel = Math.max(1, lastHeadingLevel);
                    } else {
                      // 일반 텍스트는 마지막 헤딩 레벨 기준
                          indentLevel = Math.max(0, lastHeadingLevel - 1);
                    }
              }

            const chunks = splitTextWithStrikeSafe(displayText, MAX_CHARS_PER_ROW);

            // ── Heading 레벨에 따라 폰트 크기/굵기 조절
            let fontSize = 10;
            let fontBold = !!line.bold;
            const fontItalic = !!line.italic;
            const fontUnderline = line.underline ? true : undefined;
            const fontColor = line.color || 'FF000000';

            if (line.isHeading) {
                const lvl = line.level || 1;
                if (lvl === 1) fontSize = 16;      // H1
                else if (lvl === 2) fontSize = 14; // H2
                else fontSize = 12;                // H3~
                fontBold = true;
            }

            const baseFont = {
                name: '맑은 고딕',
                size: fontSize,
                bold: fontBold,
                italic: fontItalic,
                underline: fontUnderline,
                color: { argb: fontColor },
            };

            chunks.forEach((chunkText, idxChunk) => {
                const row = ws.addRow([]);
                const rowIndex = row.number;

                // 🔹 A ~ S 컬럼까지 병합 (1 ~ 19)
                ws.mergeCells(rowIndex, 1, rowIndex, 19);
                const cell = ws.getCell(rowIndex, 1);

                // Heading 첫 줄은 높이를 조금 더 줌
                if (line.isHeading && idxChunk === 0) {
                    const approxHeight = fontSize * 1.5;
                    row.height = Math.max(row.height || 0, approxHeight);
                }

                // ~~취소선~~은 부분 스트로크로
                cell.value = buildRichTextFromChunk(chunkText, baseFont);
                cell.alignment = {
                    wrapText: true,
                    vertical: 'top',
                    horizontal: 'left',
                    indent: indentLevel, // 들여쓰기 유지
                };
            });
        }
    }

    // 🔹 파일명: 문서 제목.xlsx
    const safeTitle =
        (doc.title || '문서').replace(/[\\/:*?"<>|]/g, ' ').trim() || '문서';

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `${safeTitle}.xlsx`);
}
