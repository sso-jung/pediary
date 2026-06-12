// src/lib/internalLinkMeta.js
import { findSectionByNumber } from './wikiSectionUtils';

export function getInternalLinkTarget(parsed) {
    if (!parsed) return '';
    return `doc:${parsed.docId}${parsed.section ? `#${parsed.section}` : ''}`;
}

export function getDocumentById(documents = [], docId) {
    return (documents || []).find((doc) => Number(doc?.id) === Number(docId)) || null;
}

export function getCategoryPath(doc, categories = []) {
    if (!doc?.category_id) return '미분류';

    const categoryMap = new Map(
        (categories || [])
            .filter((category) => category && !category.deleted_at)
            .map((category) => [Number(category.id), category])
    );

    const names = [];
    const visited = new Set();

    let current = categoryMap.get(Number(doc.category_id));

    while (current && !visited.has(Number(current.id))) {
        visited.add(Number(current.id));
        names.unshift(current.name);

        if (current.parent_id == null) break;
        current = categoryMap.get(Number(current.parent_id));
    }

    return names.length > 0 ? names.join(' > ') : '미분류';
}

export function getInternalLinkDisplayLabel(parsed, doc) {
    if (!parsed) return '';

    if (parsed.label) return parsed.label;

    if (!doc) {
        return getInternalLinkTarget(parsed);
    }

    if (parsed.section) {
        return `${doc.title}#${parsed.section}`;
    }

    return doc.title;
}

export function getInternalLinkTooltip({ parsed, doc, categories = [] }) {
    if (!parsed) return '';

    if (!doc) {
        return parsed.label || getInternalLinkTarget(parsed);
    }

    const categoryPath = getCategoryPath(doc, categories);
    const base = `${categoryPath} > ${doc.title}`;

    if (!parsed.section) {
        return base;
    }

    const section = findSectionByNumber(doc.content_markdown || '', parsed.section);
    const sectionText = section?.text || parsed.label || '';

    return `${base} : ${parsed.section}${sectionText ? ` ${sectionText}` : ''}`;
}