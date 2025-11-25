// pseudo: src/lib/sectionDiff.js
import { extractSectionsFromMarkdown } from './sectionUtils';

export function buildSectionNumberMapping(oldMarkdown, newMarkdown) {
    const oldSections = extractSectionsFromMarkdown(oldMarkdown || '');
    const newSections = extractSectionsFromMarkdown(newMarkdown || '');

    // 텍스트 기준으로 매칭
    const mapByText = new Map();
    oldSections.forEach((s) => {
        const key = s.text; // 필요하면 toLowerCase() 등
        mapByText.set(key, s.number);
    });

    const mappings = []; // { text: "드마리스", oldNumber: "1.1", newNumber: "2.1" }

    newSections.forEach((s) => {
        const key = s.text;
        const oldNumber = mapByText.get(key);
        if (!oldNumber) return;
        if (oldNumber === s.number) return; // 번호 안 바뀐 건 무시

        mappings.push({
            text: key,
            oldNumber,
            newNumber: s.number,
        });
    });

    return mappings;
}
