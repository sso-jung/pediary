// [[문서제목]] 을 해당 문서의 링크로 바꾸는 파서
export function parseInternalLinks(text, documents) {
    if (!text || !documents) return text;

    return text.replace(/\[\[(.+?)\]\]/g, (match, rawTitle) => {
        const title = rawTitle.trim();

        const doc = documents.find((d) => d.title === title);
        if (!doc) {
            // 해당 제목의 문서를 못 찾으면 그대로 둔다
            return match;
        }

        // Markdown 링크 형식으로 변환
        return `[${title}](/wiki/${doc.slug})`;
    });
}
