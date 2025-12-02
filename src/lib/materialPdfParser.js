// src/features/materials/materialPdfParser.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker&url';
import { supabase } from './supabaseClient';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// 1) pdf 파일 → 전체 텍스트
async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let allText = '';
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item) => item.str || '').join(' ');
        allText += `\n\n[PAGE ${i}]\n${strings}`;
    }

    return allText.trim();
}

// 2) Edge Function 호출해서 AI 추출 결과 가져오기
export async function extractMaterialFromPdfWithAi(file, user, existingColumns = []) {
    if (!file) {
        throw new Error('PDF 파일이 없어.');
    }

    const pdfText = await extractPdfText(file);

    const payload = {
        userId: user?.id ?? null,
        fileName: file.name,
        pdfText,
        existingColumns: Array.isArray(existingColumns) ? existingColumns : [],
    };

    const { data, error } = await supabase.functions.invoke(
        'parse-material-sheet',
        {
            body: payload,
        },
    );

    if (error) {
        console.error('material-pdf-extract error', error);
        throw error;
    }

    return data;
}
