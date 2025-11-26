// src/lib/internalLinkFormat.js

/**
 * "[[...]]" 안쪽 문자열(inner)을 파싱한다.
 *
 * 지원 포맷:
 *   - "doc:123"
 *   - "doc:123#1.1"
 *   - "doc:123#1.1|레이블"
 *
 * 리턴:
 *   - { docId: number, section: string|null, label: string|null }
 *   - 파싱 실패 시 null
 */
export function parseInternalLinkInner(inner) {
    if (!inner) return null;

    let left = inner;
    let alias = null;

    // 1) alias 분리 ("doc:123#1.1|레이블")
    const pipeIndex = inner.indexOf('|');
    if (pipeIndex >= 0) {
        left = inner.slice(0, pipeIndex);
        alias = inner.slice(pipeIndex + 1);
    }

    // 2) 섹션 분리 ("doc:123#1.1")
    let base = left;
    let sectionRaw = '';
    const hashIndex = left.indexOf('#');
    if (hashIndex >= 0) {
        base = left.slice(0, hashIndex);
        sectionRaw = left.slice(hashIndex + 1);
    }

    const section = sectionRaw.trim() || null;
    const label = (alias || '').trim() || null;

    // 3) doc:<id> 파싱
    const prefix = 'doc:';
    if (!base.startsWith(prefix)) {
        return null; // 우리가 지원하는 포맷이 아님
    }

    const idStr = base.slice(prefix.length).trim();
    const docId = Number(idStr);
    if (!Number.isInteger(docId) || docId <= 0) {
        return null;
    }

    return {
        docId,
        section,
        label,
    };
}

/**
 * 내부 링크 문자열 만들기
 *
 *   buildInternalLink({ docId: 123, section: "1.1", label: "드마리스" })
 *   → "[[doc:123#1.1|드마리스]]"
 */
export function buildInternalLink({ docId, section, label }) {
    let inner = `doc:${docId}`;

    if (section) {
        inner += `#${section}`;
    }

    if (label && label.trim()) {
        inner += `|${label.trim()}`;
    }

    return `[[${inner}]]`;
}
