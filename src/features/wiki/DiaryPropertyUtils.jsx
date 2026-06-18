export const PROPERTY_TYPES = [
    { value: 'text', label: '텍스트' },
    { value: 'textarea', label: '긴 텍스트' },
    { value: 'number', label: '숫자' },
    { value: 'number_list', label: '숫자목록' },
    { value: 'check_list', label: '체크목록' },
    { value: 'date', label: '날짜' },
    { value: 'period', label: '기간' },
    { value: 'select', label: '선택' },
    { value: 'multi_select', label: '다중선택' },
];

function makePresetIcon(paths) {
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#5f5f5f">',
        paths,
        '</svg>',
    ].join('');
}

export const PROPERTY_ICON_PRESETS = [
    {
        label: '생각말풍선',
        icon: makePresetIcon('<path d="M9.2 16.6h7.4a5 5 0 0 0 1.1-9.9 5.2 5.2 0 0 0-9.4-1.8 4.3 4.3 0 0 0-3 7.5 4 4 0 0 0 3.9 4.2Zm-3.5 2.1a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Zm-3.1 2.9a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z"/>'),
    },
    {
        label: '해시태그',
        icon: makePresetIcon('<path d="M8.3 3.2h2.2L9.8 8h4.5l.7-4.8h2.2L16.5 8h3.3v2.2h-3.6l-.5 3.6h3.1V16h-3.4l-.7 4.8h-2.2l.7-4.8H8.7L8 20.8H5.8l.7-4.8H3.2v-2.2h3.6l.5-3.6H4.2V8h3.4l.7-4.8Zm1.2 7-.5 3.6h4.5l.5-3.6H9.5Z"/>'),
    },
    {
        label: '목록',
        icon: makePresetIcon('<rect x="4" y="5.2" width="16" height="2.4" rx="1.2"/><rect x="4" y="10.8" width="16" height="2.4" rx="1.2"/><rect x="4" y="16.4" width="16" height="2.4" rx="1.2"/>'),
    },
    {
        label: '해',
        icon: makePresetIcon('<circle cx="12" cy="12" r="4.2"/><rect x="11" y="2" width="2" height="4" rx="1"/><rect x="11" y="18" width="2" height="4" rx="1"/><rect x="2" y="11" width="4" height="2" rx="1"/><rect x="18" y="11" width="4" height="2" rx="1"/><rect x="4.3" y="4" width="2" height="4" rx="1" transform="rotate(-45 5.3 6)"/><rect x="17.7" y="16" width="2" height="4" rx="1" transform="rotate(-45 18.7 18)"/><rect x="16.7" y="5" width="4" height="2" rx="1" transform="rotate(-45 18.7 6)"/><rect x="3.3" y="17" width="4" height="2" rx="1" transform="rotate(-45 5.3 18)"/>'),
    },
    {
        label: '달',
        icon: makePresetIcon('<path d="M20.1 15.1A8.2 8.2 0 0 1 8.9 3.9 9.4 9.4 0 1 0 20.1 15.1Z"/>'),
    },
    {
        label: '하트',
        icon: makePresetIcon('<path d="M12 20.3S3.5 15 3.5 8.8A4.8 4.8 0 0 1 12 5.7a4.8 4.8 0 0 1 8.5 3.1C20.5 15 12 20.3 12 20.3Z"/>'),
    },
    {
        label: '별',
        icon: makePresetIcon('<path d="m12 2.8 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 2.8Z"/>'),
    },
    {
        label: '반짝이',
        icon: makePresetIcon('<path d="M8.7 3.3c.4-1.1 1.9-1.1 2.3 0l1.8 4.9a1.8 1.8 0 0 0 1.1 1.1l4.9 1.8c1.1.4 1.1 1.9 0 2.3l-4.9 1.8a1.8 1.8 0 0 0-1.1 1.1L11 21.2c-.4 1.1-1.9 1.1-2.3 0l-1.8-4.9a1.8 1.8 0 0 0-1.1-1.1L.9 13.4c-1.1-.4-1.1-1.9 0-2.3l4.9-1.8a1.8 1.8 0 0 0 1.1-1.1l1.8-4.9Zm10.1-1.8c.3-.7 1.3-.7 1.6 0l.6 1.6a1.2 1.2 0 0 0 .7.7l1.6.6c.7.3.7 1.3 0 1.6l-1.6.6a1.2 1.2 0 0 0-.7.7l-.6 1.6c-.3.7-1.3.7-1.6 0l-.6-1.6a1.2 1.2 0 0 0-.7-.7L15.9 6c-.7-.3-.7-1.3 0-1.6l1.6-.6a1.2 1.2 0 0 0 .7-.7l.6-1.6Z"/>'),
    },
    {
        label: '책',
        icon: makePresetIcon('<path d="M4 4.2c0-1 .8-1.8 1.8-1.8h12.4c1 0 1.8.8 1.8 1.8v15.6c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V4.2Zm3.2.4v14.8h10.6V4.6H7.2Zm2.1 3.2h6.2v1.8H9.3V7.8Zm0 3.3h5.1v1.7H9.3v-1.7Zm0 3.2h6.2V16H9.3v-1.7Z"/>'),
    },
    {
        label: '달력',
        icon: makePresetIcon('<path d="M7 2.8h2v2h6v-2h2v2h1.2a2.8 2.8 0 0 1 2.8 2.8v10.8a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 18.4V7.6a2.8 2.8 0 0 1 2.8-2.8H7v-2Zm-1.8 8v7.4c0 .5.4.8.8.8h12c.4 0 .8-.3.8-.8v-7.4H5.2Zm2.2 2.4h3v2.3h-3v-2.3Zm6.2 0h3v2.3h-3v-2.3Z"/>'),
    },
    {
        label: '메모',
        icon: makePresetIcon('<path d="M5.6 3.5h10.2L20 7.7v10.7a2.1 2.1 0 0 1-2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1V5.6a2.1 2.1 0 0 1 2.1-2.1Zm9.2 1.9v3.3h3.3l-3.3-3.3ZM7 11v2h10v-2H7Zm0 4v2h7v-2H7Z"/>'),
    },
    {
        label: '체크',
        icon: makePresetIcon('<path fill-rule="evenodd" d="M6.2 4.2h11.6a2 2 0 0 1 2 2v11.6a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2Zm10.2 5.6-1.5-1.3-4.2 4.8-1.7-1.7-1.4 1.4 3.2 3.2 5.6-6.4Z" clip-rule="evenodd"/>'),
    },
    {
        label: '태그',
        icon: makePresetIcon('<path fill-rule="evenodd" d="M4 12.1 12.1 4H20v7.9L11.9 20a2.5 2.5 0 0 1-3.5 0L4 15.6a2.5 2.5 0 0 1 0-3.5ZM16.5 9.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" clip-rule="evenodd"/>'),
    },
    {
        label: '시계',
        icon: makePresetIcon('<path fill-rule="evenodd" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm1.1-13.7h-2.2v5.4l4 2.5 1.1-1.8-2.9-1.7V7.3Z" clip-rule="evenodd"/>'),
    },
    {
        label: '알림',
        icon: makePresetIcon('<path d="M12 2.8a5.8 5.8 0 0 0-5.8 5.8v3.6L4 16.2v1.6h16v-1.6l-2.2-4V8.6A5.8 5.8 0 0 0 12 2.8Zm-2.5 16.3a2.7 2.7 0 0 0 5 0h-5Z"/>'),
    },
    {
        label: '위치',
        icon: makePresetIcon('<path fill-rule="evenodd" d="M12 22s7.2-6.3 7.2-12.2A7.2 7.2 0 0 0 4.8 9.8C4.8 15.7 12 22 12 22Zm0-9.3a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" clip-rule="evenodd"/>'),
    },
    {
        label: '펜',
        icon: makePresetIcon('<path d="M4 20.5 5.6 15 16 4.6a2.9 2.9 0 0 1 4.1 4.1L9.7 19.1 4 20.5Zm11.2-13 2.3 2.3 1.1-1.1a1.6 1.6 0 0 0-2.3-2.3l-1.1 1.1Z"/>'),
    },
    {
        label: '잎',
        icon: makePresetIcon('<path d="M20.8 3.2C11 3.4 4.5 8.4 4.5 15.1c0 3.2 2.1 5.2 5.2 5.2 6.8 0 10.6-7.3 11.1-17.1ZM6.2 19.6C8.8 14.8 12.5 11 17.8 7.5 14.6 11.6 10.8 15.7 6.2 19.6Z"/>'),
    },
    {
        label: '웃음',
        icon: makePresetIcon('<path fill-rule="evenodd" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.6 10.8a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm6.8 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm-6.7 3.1c.8 2 2.1 3 3.3 3s2.5-1 3.3-3H8.7Z" clip-rule="evenodd"/>'),
    },
];

function isSvgIcon(icon = '') {
    return String(icon || '').trim().startsWith('<svg');
}

function isImageIcon(icon = '') {
    return String(icon || '').trim().startsWith('data:image/');
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
                className="h-[18px] w-[18px] object-contain"
            />
        );
    }

    if (isImageIcon(icon)) {
        return (
            <span className="inline-flex h-[18px] w-[18px] items-center justify-center">
                <img
                    src={String(icon || '')}
                    alt=""
                    className="h-[15px] w-[15px] object-contain"
                />
            </span>
        );
    }

    return <span>{icon || ''}</span>;
}
