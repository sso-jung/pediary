import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCareMeasurementChart, fetchCarePeriodSummary } from '../../lib/careApi';

const metrics = [
    ['weight_kg', '체중'], ['body_fat_kg', '체지방량'],
    ['muscle_kg', '골격근량'], ['body_water_kg', '체수분량'],
];
const periods = [7, 30, 90, 365];
const buttonClass = 'ui-control rounded-lg border px-3 py-2 text-sm';
const dateNumber = (date) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000;
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date, days) => {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + days);
    return localDate(value);
};
const format = (value) => Math.round(value * 10) / 10;
const formatAxis = (value) => new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

async function fetchEnergyChart(start, end) {
    const requests = [];
    for (let date = start; date <= end; date = addDays(date, 42)) {
        requests.push(fetchCarePeriodSummary(date, addDays(date, 41) < end ? addDays(date, 41) : end));
    }
    return (await Promise.all(requests)).flat();
}

function Chart({ points, start, end, unit, selectedDate, onSelect, includeZero = false }) {
    if (!points.length) return <p className="page-text-muted text-sm">이 기간에 표시할 기록이 없습니다.</p>;
    const values = points.map((point) => point.value);
    const minimum = Math.min(...values, ...(includeZero ? [0] : []));
    const maximum = Math.max(...values, ...(includeZero ? [0] : []));
    const padding = (maximum - minimum || Math.max(Math.abs(maximum), 1)) * 0.08;
    const low = minimum - padding;
    const high = maximum + padding;
    const x = (point) => 42 + (dateNumber(point.date) - dateNumber(start)) / Math.max(1, dateNumber(end) - dateNumber(start)) * 246;
    const y = (point) => 152 - (point.value - low) / (high - low) * 126;
    const selected = points.find((point) => point.date === selectedDate) || points.at(-1);

    return <div className="min-w-0 space-y-2">
        <svg viewBox="0 0 300 185" className="block h-auto w-full max-w-[360px]" role="img" aria-label={`${start}부터 ${end}까지 ${unit} 변화 그래프`}>
            <line x1="42" y1="18" x2="42" y2="152" stroke="currentColor" opacity="0.3" />
            <line x1="42" y1="152" x2="288" y2="152" stroke="currentColor" opacity="0.3" />
            <text x="38" y="22" textAnchor="end" fontSize="12" fill="currentColor">{formatAxis(high)}</text>
            <text x="38" y="153" textAnchor="end" fontSize="12" fill="currentColor">{formatAxis(low)}</text>
            <text x="42" y="177" fontSize="12" fill="currentColor">{start}</text>
            <text x="288" y="177" textAnchor="end" fontSize="12" fill="currentColor">{end}</text>
            {points.slice(1).map((point, index) => <line key={point.date} x1={x(points[index])} y1={y(points[index])} x2={x(point)} y2={y(point)} stroke="var(--color-accent)" strokeWidth="2" strokeDasharray={dateNumber(point.date) - dateNumber(points[index].date) > 1 ? '4 4' : undefined} />)}
            {points.map((point) => <circle key={point.date} cx={x(point)} cy={y(point)} r={selected.date === point.date ? 6 : 4} fill="var(--color-accent)" stroke="var(--color-surface, white)" strokeWidth="2" role="button" tabIndex="0" aria-label={`${point.date} ${format(point.value)} ${unit} 선택`} onClick={() => onSelect(point.date)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(point.date); } }} />)}
        </svg>
        <div className="flex flex-wrap items-center gap-2 text-sm">
            <label>날짜 <select value={selected.date} onChange={(event) => onSelect(event.target.value)} className={`${buttonClass} ml-1`}>{points.map((point) => <option key={point.date} value={point.date}>{point.date}</option>)}</select></label>
            <strong>{format(selected.value)} {unit}</strong>
            {selected.provisional && <span className="page-text-muted text-xs">잠정</span>}
        </div>
    </div>;
}

export default function CareAnalysis({ userId, date }) {
    const [period, setPeriod] = useState(30);
    const [metric, setMetric] = useState('weight_kg');
    const [selectedMeasurement, setSelectedMeasurement] = useState(null);
    const [selectedEnergy, setSelectedEnergy] = useState(null);
    const start = addDays(date, 1 - period);
    const measurementsQuery = useQuery({ queryKey: ['care-measurement-chart', userId, metric, start, date], queryFn: () => fetchCareMeasurementChart(userId, metric, start, date), enabled: !!userId });
    const energyQuery = useQuery({ queryKey: ['care-period', userId, 'chart', start, date], queryFn: () => fetchEnergyChart(start, date), enabled: !!userId });
    const measurementDays = new Map();
    for (const row of measurementsQuery.data || []) measurementDays.set(row.measurement_date, { date: row.measurement_date, value: Number(row[metric]) });
    const measurementPoints = [...measurementDays.values()];
    const today = localDate(new Date());
    const energyPoints = (energyQuery.data || []).filter((day) => day.total_kcal != null && (Number(day.meal_count) > 0 || day.intake_confirmed)).reduce((points, day) => {
        const previous = points.at(-1);
        points.push({
            date: day.summary_date,
            value: (previous?.value || 0) + Number(day.total_kcal) - Number(day.intake_kcal),
            provisional: !!previous?.provisional || day.summary_date === today || !day.intake_confirmed,
        });
        return points;
    }, []);

    return <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-semibold">기록 분석</h2><p className="page-text-muted mt-1 text-xs">선택한 날짜까지의 변화를 봅니다.</p></div>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="분석 기간">{periods.map((days) => <button key={days} type="button" className={buttonClass} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days}일</button>)}</div>
        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
                <label className="text-sm font-semibold">신체 지표 <select value={metric} onChange={(event) => { setMetric(event.target.value); setSelectedMeasurement(null); }} className={`${buttonClass} ml-1`}>{metrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                {measurementsQuery.isPending && <p className="page-text-muted text-sm">측정 기록을 불러오는 중...</p>}
                {measurementsQuery.isError && <p role="alert" className="ui-danger-text text-sm">측정 기록을 불러오지 못했습니다: {measurementsQuery.error.message}</p>}
                {measurementsQuery.isSuccess && <Chart points={measurementPoints} start={start} end={date} unit="kg" selectedDate={selectedMeasurement} onSelect={setSelectedMeasurement} />}
                {measurementPoints.length > 1 && <p className="page-text-muted text-xs">하루에 여러 번 측정했다면 마지막 값을 표시합니다. 기록이 없는 날 사이에는 점선을 표시합니다.</p>}
            </div>
            <div className="min-w-0 space-y-2">
                <h3 className="text-sm font-semibold">에너지 수지 누적</h3>
                {energyQuery.isPending && <p className="page-text-muted text-sm">에너지 기록을 불러오는 중...</p>}
                {energyQuery.isError && <p role="alert" className="ui-danger-text text-sm">에너지 기록을 불러오지 못했습니다: {energyQuery.error.message}</p>}
                {energyQuery.isSuccess && <Chart points={energyPoints} start={start} end={date} unit="kcal" selectedDate={selectedEnergy} onSelect={setSelectedEnergy} includeZero />}
                <p className="page-text-muted text-xs">총 소모 − 섭취를 계산 가능한 날짜만 합산합니다. 양수는 적자, 음수는 잉여입니다. 미기록일은 제외하며 식사 미확정일과 오늘은 잠정입니다.</p>
            </div>
        </div>
    </section>;
}
