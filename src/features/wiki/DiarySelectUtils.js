export const DEFAULT_OPTION_COLOR = '#e5e7eb';
export const DEFAULT_OPTION_TEXT_COLOR = '#374151';

export function normalizeOptionValue(value) {
    if (!value) return null;

    if (typeof value === 'string') {
        const name = value.trim();
        return name
            ? {
                name,
                color: DEFAULT_OPTION_COLOR,
                textColor: DEFAULT_OPTION_TEXT_COLOR,
            }
            : null;
    }

    const name = String(value.name || value.option || '').trim();
    if (!name) return null;

    return {
        name,
        color: value.color || value.backgroundColor || DEFAULT_OPTION_COLOR,
        textColor:
            value.textColor ||
            value.text_color ||
            value.fontColor ||
            value.font_color ||
            DEFAULT_OPTION_TEXT_COLOR,
    };
}

export function normalizeOptionValues(values) {
    if (!Array.isArray(values)) return [];

    return values
        .map(normalizeOptionValue)
        .filter(Boolean);
}

export function getOptionName(value) {
    return normalizeOptionValue(value)?.name || '';
}

export function makeOptionValue(option) {
    const name = String(option?.name || '').trim();

    return {
        name,
        color: option?.color || option?.backgroundColor || DEFAULT_OPTION_COLOR,
        textColor:
            option?.textColor ||
            option?.text_color ||
            option?.fontColor ||
            option?.font_color ||
            DEFAULT_OPTION_TEXT_COLOR,
    };
}

export function getOptionKey(name) {
    return String(name || '').trim().toLowerCase();
}

export function buildOptionMetaMap(options = []) {
    const map = new Map();

    options.forEach((option) => {
        const normalized = makeOptionValue(option);
        if (!normalized.name) return;

        map.set(getOptionKey(normalized.name), normalized);
    });

    return map;
}

export function mergeLatestOptionMeta(value, optionMetaMap) {
    const normalized = normalizeOptionValue(value);
    if (!normalized) return null;

    const latest = optionMetaMap?.get(getOptionKey(normalized.name));

    return {
        ...normalized,
        color: latest?.color || normalized.color,
        textColor: latest?.textColor || normalized.textColor,
    };
}