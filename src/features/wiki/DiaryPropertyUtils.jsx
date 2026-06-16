export const PROPERTY_TYPES = [
    { value: 'text', label: '텍스트' },
    { value: 'textarea', label: '긴 텍스트' },
    { value: 'number', label: '숫자' },
    { value: 'date', label: '날짜' },
    { value: 'period', label: '기간' },
    { value: 'select', label: '선택' },
    { value: 'multi_select', label: '다중선택' },
];

function isSvgIcon(icon = '') {
    return String(icon || '').trim().startsWith('<svg');
}

function getSvgIconSrc(icon = '') {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(icon || ''))}`;
}

export function PropertyIcon({ icon }) {
    if (isSvgIcon(icon)) {
        return (
            <img
                src={getSvgIconSrc(icon)}
                alt=""
                className="h-4 w-4 object-contain"
            />
        );
    }

    return <span>{icon || ''}</span>;
}
