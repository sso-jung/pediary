// src/lib/internalLinkParser.js

/**
 * 위키 내부 링크 파서 (PK 기반 버전)
 *
 * 지원 문법
 *  - [[doc:123]]
 *  - [[doc:123#1.1]]
 *  - [[doc:123#1.1|보쌈 & 무김치]]
 *
 * 출력은 Toast UI 가 이해하는 "순수 Markdown 링크"
 *  - [제목](/wiki/slug)
 *  - [제목#1.1](/wiki/slug#sec-1-1)
 *  - [보쌈 & 무김치](/wiki/slug#sec-1-1)
 */

import { parseInternalLinkInner } from './internalLinkFormat';

export function parseInternalLinks(markdownText, documents) {
    if (!markdownText || !Array.isArray(documents)) return markdownText;

    // 0. sanitizer 때문에 \[\[... 이런 식으로 저장된 걸 풀어준다.
    markdownText = markdownText
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\#/g, '#')
        .replace(/\\\|/g, '|')
        .replace(/\\\./g, '.');

    // id → 문서 매핑
    const docMap = new Map();
    documents.forEach((doc) => {
        if (doc && doc.id != null) {
            docMap.set(Number(doc.id), doc);
        }
    });

    let result = '';
    let i = 0;
    const len = markdownText.length;

    while (i < len) {
        // "[[" 발견
        if (markdownText[i] === '[' && i + 1 < len && markdownText[i + 1] === '[') {
            const start = i + 2;
            const end = markdownText.indexOf(']]', start);

            // 닫는 "]]" 가 없으면 그냥 글자 그대로
            if (end === -1) {
                result += markdownText[i];
                i += 1;
                continue;
            }

            const inner = markdownText.slice(start, end); // "doc:123#1.1|레이블"

            const parsed = parseInternalLinkInner(inner);

            // 우리가 지원하는 포맷이 아니면, 그냥 안쪽 텍스트만 보여준다.
            if (!parsed) {
                const displayText = inner.trim() || inner;
                result += displayText;
                i = end + 2;
                continue;
            }

            const { docId, section, label } = parsed;
            const doc = docMap.get(docId);

            // 문서를 못 찾는 경우 (존재 X, 권한 X 등)
            // → 위키 문법([[...]])은 숨기고 "표시 텍스트"만 남긴다.
            if (!doc) {
                const displayText = label || inner;
                result += displayText;
                i = end + 2;
                continue;
            }

            // 1) href 만들기
            let href = `/wiki/${doc.slug}`;
            if (section) {
                const sectionId = 'sec-' + section.replace(/\./g, '-'); // "1.1" → "sec-1-1"
                href += `#${sectionId}`;
            }

            // 2) 화면에 보일 텍스트
            let displayText = '';

            if (label) {
                displayText = label;
            } else if (section) {
                displayText = `${doc.title}#${section}`;
            } else {
                displayText = doc.title;
            }

            // 3) Markdown 링크로 치환
            result += `[${displayText}](${href})`;
            i = end + 2;
        } else {
            // 그냥 일반 문자
            result += markdownText[i];
            i += 1;
        }
    }

    return result;
}
