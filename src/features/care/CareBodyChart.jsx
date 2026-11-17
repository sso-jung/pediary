const fields = [
    ['weight_kg', '체중', '#6488d6'],
    ['muscle_kg', '골격근량', '#29a782'],
    ['body_fat_kg', '체지방량', '#e89a69'],
    ['body_water_kg', '체수분량', '#9b80cd'],
];

export default function CareBodyChart({ rows, start, end }) {
    const ordered = [...rows].sort((a, b) => a.measurement_date.localeCompare(b.measurement_date) || a.measured_at.localeCompare(b.measured_at) || String(a.id).localeCompare(String(b.id)));
    const days = new Map();
    for (const row of ordered) {
        const values = days.get(row.measurement_date) || {};
        for (const [key] of fields) if (row[key] != null) values[key] = Number(row[key]);
        days.set(row.measurement_date, values);
    }
    const lines = fields.map(([key, label, color]) => {
        const points = [...days].filter(([, values]) => values[key] != null).map(([date, values]) => ({ date, value: values[key] }));
        const values = points.map((point) => point.value);
        const minimum = Math.min(...values);
        const maximum = Math.max(...values);
        const padding = (maximum - minimum || Math.max(Math.abs(maximum), 1)) * 0.08;
        return { key, label, color, points, low: minimum - padding, high: maximum + padding };
    });
    const legend = <div className="care-body-chart-legend">{lines.map((line) => <span key={line.key}><i style={{ backgroundColor: line.color }} />{line.label}</span>)}</div>;
    if (!lines.some((line) => line.points.length)) return <div className="care-body-chart"><p className="page-text-muted text-xs">최근 30일의 신체 측정 기록이 없습니다.</p>{legend}</div>;
    const dates = [...new Set(lines.flatMap((line) => line.points.map((point) => point.date)))].sort();
    const firstDate = dates[0];
    const lastDate = dates.at(-1);
    const startTime = new Date(`${firstDate}T12:00:00`).getTime();
    const duration = new Date(`${lastDate}T12:00:00`).getTime() - startTime;
    const x = (date) => duration ? 8 + (new Date(`${date}T12:00:00`).getTime() - startTime) / duration * 284 : 150;
    const y = (line, value, index) => 80 - (value - line.low) / (line.high - line.low) * 70 + (index - 1.5) * 4;
    return <div className="care-body-chart">
        <svg viewBox="0 0 300 90" role="img" aria-label={`${start}부터 ${end}까지 기록 중 체중, 골격근량, 체지방량, 체수분량의 각각 다른 범위를 겹쳐 표시한 그래프`}>
            <line x1="8" x2="292" y1="10" y2="10" stroke="var(--color-border-subtle)" opacity="0.55" />
            <line x1="8" x2="292" y1="80" y2="80" stroke="var(--color-border-subtle)" opacity="0.55" />
            {lines.map((line, index) => line.points.length ? <g key={line.key}>{line.points.length > 1 && <polyline fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={line.points.map((point) => `${x(point.date)},${y(line, point.value, index)}`).join(' ')} />}<circle cx={x(line.points.at(-1).date)} cy={y(line, line.points.at(-1).value, index)} r="2.8" fill={line.color} /></g> : null)}
        </svg>
        {legend}
        <div className="care-body-chart-axis page-text-muted"><span>{firstDate.slice(5)}</span><span>최근 30일 중 {dates.length}일</span><span>{lastDate === firstDate ? '' : lastDate.slice(5)}</span></div>
    </div>;
}
