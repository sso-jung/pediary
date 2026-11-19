import { CareButton } from './CareControls';
import { CareSelect } from './CareControls';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCareMeasurementsRange, fetchCarePeriodSummary } from '../../lib/careApi';

const metrics = [
    ['weight_kg', '체중', 'kg', '#6488d6'],
    ['body_fat_percent', '체지방률', '%', '#e89a69'],
    ['muscle_percent', '골격근 비율', '%', '#29a782'],
    ['total_kcal', '총 소모', 'kcal', '#9b80cd'],
    ['balance_kcal', '일별 부족', 'kcal', '#d38196'],
];
const periods = [7, 30, 90, 365];
const buttonClass = 'ui-control rounded-lg border px-3 py-2 text-sm';
const inputClass = 'ui-input rounded-lg border px-3 py-2 text-sm';
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

function Chart({ lines, start, end, selectedDate, onSelect }) {
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 639px)');
        const handleChange = () => setIsMobile(media.matches);
        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, []);
    const shown = lines.filter((line) => line.visible && line.points.length);
    if (!shown.length) return <div className="flex min-h-[300px] items-center justify-center"><p className="page-text-muted text-sm">이 기간에 표시할 기록이 없습니다.</p></div>;
    const dates = [...new Set(shown.flatMap((line) => line.points.map((point) => point.date)))].sort();
    const selected = dates.includes(selectedDate) ? selectedDate : dates.at(-1);
    const firstDate = dates[0];
    const lastDate = dates.at(-1);
    const right = isMobile ? 326 : 586;
    const x = (date) => firstDate === lastDate ? (32 + right) / 2 : 32 + (dateNumber(date) - dateNumber(firstDate)) / (dateNumber(lastDate) - dateNumber(firstDate)) * (right - 32);
    const y = (line, value) => 160 - (value - line.low) / (line.high - line.low) * 130;
    const axis = shown.length === 1 ? shown[0] : null;

    return <div className="min-w-0 space-y-2">
        <svg viewBox={`0 0 ${right + 14} 205`} className="block h-auto w-full" role="img" aria-label={`${start}부터 ${end}까지 ${shown.map((line) => line.label).join(', ')} 변화 그래프`}>
            <line x1="32" y1="24" x2="32" y2="160" stroke="currentColor" opacity="0.3" />
            <line x1="32" y1="160" x2={right} y2="160" stroke="currentColor" opacity="0.3" />
            {axis && <><text x="28" y="28" textAnchor="end" fontSize="11" fill="currentColor">{formatAxis(axis.high)}</text><text x="28" y="161" textAnchor="end" fontSize="11" fill="currentColor">{formatAxis(axis.low)}</text></>}
            <text x="32" y="188" fontSize="11" fill="currentColor">{firstDate.slice(5)}</text>
            {lastDate !== firstDate && <text x={right} y="188" textAnchor="end" fontSize="11" fill="currentColor">{lastDate.slice(5)}</text>}
            {shown.map((line) => <g key={line.key}>
                {line.points.slice(1).map((point, index) => <line key={point.date} x1={x(line.points[index].date)} y1={y(line, line.points[index].value)} x2={x(point.date)} y2={y(line, point.value)} stroke={line.color} strokeWidth="2" strokeDasharray={dateNumber(point.date) - dateNumber(line.points[index].date) > 1 ? '4 4' : undefined} />)}
                {line.points.map((point) => <circle key={point.date} cx={x(point.date)} cy={y(line, point.value)} r={selected === point.date ? 4 : 3} fill={line.color} stroke="var(--color-surface, white)" strokeWidth="1.5" role="button" tabIndex="0" aria-label={`${point.date} ${line.label} ${format(point.value)} ${line.unit} 선택`} onClick={() => onSelect(point.date)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(point.date); } }} />)}
            </g>)}
        </svg>
        <div className="care-analysis-values flex flex-wrap items-center gap-2 text-sm">
            <label>날짜 <CareSelect value={selected} onChange={(event) => onSelect(event.target.value)} className={`${inputClass} ml-1 w-auto`}>{dates.map((day) => <option key={day} value={day}>{day}</option>)}</CareSelect></label>
            {shown.map((line) => {
                const point = line.points.find((item) => item.date === selected);
                return point && <span key={line.key} style={{ color: line.color }}><strong>{line.label} {format(point.value)} {line.unit}</strong>{point.provisional && <small className="page-text-muted ml-1">잠정</small>}</span>;
            })}
        </div>
    </div>;
}

