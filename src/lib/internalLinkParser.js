// src/lib/internalLinkParser.js

/**
 * markdownText: 원본 마크다운
 * documents: useAllDocuments() 등으로 가져온 문서 목록
 *   - { id, title, slug } 형태를 기대
 *
 * 지원 문법:
 *   [[문서제목]]
 *   [[문서제목#1.1]]
 */
export function parseInternalLinks(markdownText, documents) {
    if (!markdownText || !Array.isArray(documents)) return markdownText;

    // 제목 → 문서 매핑
    const docMap = new Map();
    documents.forEach((doc) => {
        if (doc?.title && doc?.slug) {
            docMap.set(doc.title.trim(), doc);
        }
    });

    // [[...]] 패턴 치환
    return markdownText.replace(/\[\[([^[\]]+)\]\]/g, (match, inner) => {
        // inner 예: "일기" 또는 "일기#1.1"
        const [titlePartRaw, sectionPartRaw] = inner.split('#');
        const titlePart = titlePartRaw.trim();

        const doc = docMap.get(titlePart);
        if (!doc) {
            // 해당 제목의 문서가 없으면 원문 그대로 둠
            return match;
        }

        let href = `/wiki/${doc.slug}`;
        let displayText = titlePart;

        // 섹션 번호가 있는 경우 → "sec-1-1" 형식으로 앵커 생성
        if (sectionPartRaw) {
            const sectionPart = sectionPartRaw.trim(); // "1.1" 같은 문자열
            if (sectionPart) {
                const sectionId = 'sec-' + sectionPart.replace(/\./g, '-');
                href += `#${sectionId}`;
                displayText = `${titlePart}#${sectionPart}`; // 🔹 화면에는 "일기#1.1"로 보이게
            }
        }

        // 내부 링크는 class="wiki-link"로 스타일링
        return `<a href="${href}" class="wiki-link">${displayText}</a>`;
    });
}
