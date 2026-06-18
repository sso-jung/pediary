export const DEFAULT_OPTION_COLOR = '#e5e7eb';
export const DEFAULT_OPTION_TEXT_COLOR = '#374151';

export const OPTION_COLOR_PRESETS = [
    { color: '#8c8c8c', textColor: '#fafafa' },
    { color: '#d9d9d9', textColor: '#26272a' },
    { color: '#e5e7eb', textColor: '#2f333a' },
    { color: '#f1f1f1', textColor: '#2f333a' },
    { color: '#fee2e2', textColor: '#6c0505' },
    { color: '#fce7f3', textColor: '#800636' },
    { color: '#f6e1e1', textColor: '#af0505' },
    { color: '#fca5a5', textColor: '#670606' },
    { color: '#f87296', textColor: '#fffafa' },
    { color: '#d37878', textColor: '#fffafa' },
    { color: '#9f0000', textColor: '#ffecec' },
    { color: '#c00000', textColor: '#ffffff' },
    { color: '#b6587c', textColor: '#fff9fc' },
    { color: '#ffedd5', textColor: '#9a3412' },
    { color: '#fdba74', textColor: '#6c1f05' },
    { color: '#ff8c67', textColor: '#fff9f7' },
    { color: '#e0795a', textColor: '#fff9f7' },
    { color: '#c43600', textColor: '#fff2e6' },
    { color: '#fef3c7', textColor: '#643705' },
    { color: '#fde68a', textColor: '#673305' },
    { color: '#b78d5c', textColor: '#ffffff' },
    { color: '#8f6350', textColor: '#fffbf6' },
    { color: '#dff1e4', textColor: '#095225' },
    { color: '#94e8b2', textColor: '#055e28' },
    { color: '#cff1eb', textColor: '#035751' },
    { color: '#63beb6', textColor: '#f6fffa' },
    { color: '#409b66', textColor: '#fafffb' },
    { color: '#29a296', textColor: '#f6fffa' },
    { color: '#006426', textColor: '#ebfff2' },
    { color: '#dbeafe', textColor: '#092683' },
    { color: '#93c5fd', textColor: '#072473' },
    { color: '#529af6', textColor: '#ffffff' },
    { color: '#e0e7ff', textColor: '#1a1486' },
    { color: '#6c7bb0', textColor: '#f3f8ff' },
    { color: '#465fa6', textColor: '#f3f8ff' },
    { color: '#002596', textColor: '#e9f5ff' },
    { color: '#58519b', textColor: '#f8f9ff' },
    { color: '#ede9fe', textColor: '#421091' },
    { color: '#E8DBF2', textColor: '#5f4375' },
    { color: '#c4b5fd', textColor: '#35087a' },
    { color: '#b088e0', textColor: '#f4f1ff' },
    { color: '#825fb2', textColor: '#f8f6ff' },
    { color: '#490c98', textColor: '#f0eeff' },
    { color: '#ffffff', textColor: '#374151' },
    { color: '#374151', textColor: '#ffffff' },
    { color: '#545865', textColor: '#ffc1c1' },
    { color: '#012d22', textColor: '#b5ffe5' },
    { color: '#01022d', textColor: '#d0faff' },
    { color: '#e8e8e8', textColor: '#4d0000' },
];

function getOptionPresetTextColor(color = DEFAULT_OPTION_COLOR) {
    return OPTION_COLOR_PRESETS.find((preset) => preset.color === color)?.textColor;
}

export function getOptionTextColor(color = DEFAULT_OPTION_COLOR) {
    return getOptionPresetTextColor(color) || DEFAULT_OPTION_TEXT_COLOR;
}

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

    const color = value.color || value.backgroundColor || DEFAULT_OPTION_COLOR;
    const textColor =
        value.textColor ||
        value.text_color ||
        value.fontColor ||
        value.font_color ||
        DEFAULT_OPTION_TEXT_COLOR;

    return {
        name,
        color,
        textColor: getOptionPresetTextColor(color) || textColor,
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

    const color = option?.color || option?.backgroundColor || DEFAULT_OPTION_COLOR;
    const textColor =
        option?.textColor ||
        option?.text_color ||
        option?.fontColor ||
        option?.font_color ||
        DEFAULT_OPTION_TEXT_COLOR;

    return {
        name,
        color,
        textColor: getOptionPresetTextColor(color) || textColor,
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