export default function CareAnalysis({ userId, date }) {
    const [period, setPeriod] = useState(30);
    const [visible, setVisible] = useState(metrics.map(([key]) => key));
    const [selectedDate, setSelectedDate] = useState(null);
    const start = addDays(date, 1 - period);
    const measurementsQuery = useQuery({ queryKey: ['care-measurements-range', userId, start, date], queryFn: () => fetchCareMeasurementsRange(userId, start, date), enabled: !!userId });
    const energyQuery = useQuery({ queryKey: ['care-period', userId, 'chart', start, date], queryFn: () => fetchEnergyChart(start, date), enabled: !!userId });
    const ordered = [...(measurementsQuery.data || [])].sort((a, b) => a.measurement_date.localeCompare(b.measurement_date) || a.measured_at.localeCompare(b.measured_at) || Number(a.id) - Number(b.id));
    const measurementDays = new Map();
    for (const row of ordered) {
        const values = measurementDays.get(row.measurement_date) || {};
        for (const key of ['weight_kg', 'body_fat_kg', 'muscle_kg']) if (row[key] != null) values[key] = row[key];
        measurementDays.set(row.measurement_date, values);
    }
    const today = localDate(new Date());
    const lines = metrics.map(([key, label, unit, color]) => {
        const points = key === 'total_kcal' || key === 'balance_kcal'
            ? (energyQuery.data || []).filter((day) => day.total_kcal != null && (key === 'total_kcal' || Number(day.meal_count) > 0 || day.intake_confirmed)).map((day) => ({ date: day.summary_date, value: key === 'total_kcal' ? Number(day.total_kcal) : Number(day.total_kcal) - Number(day.intake_kcal), provisional: key === 'balance_kcal' && (day.summary_date === today || !day.intake_confirmed) }))
            : [...measurementDays].filter(([, row]) => key === 'weight_kg' ? row.weight_kg != null : row.weight_kg != null && Number(row.weight_kg) > 0 && row[key === 'body_fat_percent' ? 'body_fat_kg' : 'muscle_kg'] != null).map(([day, row]) => ({ date: day, value: key === 'weight_kg' ? Number(row.weight_kg) : Number(row[key === 'body_fat_percent' ? 'body_fat_kg' : 'muscle_kg']) / Number(row.weight_kg) * 100 }));
        const values = points.map((point) => point.value);
        const minimum = Math.min(...values);
        const maximum = Math.max(...values);
        const padding = (maximum - minimum || Math.max(Math.abs(maximum), 1)) * 0.08;
        return { key, label, unit, color, points, low: minimum - padding, high: maximum + padding, visible: visible.includes(key) };
    });

    return <section className="care-analysis min-w-0 space-y-4">
        <div className="care-section-head"><div><h2>기록 분석</h2><p className="page-text-muted mt-1 text-xs">선택한 날짜까지의 변화를 봅니다.</p></div></div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="분석 기간">{periods.map((days) => <CareButton key={days} type="button" className={buttonClass} aria-pressed={period === days} onClick={() => { setPeriod(days); setSelectedDate(null); }}>{days}일</CareButton>)}</div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="표시할 그래프">{metrics.map(([key, label, , color]) => <CareButton key={key} type="button" className={buttonClass} aria-pressed={visible.includes(key)} onClick={() => { setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); setSelectedDate(null); }}><span className="care-analysis-color" style={{ backgroundColor: color }} />{label}</CareButton>)}</div>
        {measurementsQuery.isPending && <p className="page-text-muted text-sm">측정 기록을 불러오는 중...</p>}
        {measurementsQuery.isError && <p role="alert" className="ui-danger-text text-sm">측정 기록을 불러오지 못했습니다: {measurementsQuery.error.message}</p>}
        {energyQuery.isPending && <p className="page-text-muted text-sm">에너지 기록을 불러오는 중...</p>}
        {energyQuery.isError && <p role="alert" className="ui-danger-text text-sm">에너지 기록을 불러오지 못했습니다: {energyQuery.error.message}</p>}
        {(measurementsQuery.isSuccess || energyQuery.isSuccess) && <Chart lines={lines} start={start} end={date} selectedDate={selectedDate} onSelect={setSelectedDate} />}
        {(measurementsQuery.isSuccess || energyQuery.isSuccess) && <p className="page-text-muted text-xs">각 지표의 범위를 따로 맞춰 겹쳐 표시합니다. 하루에 여러 번 측정했다면 날짜별 각 항목의 마지막 값을 사용하고, 기록이 없는 날 사이에는 점선을 표시합니다. 일별 부족은 총 소모 − 섭취이며 양수는 적자, 음수는 잉여입니다. 식사 미확정일과 오늘은 잠정입니다.</p>}
    </section>;
}
