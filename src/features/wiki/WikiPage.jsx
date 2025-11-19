// src/features/wiki/WikiPage.jsx
import { Link } from 'react-router-dom';
import { useRecentActivity } from './hooks/useRecentActivity';
import {useTodayActivity} from "./hooks/useTodayActivity.js";

export default function WikiPage() {
    const { data: activity, isLoading } = useTodayActivity();

    return (
        <div className="space-y-6">
            {/* 상단 인사 영역 */}
            <section>
                <h1 className="text-2xl font-semibold text-slate-800">
                    환영해, Pediary ✨
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    왼쪽에서 카테고리를 선택해서 문서를 열거나, 아래에서 최근에 작성·수정·조회한
                    문서를 다시 살펴볼 수 있어.
                </p>
            </section>

            {/* 최근 활동 타임라인 */}
            <section className="rounded-2xl bg-white p-4 shadow-soft">
                <h2 className="text-sm font-semibold text-slate-700">최근 활동</h2>

                {isLoading ? (
                    <p className="mt-3 text-xs text-slate-500">활동 기록을 불러오는 중...</p>
                ) : !activity || activity.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500">
                        아직 활동 기록이 없어. 문서를 하나 만들어보자!
                    </p>
                ) : (
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
