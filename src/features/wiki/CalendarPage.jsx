import { useState } from 'react';
import { useDailyActivity } from './hooks/useDailyActivity';

export default function CalendarPage() {
    const [selectedDate, setSelectedDate] = useState(null);

    const { data: activity, isLoading } = useDailyActivity(selectedDate);

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-semibold text-slate-800">📅 활동 캘린더</h1>

            {/* 👉 달력 컴포넌트 (추후 더 예쁘게 개선 가능) */}
            <CalendarGrid onSelect={(dateStr) => setSelectedDate(dateStr)} />

            <div className="rounded-2xl bg-white p-4 shadow-soft">
                <h2 className="text-sm font-semibold text-slate-700">
                    {selectedDate ? `${selectedDate} 활동` : `날짜를 선택하세요`}
                </h2>

                {isLoading ? (
                    <p className="mt-3 text-xs text-slate-500">불러오는 중...</p>
                ) : activity?.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-xs">
                        {activity.map((item) => (
                            <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2">
                                <span className="font-medium">{item.documents.title}</span>
                                <span className="ml-2 text-slate-500">
                  ({item.action}, {new Date(item.created_at).toLocaleTimeString()})
                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-3 text-xs text-slate-500">이 날의 활동이 없습니다.</p>
                )}
            </div>
        </div>
    );
}
