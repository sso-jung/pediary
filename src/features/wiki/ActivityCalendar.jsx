// src/features/wiki/ActivityCalendar.jsx
import { useMemo, useState, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMonthlyActivity } from './hooks/useMonthlyActivity';
import { getLocalDateKey } from '../../lib/dateUtils';

// 색상: 열람=노랑, 수정=파랑, 작성=보라
const ACTION_STYLES = {
    viewed:  'ui-badge ui-badge-viewed',
    updated: 'ui-badge ui-badge-updated',
    created: 'ui-badge ui-badge-created',
};

const ACTION_STYLE_OFF = 'ui-badge-off';

const ACTION_LABEL = {
    created: '작성',
    updated: '수정',
    viewed: '열람',
};

// 같은 날 같은 문서가 여러 번 있을 때 우선순위
const ACTION_PRIORITY = {
    viewed: 1,
    updated: 2,
    created: 3,
};

function BadgeSummary({ items, maxLines = 2 }) {
    const wrapRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(null); // null = 아직 측정 전

    const measure = () => {
        const el = wrapRef.current;
        if (!el) return;

        const badges = Array.from(el.querySelectorAll("[data-badge='1']"));
        if (badges.length === 0) {
            setVisibleCount(0);
            return;
        }

        // maxLines까지 허용되는 마지막 줄 top 계산
        const tops = [];
        for (const b of badges) {
            const t = b.offsetTop;
            if (!tops.includes(t)) tops.push(t);
        }
        tops.sort((a, b) => a - b);
        const allowedTops = tops.slice(0, maxLines);

        const countInLines = badges.filter((b) => allowedTops.includes(b.offsetTop)).length;

        setVisibleCount((prev) => (prev === countInLines ? prev : countInLines));
    };

    useLayoutEffect(() => {
        // items 내용(제목 길이)까지 바뀌어도 측정되도록
        measure();
        const el = wrapRef.current;
        if (!el) return;

        const ro = new ResizeObserver(() => measure());
        ro.observe(el);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, maxLines]);

    // 1) 측정 전에는 "측정용"으로 전체 렌더링 (하지만 +N은 렌더링하지 않음)
    if (visibleCount === null) {
        return (
            <div ref={wrapRef} className="flex flex-wrap gap-0.5">
                {items.map((item) => {
                    const action = item.action;
                    const style = ACTION_STYLES[action] || ACTION_STYLES.viewed;
                    const title = item.documents?.title ?? "(삭제됨)";

                    return (
                        <span
                            key={item.id}
                            data-badge="1"
                            className={
                                "inline-flex items-center rounded-full px-1.5 py-[2px] text-[10px] max-w-full min-w-0 " +
                                style
                            }
                        >
              <span className="max-w-[80px] truncate">{title}</span>
            </span>
                    );
                })}
            </div>
        );
    }

    // 2) 측정 후에는 "표시용" 렌더링 (visibleCount만큼 + 필요하면 +N 하나)
    const safeVisible = Math.min(visibleCount, items.length);
    const shown = items.slice(0, safeVisible);
    const hidden = items.length - safeVisible;

    return (
        <div ref={wrapRef} className="flex flex-wrap gap-0.5">
            {shown.map((item) => {
                const action = item.action;
                const style = ACTION_STYLES[action] || ACTION_STYLES.viewed;
                const title = item.documents?.title ?? "(삭제됨)";

                return (
                    <span
                        key={item.id}
                        data-badge="1"
                        className={
                            "inline-flex items-center rounded-full px-1.5 py-[2px] text-[10px] max-w-full min-w-0 " +
                            style
                        }
                    >
            <span className="max-w-[80px] truncate">{title}</span>
          </span>
                );
            })}

            {hidden > 0 && (
                <span
                    className="ui-badge-off inline-flex items-center rounded-full px-1.5 py-[2px] text-[10px]"
                >
          +{hidden}
        </span>
            )}
        </div>
    );
}

