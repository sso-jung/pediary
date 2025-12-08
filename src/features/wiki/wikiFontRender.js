// src/features/wiki/wikiFontRender.js

// 보기 모드(Viewer)용: $$widgetN ... $$ 제거 + {{fs:11|...}} → <span ...>로 변환
export function renderFontWidgetsInMarkdown(markdown) {
    if (!markdown) return markdown;

    let s = markdown;

    // 1) $$widget0 {{fs:11|...}}$$ → {{fs:11|...}}
    s = s.replace(/\$\$widget\d+\s*([\s\S]*?)\$\$/g, '$1');

    // 2) {{fs:11|...}}, {{11|...}}, {{lg|...}} → <span style="font-size:..">...</span>
    s = s.replace(
        /\{\{(?:fs:)?(sm|md|lg|\d+)\|([\s\S]+?)\}\}/g,
        (_, sizeToken, inner) => {
            let sizePx;

            if (sizeToken === 'sm') sizePx = 12;
            else if (sizeToken === 'md') sizePx = 14;
            else if (sizeToken === 'lg') sizePx = 18;
            else sizePx = Number(sizeToken) || 14;

            // Toast UI markdown 파서가 inline HTML은 그대로 렌더해 주니까 이렇게 보내면 됨
            return `<span class="wiki-font-custom" style="font-size:${sizePx}px">${inner}</span>`;
        },
    );

    return s;
}
