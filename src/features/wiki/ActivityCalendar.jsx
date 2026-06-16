// src/features/wiki/ActivityCalendar.jsx
import { useEffect, useRef, useState } from 'react';
import DiaryEditor from './DiaryEditor';
import DiarySettings from './DiarySettings';
import { useDiariesByDateRange } from './hooks/useDiariesByDateRange';
import { useHolidays } from './hooks/useHolidays';

const VIEW_LABEL = {
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    timeline: 'TIMELINE',
};

function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
}

function getWeekStart(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - start.getDay());
    return start;
}

function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNextDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return getDateKey(new Date(year, month - 1, day + 1));
}

function getDiaryPreview(content = '') {
    return content.replace(/\s+/g, ' ').trim();
}

function getDiaryPreviewText(diary) {
    const textareaValue = (diary?.diary_property_values || [])
        .filter((item) => item.diary_properties?.type === 'textarea')
        .sort(
            (a, b) =>
                (a.diary_properties?.sort_order ?? 0) -
                (b.diary_properties?.sort_order ?? 0),
        )
        .map((item) => item.value?.text || '')
        .find((text) => text.trim());

    return getDiaryPreview(textareaValue || diary?.content_markdown || '');
}

function getDayTextColor(dayIndex, isHoliday = false) {
    if (isHoliday) return '#ef4444';
    if (dayIndex === 0) return '#ef4444';
    if (dayIndex === 6) return '#3b82f6';
    return 'var(--color-text-main)';
}

