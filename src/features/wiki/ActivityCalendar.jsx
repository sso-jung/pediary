// src/features/wiki/ActivityCalendar.jsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMonthlyActivity } from './hooks/useMonthlyActivity';

// 색상: 열람=노랑, 수정=파랑, 작성=보라
const ACTION_STYLES = {
    viewed: 'bg-amber-100 text-amber-700 border border-amber-200',   // 열람
    updated: 'bg-sky-100 text-sky-700 border border-sky-200',        // 수정
    created: 'bg-purple-100 text-purple-700 border border-purple-200', // 작성
};

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

export default function ActivityCalendar() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1); // 1~12

    const { data, isLoading } = useMonthlyActivity(year, month);

    // 날짜별 + 문서별로 묶고, 같은 날 같은 문서 여러 번이면
    // 작성 > 수정 > 열람 중 하나만 남기기
    const activityByDate = useMemo(() => {
        if (!data) return {};

        const temp = {}; // { 'YYYY-MM-DD': { docId: item } }

        for (const item of data) {
            const d = new Date(item.created_at);
            const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
            const doc = item.documents;
            const docId = doc?.id;
            if (!docId) continue;

            if (!temp[key]) temp[key] = {};

            const prev = temp[key][docId];
            const currentPriority = ACTION_PRIORITY[item.action] ?? 0;
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
    }, [data]);

    // 달력용 날짜 계산
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0(일)~6(토)
    const daysInMonth = new Date(year, month, 0).getDate();

    const weeks = [];
    let day = 1 - startWeekday; // 그리드 시작 offset

    for (let w = 0; w < 6; w++) {
        const week = [];
        for (let i = 0; i < 7; i++, day++) {
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
    for (let y = baseYear - 3; y <= baseYear + 1; y++) {
        yearOptions.push(y);
    }

    return (
        <div className="mt-3 space-y-3 text-xs">
            {/* 상단 컨트롤바: 년/월 선택 + 이전/다음 */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
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
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
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
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
                    >
                        ◀
                    </button>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
                    >
                        ▶
                    </button>
                </div>
            </div>

            {/* 행동 legend: 색 + 라벨은 여기서만 표시 */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span
                    className={
                        'inline-flex items-center rounded-full px-2 py-[2px] ' +
                        ACTION_STYLES.viewed
                    }
                >
                    {ACTION_LABEL.viewed}
                </span>
                <span
                    className={
                        'inline-flex items-center rounded-full px-2 py-[2px] ' +
                        ACTION_STYLES.updated
                    }
                >
                    {ACTION_LABEL.updated}
                </span>
                <span
                    className={
                        'inline-flex items-center rounded-full px-2 py-[2px] ' +
                        ACTION_STYLES.created
                    }
                >
                    {ACTION_LABEL.created}
                </span>
                <span className="ml-1 text-[10px] text-slate-400">
                    뱃지에 해당하는 색깔의 문서 제목이 하단에 표시돼요.
                </span>
            </div>

            {/* 로딩 / 달력 */}
            {isLoading ? (
                <p className="mt-3 text-xs text-slate-500">
                    활동 기록을 불러오는 중...
                </p>
            ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    {/* 요일 헤더 */}
                    <div className="mb-1 grid grid-cols-7 gap-1 text-[11px] font-semibold text-slate-400">
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
                                            className="h-20 rounded-xl bg-transparent"
                                        />
                                    );
                                }

                                const key = `${year}-${String(month).padStart(
                                    2,
                                    '0',
                                )}-${String(d).padStart(2, '0')}`;
                                const items = activityByDate[key] || [];

                                return (
                                    <div
                                        key={`${wi}-${di}`}
                                        className="flex h-20 flex-col rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(148,163,184,0.08)]"
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-[11px] font-medium text-slate-700">
                                                {d}
                                            </span>
                                            {items.length > 0 && (
                                                <span className="text-[10px] text-slate-400">
                                                    {items.length}건
                                                </span>
                                            )}
                                        </div>

                                        {/* 문서 뱃지들 – 이제 제목만 표시 */}
                                        <div className="flex flex-wrap gap-0.5">
                                            {items.slice(0, 3).map((item) => {
                                                const action = item.action;
                                                const style =
                                                    ACTION_STYLES[action] ||
                                                    ACTION_STYLES.viewed;
                                                const doc = item.documents;
                                                const title =
                                                    doc?.title ?? '(삭제됨)';
                                                const href = doc?.slug
                                                    ? `/wiki/${doc.slug}`
                                                    : null;

                                                return (
                                                    <span
                                                        key={item.id}
                                                        className={
                                                            'inline-flex items-center rounded-full px-1.5 py-[2px] text-[10px] ' +
                                                            style
                                                        }
                                                        title={
                                                            ACTION_LABEL[
                                                                action
                                                                ] +
                                                            ' / ' +
                                                            title
                                                        }
                                                    >
                                                        {href ? (
                                                            <Link
                                                                to={href}
                                                                className="max-w-[80px] truncate underline-offset-2 hover:underline"
                                                            >
                                                                {title}
                                                            </Link>
                                                        ) : (
                                                            <span className="max-w-[80px] truncate">
                                                                {title}
                                                            </span>
                                                        )}
                                                    </span>
                                                );
                                            })}

                                            {items.length > 3 && (
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-[2px] text-[10px] text-slate-500">
                                                    +{items.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            }),
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
