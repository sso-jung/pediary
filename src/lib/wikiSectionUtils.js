// src/lib/wikiSectionUtils.js

export function stripHeadingText(rawText = '') {
    let s = rawText;
    s = s.replace(/<[^>]*>/g, '');
    s = s.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
    s = s.replace(/\\([\\`*_[\]{}()#+\-.!|~>])/g, '$1');
    s = s.replace(/[*_`~]/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

export function extractSectionsFromMarkdown(markdown = '') {
    if (!markdown) return [];

    const lines = markdown.split('\n');
    const counters = [0, 0, 0, 0, 0, 0, 0];
    const sections = [];

    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (!match) continue;

        const hashes = match[1];
        const level = hashes.length;
        const rawText = match[2].trim();
        const plainText = stripHeadingText(rawText);

        if (!plainText) continue;

        counters[level] += 1;
        for (let i = level + 1; i < counters.length; i += 1) {
            counters[i] = 0;
        }

        const nums = counters.slice(1, level + 1).filter((n) => n > 0);
        const number = nums.join('.');

        sections.push({
            level,
            number,
            text: plainText,
        });
    }

    return sections;
}

export function findSectionByNumber(markdown = '', sectionNumber = '') {
    if (!sectionNumber) return null;
    return extractSectionsFromMarkdown(markdown).find(
        (section) => section.number === sectionNumber
    ) || null;
}
