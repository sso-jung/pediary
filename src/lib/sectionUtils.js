// src/lib/sectionUtils.js

function stripHeadingText(rawText = '') {
    let s = rawText;
    s = s.replace(/<[^>]*>/g, '');
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
    s = s.replace(/[*_`~]/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

// 마크다운에서 헤딩 정보 추출
export function extractSectionsFromMarkdown(markdown) {
    if (!markdown) return [];

    const lines = markdown.split('\n');
    const counters = [0, 0, 0, 0, 0, 0, 0]; // 1~6

    const sections = [];

    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (!match) continue;

        const hashes = match[1];
        const level = hashes.length;
        const rawText = match[2].trim();
        const plainText = stripHeadingText(rawText);

        counters[level] += 1;
        for (let i = level + 1; i < counters.length; i++) {
            counters[i] = 0;
        }

        const nums = counters.slice(1, level + 1).filter((n) => n > 0);
        const number = nums.join('.'); // "1", "1.1", ...

        sections.push({
            level,
            number,     // "1.1"
            text: plainText, // "드마리스"
        });
    }

    return sections;
}
