// src/lib/internalLinkParser.js

export function parseInternalLinks(markdownText, documents) {
    if (!markdownText || !Array.isArray(documents)) return markdownText;

    const docMap = new Map();
    documents.forEach((doc) => {
        if (doc?.title && doc?.slug) {
            docMap.set(doc.title.trim(), doc);
        }
    });

    return markdownText.replace(/\[\[([^[\]]+)\]\]/g, (match, inner) => {
        const [titlePartRaw, sectionPartRaw] = inner.split('#');
        const titlePart = titlePartRaw.trim();

        const doc = docMap.get(titlePart);
        if (!doc) return match;

        let href = `/wiki/${doc.slug}`;
        let displayText = titlePart;

        if (sectionPartRaw) {
            const sectionPart = sectionPartRaw.trim(); // 예: "2.1"
            if (sectionPart) {
                const sectionId = 'sec-' + sectionPart.replace(/\./g, '-');
                href += `#${sectionId}`;
                displayText = `${titlePart}#${sectionPart}`;
            }
        }

        return `<a href="${href}" class="wiki-link">${displayText}</a>`;
    });
}