export default function ActivityCalendar() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1~12

    const { data, isLoading } = useMonthlyActivity(year, month);

    // 액션 필터 상태: true = ON, false = OFF
    const [actionFilter, setActionFilter] = useState({
        created: true,
        updated: true,
        viewed: true,
    });

    const toggleAction = (action) => {
        setActionFilter((prev) => ({
            ...prev,
            [action]: !prev[action],
        }));
    };

    // 날짜별 + 문서별로 묶고, 같은 날 같은 문서 여러 번이면
    // 작성 > 수정 > 열람 중 하나만 남기기
    // actionFilter 에 따라 걸러진 결과로 계산
    const activityByDate = useMemo(() => {
        if (!data) return {};

        const temp = {}; // { 'YYYY-MM-DD': { docId: item } }

        for (const item of data) {
            const action = item.action;

            // OFF 된 액션은 완전히 제외
            if (!actionFilter[action]) continue;

            const key = getLocalDateKey(item.created_at);
            const doc = item.documents;
            const docId = doc?.id;
            if (!docId) continue;

            if (!temp[key]) temp[key] = {};

            const prev = temp[key][docId];
            const currentPriority = ACTION_PRIORITY[action] ?? 0;
            const prevPriority = prev ? ACTION_PRIORITY[prev.action] ?? 0 : 0;

            // 우선순위가 더 높다면 교체
            if (!prev || currentPriority > prevPriority) {
                temp[key][docId] = item;
            }
        }

        // { dateKey: [item, item, ...] } 형태로 변환
        const result = {};
        Object.keys(temp).forEach((dateKey) => {
            result[dateKey] = Object.values(temp[dateKey]);
        });

        return result;
    }, [data, actionFilter]);

    const [selectedDateKey, setSelectedDateKey] = useState(null);

    const handleSelectDate = (key) => {
        const items = activityByDate[key] || [];
        if (!items.length) {
            setSelectedDateKey(null);
            return;
        }
        setSelectedDateKey(key);
    };

    // 달력용 날짜 계산
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0(일)~6(토)
    const daysInMonth = new Date(year, month, 0).getDate();

    const weeks = [];
    let day = 1 - startWeekday; // 그리드 시작 offset

    for (let w = 0; w < 6; w++) {
        const week = [];
        for (let i = 0; i < 7; i += 1, day += 1) {
            if (day < 1 || day > daysInMonth) week.push(null);
            else week.push(day);
        }
        weeks.push(week);
    }

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

    // 연/월 선택 셀렉트용 배열
    const yearOptions = [];
    const baseYear = today.getFullYear();
    for (let y = baseYear - 3; y <= baseYear + 1; y += 1) {
        yearOptions.push(y);
    }

    return (
        <div className="mt-3 space-y-3 text-xs">
            {/* 상단 컨트롤바: 년/월 선택 + 이전/다음 */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <select
                        className="ui-control rounded-lg px-2 py-1 text-xs"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>
                                {y}년
                            </option>
                        ))}
                    </select>
                    <select
                        className="ui-control rounded-lg px-2 py-1 text-xs"
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                    >
                        {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {i + 1}월
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="ui-control rounded-full px-2 py-1"
                    >
                        ◀
                    </button>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="ui-control rounded-full px-2 py-1"
                    >
                        ▶
                    </button>
                </div>
            </div>

            {/* 행동 legend: 클릭해서 ON/OFF */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                {['viewed', 'updated', 'created'].map((action) => {
                    const isOn = actionFilter[action];
                    const style = isOn ? ACTION_STYLES[action] : ACTION_STYLE_OFF;

                    return (
                        <button
                            key={action}
                            type="button"
                            onClick={() => toggleAction(action)}
                            className="focus:outline-none"
                        >
                            <span
                                className={
                                    'inline-flex items-center rounded-full px-2 py-[2px] transition ' +
                                    style
                                }
                            >
                                {ACTION_LABEL[action]}
                            </span>
                        </button>
                    );
                })}
                <span className="ml-1 text-[10px] text-slate-400">
                    뱃지를 클릭해서 작성/수정/열람 표시를 켜고 끌 수 있어.
                </span>
            </div>

            {/* 로딩 / 달력 */}
            {isLoading ? (
                <p className="mt-3 text-xs text-slate-500">
                    활동 기록을 불러오는 중...
                </p>
            ) : (
                <div className="ui-panel rounded-2xl p-3">
                    {/* 요일 헤더 */}
                    <div className="mb-1 grid grid-cols-7 gap-1 text-[11px] font-semibold ui-page-subtitle">
                        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                            <div key={d} className="text-center">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* 날짜 그리드 */}
                    <div className="grid grid-cols-7 gap-1 text-[11px]">
                        {weeks.map((week, wi) =>
                            week.map((d, di) => {
                                if (!d) {
                                    return (
                                        <div
                                            key={`${wi}-${di}`}
                                            className="h-24 rounded-xl bg-transparent"
                                        />
                                    );
                                }

                                const key = `${year}-${String(month).padStart(
                                    2,
                                    '0',
                                )}-${String(d).padStart(2, '0')}`;
                                const items = activityByDate[key] || [];
                                const summaryItems = items.slice(0, 3);

                                return (
                                    <button
                                        type="button"
                                        key={`${wi}-${di}`}
                                        onClick={() => handleSelectDate(key)}
                                        className={'ui-day flex h-24 flex-col rounded-xl p-1.5 text-left overflow-hidden' }
                                        data-selected={selectedDateKey === key}
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-[11px] font-medium"
                                                  style={{color: "var(--color-text-main)"}}>
                                                {d}
                                            </span>
                                            {items.length > 0 && (
                                                <span className="text-[10px] text-slate-400">
                                                    {items.length}건
                                                </span>
                                            )}
                                        </div>

                                        {/* 문서 뱃지들 – 최대 3개만 표시 */}
                                        <BadgeSummary items={items} maxLines={2} />
                                    </button>
                                );
                            }),
                        )}
                    </div>
                </div>
            )}

            {/* 선택한 날짜 상세 – 화면 중앙 모달 */}
            {selectedDateKey && (
                <div
                    className="ui-modal-backdrop fixed inset-0 z-30 flex items-center justify-center"
                    onClick={() => setSelectedDateKey(null)} // 바깥 아무 곳 클릭 시 닫기
                >
                    <div
                        className="ui-modal w-full max-w-md rounded-2xl p-4 shadow-xl text-xs"
                        onClick={(e) => e.stopPropagation()} // 모달 안쪽 클릭은 전파 막기
                    >
                        {(() => {
                            const items = (activityByDate[selectedDateKey] || [])
                                .slice()
                                .sort(
                                    (a, b) =>
                                        new Date(b.created_at).getTime() -
                                        new Date(a.created_at).getTime(),
                                );
                            const [y, m, d] = selectedDateKey.split('-');

                            return (
                                <>
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="text-[11px] font-semibold text-slate-600">
                                            {y}년 {Number(m)}월 {Number(d)}일 활동
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedDateKey(null)
                                            }
                                            className="text-[11px]"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
                                            닫기 ✕
                                        </button>
                                    </div>

                                    {items.length === 0 ? (
                                        <p className="text-[11px] text-slate-400">
                                            이 날에는 활동 기록이 없어.
                                        </p>
                                    ) : (
                                        <ul className="max-h-64 space-y-1 overflow-y-auto">
                                            {items.map((item) => {
                                                const doc = item.documents;
                                                const title =
                                                    doc?.title ?? '(삭제됨)';
                                                const href = doc?.slug
                                                    ? `/wiki/${doc.slug}`
                                                    : null;
                                                const action = item.action;
                                                const label =
                                                    ACTION_LABEL[action] ??
                                                    action;

                                                return (
                                                    <li
                                                        key={item.id}
                                                        className="flex items-center justify-between rounded-lg ui-surface-2 px-2 py-1"
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            <span
                                                                className={
                                                                    'rounded-full px-1.5 py-[1px] text-[10px] ' +
                                                                    ACTION_STYLES[
                                                                        action
                                                                        ]
                                                                }
                                                            >
                                                                {label}
                                                            </span>
                                                            {href ? (
                                                                <Link
                                                                    to={href}
                                                                    className="text-[11px] underline-offset-2 hover:underline"
                                                                    style={{ color: "var(--color-text-main)" }}
                                                                >
                                                                    {title}
                                                                </Link>
                                                            ) : (
                                                                <span className="text-[11px] underline-offset-2" style={{ color: "var(--color-text-main)" }}>
                                                                    {title}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px]"
                                                              style={{color: "var(--color-text-muted)"}}>
                                                            {new Date(
                                                                item.created_at,
                                                            ).toLocaleTimeString(
                                                                'ko-KR',
                                                                {
                                                                    hour: '2-digit',
                                                                    minute:
                                                                        '2-digit',
                                                                },
                                                            )}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
