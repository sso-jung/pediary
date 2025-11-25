// src/features/wiki/WikiPage.jsx
import {useEffect, useState} from 'react';
import { Link } from 'react-router-dom';
import { useTodayActivity } from './hooks/useTodayActivity';
import ActivityCalendar from './ActivityCalendar';
import EmptyState from '../../components/ui/EmptyState';
import SparkleIcon from '../../components/icons/SparkleIcon';

const HOME_VIEW_MODE_KEY = 'pediary-home-view-mode';

export default function WikiPage() {
    const { data: rawActivity, isLoading } = useTodayActivity();
    const [viewMode, setViewMode] = useState(() => {
        if (typeof window === 'undefined') return 'today'; // SSR 대비

        const saved = window.localStorage.getItem(HOME_VIEW_MODE_KEY);
        // 저장된 게 없으면 오늘 보기('today')가 기본
        return saved || 'today';
    });

    // 🔹 모드가 바뀔 때마다 localStorage 에 저장
    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(HOME_VIEW_MODE_KEY, viewMode);
    }, [viewMode]);

    // 오늘 활동 요약용 (viewed 압축)
    let activity = [];
    if (rawActivity && rawActivity.length > 0) {
        const seenViewedDocs = new Set();

        for (const item of rawActivity) {
            if (item.action === 'viewed') {
                if (seenViewedDocs.has(item.document_id)) continue;
                seenViewedDocs.add(item.document_id);
                activity.push(item);
            } else {
                activity.push(item);
            }
        }

        activity.sort(
            (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* 상단 인사 + 토글 버튼 */}
            <section className="shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="pediary-heading flex items-center gap-[7px] text-2xl font-semibold text-slate-800">
                            <span>환영해, Pediary</span>
                            <SparkleIcon className="h-6 w-6"/>
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            오늘 내가 어떤 문서를 작성·수정·조회했는지 한눈에 볼 수 있어.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            setViewMode((m) => (m === 'today' ? 'diary' : 'today'))
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <path d="M8 2v4M16 2v4M3 10h18"/>
                        </svg>
                        <span>{viewMode === 'today' ? '달력 다이어리' : '오늘만 보기'}</span>
                    </button>
                </div>
            </section>

            {/* 메인 영역 */}
            <section className="mt-3 flex-1 min-h-0 rounded-2xl bg-white p-4 shadow-soft overflow-y-auto">
                <h2 className="text-sm font-semibold text-slate-700">
                    {viewMode === 'today' ? '오늘 활동' : '내 활동 다이어리'}
                </h2>

                {viewMode === 'diary' ? (
                    // 🔹 달력 다이어리
                    <ActivityCalendar/>
                ) : isLoading ? (
                    <p className="mt-3 text-xs text-slate-500">
                        활동 기록을 불러오는 중...
                    </p>
                ) : !activity || activity.length === 0 ? (
                    <EmptyState
                        icon="calendar"
                        title="아직 오늘 활동 기록이 없어."
                        description={
                            '문서를 읽고 쓴 모든 기록을 여기에서 확인할 수 있어.'
                        }
                    />
                ) : (
                    // 🔹 오늘 활동 카드 리스트
                    <ul className="mt-3 space-y-2 text-xs">
                        {activity.map((item) => {
                            const date = new Date(item.created_at);
                            const timeStr = date.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            });

                            const doc = item.documents;
                            const title = doc?.title ?? '(삭제된 문서)';
                            const href = doc?.slug ? `/wiki/${doc.slug}` : null;

                            let actionText = '';
                            if (item.action === 'created') actionText = '문서를 작성했어';
                            if (item.action === 'updated') actionText = '문서를 수정했어';
                            if (item.action === 'viewed') actionText = '문서를 열어봤어';

                            return (
                                <li
                                    key={item.id}
                                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                                >
                                    <div className="flex flex-col">
                    <span className="font-medium text-slate-800">
                      {href ? (
                          <Link
                              to={href}
                              className="text-primary-600 hover:underline"
                          >
                              {title}
                          </Link>
                      ) : (
                          title
                      )}
                    </span>
                                        <span className="mt-0.5 text-[11px] text-slate-500">
                      {timeStr} · {actionText}
                    </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
