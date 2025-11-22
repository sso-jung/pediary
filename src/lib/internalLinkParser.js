// src/lib/internalLinkParser.js

/**
 * 위키 내부 링크 파서
 *
 * 지원 문법
 *  - [[제목]]
 *  - [[제목#1.1]]
 *  - [[제목#1.1|보쌈 & 무김치]]
 *
 * 출력은 Toast UI 가 이해하는 "순수 Markdown 링크"
 *  - [제목](/wiki/slug)
 *  - [제목#1.1](/wiki/slug#sec-1-1)
 *  - [보쌈 & 무김치](/wiki/slug#sec-1-1)
 */
export function parseInternalLinks(markdownText, documents) {
    if (!markdownText || !Array.isArray(documents)) return markdownText;

    // 0. sanitizer 때문에 [[요리#1.1|보쌈]] 이
    //    \[\[요리\#1\.1\|보쌈\]\] 이런 식으로 저장된 걸 다시 풀어준다.
    //    ( [, ], #, |, . 만 대상으로 함 )
    markdownText = markdownText
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\#/g, '#')
        .replace(/\\\|/g, '|')
        .replace(/\\\./g, '.');

    // 제목 → 문서 매핑
    const docMap = new Map();
    documents.forEach((doc) => {
        if (doc?.title && doc?.slug) {
            docMap.set(doc.title.trim(), doc);
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

            const inner = markdownText.slice(start, end); // "요리", "요리#1.1", "요리#1.1|보쌈 & 무김치"

            // 1) alias 분리: "요리#1.1|보쌈 & 무김치"
            let left = inner;
            let alias = null;
            const pipeIndex = inner.indexOf('|');
            if (pipeIndex >= 0) {
                left = inner.slice(0, pipeIndex);   // "요리#1.1"
                alias = inner.slice(pipeIndex + 1); // "보쌈 & 무김치"
            }

            // 2) 제목 / 섹션 분리: "요리#1.1"
            let titleRaw = left;
            let sectionRaw = '';
            const hashIndex = left.indexOf('#');
            if (hashIndex >= 0) {
                titleRaw = left.slice(0, hashIndex);    // "요리"
                sectionRaw = left.slice(hashIndex + 1); // "1.1"
            }

            const title = (titleRaw || '').trim();
            if (!title || !docMap.has(title)) {
                // 문서를 못 찾는 경우 (존재 X, 권한 X 등)
                // → 위키 문법([[...]])은 숨기고 "표시 텍스트"만 남긴다.

                let displayText;

                if (alias != null) {
                    // [[업무#1.1|오늘의 할일]] → "오늘의 할일"
                    const aliasTrimmed = alias.trim();
                    displayText = aliasTrimmed || title || inner;
                } else if (sectionRaw) {
                    // [[업무#1.1]] → "업무#1.1"
                    const sectionPart = sectionRaw.trim();
                    if (title) {
                        displayText = `${title}${sectionPart ? `#${sectionPart}` : ''}`;
                    } else {
                        // 제목도 없으면 그냥 안쪽 내용을 그대로
                        displayText = inner;
                    }
                } else {
                    // [[업무]] → "업무"
                    displayText = title || inner;
                }

                result += displayText;
                i = end + 2;
                continue;
            }

            const doc = docMap.get(title);

            // 3) href 만들기
            let href = `/wiki/${doc.slug}`;
            const sectionPart = (sectionRaw || '').trim();
            if (sectionPart) {
                const sectionId = 'sec-' + sectionPart.replace(/\./g, '-'); // "1.1" → "sec-1-1"
                href += `#${sectionId}`;
            }

            // 4) 화면에 보일 텍스트
            let displayText;
            if (alias != null) {
                const aliasTrimmed = alias.trim();
                displayText = aliasTrimmed || title;
            } else if (sectionPart) {
                displayText = `${title}#${sectionPart}`;
            } else {
                displayText = title;
            }

            // 5) Markdown 링크로 치환
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
