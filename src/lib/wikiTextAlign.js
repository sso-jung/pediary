// src/lib/wikiTextAlign.js

/**
 * :::center
 * 내용
 * :::
 *
 * :::right
 * 내용
 * :::
 * 이런 블록을 HTML div + 정렬 클래스로 바꿔준다.
 */
export function applyTextAlignBlocks(markdownText) {
    if (!markdownText) return markdownText;

    // :::center ~ ::: 블록 전체를 찾는 정규식
    const pattern = /^:::(center|left|right|justify)\s*\n([\s\S]*?)\n:::\s*$/gm;

    return markdownText.replace(pattern, (match, align, content) => {
        let cls = 'wiki-align-left';
        if (align === 'center') cls = 'wiki-align-center';
        else if (align === 'right') cls = 'wiki-align-right';
        else if (align === 'justify') cls = 'wiki-align-justify';

        return `<div class="${cls}">\n${content}\n</div>`;
    });
}