function CalendarDropdown({ value, label, options, onChange, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={'relative ' + className} ref={menuRef}>
            <button
                type="button"
                className="ui-input flex h-[30px] w-full items-center justify-between gap-2 !rounded-md !px-2.5 !py-0 !text-left !text-[12px]"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
            >
                <span className="min-w-0 truncate">{label}</span>
                <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5 shrink-0 page-text-muted"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M5.5 7.5L10 12l4.5-4.5" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-[34px] z-30 max-h-72 w-full overflow-y-auto rounded-md border py-1 text-[12px] shadow-lg"
                    style={{
                        borderColor: 'var(--color-border-subtle)',
                        backgroundColor: 'var(--color-page-surface)',
                        color: 'var(--color-text-main)',
                    }}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={
                                'block w-full whitespace-normal break-keep px-2 py-1.5 text-left leading-snug ui-side-subitem ' +
                                (option.value === value ? 'ui-side-subitem-active' : '')
                            }
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ActivityCalendar() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1~12
    const [calendarView, setCalendarView] = useState('monthly');
    const [editorDate, setEditorDate] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [weekDate, setWeekDate] = useState(
        () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const { data: holidays } = useHolidays(year);
    const holidayDateSet = new Set((holidays || []).map((holiday) => holiday.holiday_date));

    const handleChangeCalendarView = (nextView) => {
        if (nextView === 'weekly' && calendarView !== 'weekly') {
            const isThisMonth =
                year === today.getFullYear() &&
                month === today.getMonth() + 1;
            const day = isThisMonth ? today.getDate() : 1;
            setWeekDate(new Date(year, month - 1, day));
        }

        setCalendarView(nextView);
    };

    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0(일)~6(토)
    const daysInMonth = new Date(year, month, 0).getDate();

    const weeks = [];
    let day = 1 - startWeekday;

    for (let w = 0; w < 6; w++) {
        const week = [];
        for (let i = 0; i < 7; i += 1, day += 1) {
            if (day < 1 || day > daysInMonth) week.push(null);
            else week.push(day);
        }
        weeks.push(week);
    }
    const visibleWeeks = weeks.filter((week) => week.some((d) => d));

    const handlePrevMonth = () => {
        setMonth((m) => {
            if (m === 1) {
                setYear((y) => y - 1);
                return 12;
            }
            return m - 1;
        });
    };

    const handleNextMonth = () => {
        setMonth((m) => {
            if (m === 12) {
                setYear((y) => y + 1);
                return 1;
            }
            return m + 1;
        });
    };

    const handleMoveWeek = (amount) => {
        const next = addDays(weekDate, amount);
        setWeekDate(next);
        setYear(next.getFullYear());
        setMonth(next.getMonth() + 1);
    };

    const handlePrev = () => {
        if (calendarView === 'weekly') {
            handleMoveWeek(-7);
            return;
        }
        if (calendarView === 'timeline') {
            setYear((y) => y - 1);
            return;
        }
        handlePrevMonth();
    };

    const handleNext = () => {
        if (calendarView === 'weekly') {
            handleMoveWeek(7);
            return;
        }
        if (calendarView === 'timeline') {
            setYear((y) => y + 1);
            return;
        }
        handleNextMonth();
    };

    const handleToday = () => {
        const next = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        setYear(next.getFullYear());
        setMonth(next.getMonth() + 1);
        setWeekDate(next);
    };

    const handleOpenDiary = (dateKey) => {
        setEditorDate(dateKey);
    };

    const weekStart = getWeekStart(weekDate);
    const weekDays = Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
    const todayKey = getDateKey(today);
    const monthStartKey = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndKey = getDateKey(new Date(year, month, 1));
    const weekStartKey = getDateKey(weekStart);
    const weekEndKey = getNextDateKey(getDateKey(weekDays[6]));
    const rangeStartKey = calendarView === 'weekly' ? weekStartKey : monthStartKey;
    const rangeEndKey = calendarView === 'weekly' ? weekEndKey : monthEndKey;
    const { data: diaries } = useDiariesByDateRange(
        rangeStartKey,
        rangeEndKey,
        calendarView === 'weekly' || calendarView === 'monthly',
    );
    const diaryMap = new Map((diaries || []).map((diary) => [diary.diary_date, diary]));

    const yearOptions = [];
    const baseYear = today.getFullYear();
    for (let y = baseYear - 3; y <= baseYear + 1; y += 1) {
        yearOptions.push(y);
    }
    const monthOptions = Array.from({ length: 12 }).map((_, i) => i + 1);

    return (
        <div className="h-full min-h-0 text-xs">
            <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 border-b border-border-subtle pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {['weekly', 'monthly', 'timeline'].map((view) => (
                                <button
                                    key={view}
                                    type="button"
                                    onClick={() => handleChangeCalendarView(view)}
                                    className={
                                        'rounded-full border px-3.5 py-1 text-[13px] font-semibold tracking-[0.02em] transition ' +
                                        (calendarView === view
                                            ? 'text-[var(--color-text-main)]'
                                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-panel-bg)]')
                                    }
                                    style={
                                        calendarView === view
                                            ? {
                                                backgroundColor: 'var(--color-page-surface-2)',
                                                borderColor: 'var(--color-border-subtle)',
                                            }
                                            : {
                                                borderColor: 'transparent',
                                            }
                                    }
                                >
                                    {VIEW_LABEL[view]}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => handleOpenDiary(todayKey)}
                                className="ui-control flex h-8 w-8 items-center justify-center rounded-full"
                                aria-label="작성"
                                title="작성"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M15.8 4.8l3.4 3.4" />
                                    <path d="M6.2 17.8l3.5-.7 9.1-9.1a2.4 2.4 0 0 0-3.4-3.4l-9.1 9.1-.7 3.5a.5.5 0 0 0 .6.6z" />
                                    <path d="M5 20h14" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(true)}
                                className="ui-control flex h-8 w-8 items-center justify-center rounded-full"
                                aria-label="다이어리 설정"
                                title="다이어리 설정"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" />
                                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 0 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8a2 2 0 0 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 .9-1.6V2.8a2 2 0 0 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6.9h.2a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1z" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {calendarView === 'monthly' ? (
                                <>
                                    <CalendarDropdown
                                        className="w-[86px]"
                                        value={year}
                                        label={`${year}년`}
                                        options={yearOptions.map((y) => ({ value: y, label: `${y}년` }))}
                                        onChange={setYear}
                                    />
                                    <CalendarDropdown
                                        className="w-[70px]"
                                        value={month}
                                        label={`${month}월`}
                                        options={monthOptions.map((m) => ({ value: m, label: `${m}월` }))}
                                        onChange={setMonth}
                                    />
                                </>
                            ) : (
                                <span
                                    className="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
                                    style={{
                                        backgroundColor: 'var(--color-page-surface-2)',
                                        borderColor: 'var(--color-border-subtle)',
                                        color: 'var(--color-text-main)',
                                    }}
                                >
                                    {calendarView === 'timeline' ? `${year}년` : `${year}년 ${month}월`}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="ui-control h-6 w-6 rounded-full"
                                aria-label="이전"
                            >
                                <svg
                                    viewBox="0 0 20 20"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M12.5 5L7.5 10l5 5" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={handleToday}
                                className="rounded px-1.5 py-1 text-[12px] font-medium"
                                style={{ color: 'var(--color-text-main)' }}
                            >
                                오늘
                            </button>
                            <button
                                type="button"
                                onClick={handleNext}
                                className="ui-control h-6 w-6 rounded-full"
                                aria-label="다음"
                            >
                                <svg
                                    viewBox="0 0 20 20"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M7.5 5l5 5-5 5" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-auto pt-3">
                    {calendarView === 'timeline' ? (
                        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2 text-[12px]">
                            {monthOptions.map((timelineMonth) => (
                                <div
                                    key={timelineMonth}
                                    className="min-w-[86px] flex-1"
                                >
                                    <div
                                        className="px-2 py-2 text-center font-semibold"
                                        style={{
                                            color: 'var(--color-text-main)',
                                        }}
                                    >
                                        {timelineMonth}월
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="grid shrink-0 grid-cols-7 pb-[7px] text-[11.5px]">
                                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                                    <div
                                        key={d}
                                        className="px-2 py-1 text-center font-medium"
                                        style={{ color: 'var(--color-text-main)' }}
                                    >
                                        {d}
                                    </div>
                                ))}
                            </div>

                            <div
                                className={
                                    'grid grid-cols-7 border-l border-t border-border-subtle text-[11px] ' +
                                    (calendarView === 'weekly' ? 'min-h-0 flex-1' : '')
                                }
                            >
                                {calendarView === 'monthly' ? (
                                    visibleWeeks.map((week, wi) =>
                                        week.map((d, di) => {
                                            if (!d) {
                                                return (
                                                    <div
                                                        key={`${wi}-${di}`}
                                                        className="min-h-[132px] border-b border-r border-border-subtle bg-transparent"
                                                    />
                                                );
                                            }

                                            const key = `${year}-${String(month).padStart(
                                                2,
                                                '0',
                                            )}-${String(d).padStart(2, '0')}`;
                                            const isToday = key === todayKey;
                                            const isHoliday = holidayDateSet.has(key);
                                            const diary = diaryMap.get(key);
                                            const preview = getDiaryPreviewText(diary);

                                            return (
                                                <button
                                                    type="button"
                                                    key={`${wi}-${di}`}
                                                    onClick={() => handleOpenDiary(key)}
                                                    className="flex min-h-[132px] flex-col border-b border-r border-border-subtle px-2 py-1.5 text-left transition hover:bg-[var(--color-panel-bg)]"
                                                >
                                                    <div className="flex items-start justify-end">
                                                        <span
                                                            className={
                                                                'inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] leading-none ' +
                                                                (isToday ? 'bg-red-500 text-white' : '')
                                                            }
                                                            style={isToday ? undefined : { color: getDayTextColor(di, isHoliday) }}
                                                        >
                                                            {d}
                                                        </span>
                                                    </div>
                                                    {diary && (
                                                        <div className="mt-2 min-w-0">
                                                            <div
                                                                className="mb-1 h-1.5 w-1.5 rounded-full"
                                                                style={{ backgroundColor: 'var(--color-accent)' }}
                                                            />
                                                            {preview && (
                                                                <p className="line-clamp-2 break-words text-[11px] leading-snug text-[var(--color-text-muted)]">
                                                                    {preview}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        }),
                                    )
                                ) : (
                                    weekDays.map((date) => {
                                        const key = getDateKey(date);
                                        const isToday = key === todayKey;
                                        const isHoliday = holidayDateSet.has(key);
                                        const diary = diaryMap.get(key);
                                        const preview = getDiaryPreviewText(diary);

                                        return (
                                            <button
                                                type="button"
                                                key={key}
                                                onClick={() => handleOpenDiary(key)}
                                                className="flex min-h-[34rem] flex-col border-b border-r border-border-subtle px-3 py-2 text-left transition hover:bg-[var(--color-panel-bg)]"
                                            >
                                                <div className="flex items-start justify-end">
                                                    <span
                                                        className={
                                                            'inline-flex h-[24px] w-[24px] items-center justify-center rounded-full text-[12px] leading-none ' +
                                                            (isToday ? 'bg-red-500 text-white' : '')
                                                        }
                                                        style={isToday ? undefined : { color: getDayTextColor(date.getDay(), isHoliday) }}
                                                    >
                                                        {date.getDate()}
                                                    </span>
                                                </div>
                                                {diary && (
                                                    <div className="mt-3 min-w-0">
                                                        <div
                                                            className="mb-2 h-1.5 w-1.5 rounded-full"
                                                            style={{ backgroundColor: 'var(--color-accent)' }}
                                                        />
                                                        {preview && (
                                                            <p className="line-clamp-4 break-words text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                                                                {preview}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <DiaryEditor
                open={!!editorDate}
                diaryDate={editorDate}
                onClose={() => setEditorDate(null)}
            />
            <DiarySettings
                open={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}
