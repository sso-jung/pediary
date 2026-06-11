// src/features/wiki/wikiFontRender.js

function fontSizeTokenToPx(sizeToken) {
    if (sizeToken === 'sm') return 12;
    if (sizeToken === 'md') return 14;
    if (sizeToken === 'lg') return 18;
    return Number(sizeToken) || 14;
}

export function normalizeFontSizeTokensToSpans(markdown) {
    if (!markdown) return markdown;

    let s = markdown;

    s = s.replace(/\$\$widget\d+\s*([\s\S]*?)\$\$/g, '$1');
    s = s.replace(
        /\{\{(?:fs:)?(sm|md|lg|\d+)\|([\s\S]+?)\}\}/g,
        (_, sizeToken, inner) =>
            `<span class="wiki-font-custom" style="font-size:${fontSizeTokenToPx(sizeToken)}px">${inner}</span>`,
    );

    return s;
}

// 보기 모드(Viewer)용: $$widgetN ... $$ 제거 + {{fs:11|...}} → <span ...>로 변환
export function renderFontWidgetsInMarkdown(markdown) {
    if (!markdown) return markdown;

    return normalizeFontSizeTokensToSpans(markdown);
}
