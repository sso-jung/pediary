// src/components/layout/AppLayout.jsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import FriendsPage from '../../features/friends/FriendsPage';

export default function AppLayout({ children }) {
    const [showFriends, setShowFriends] = useState(false);
    const handleToggleFriends = () => setShowFriends((prev) => !prev);

    const location = useLocation();
    const path = location.pathname;
    const isDocs =
        path.startsWith('/wiki') ||
        path.startsWith('/category') ||
        path.startsWith('/docs') ||
        path.startsWith('/trash');

    return (
        <div className="flex h-full flex-col bg-softbg">
            {/* 상단 헤더 */}
            <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
                <Header onToggleFriends={handleToggleFriends} />
            </header>

            {/* 아래 영역 */}
            <div className="flex flex-1 min-h-0">
                {/* 🔹 문서 탭에서만 좌측 Sidebar 보여주기 */}
                {isDocs && (
                    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur overflow-y-auto">
                        <Sidebar />
                    </aside>
                )}

                {/* 우측: 메인 + 오른쪽 친구 패널 자리 */}
                {isDocs ? (
                    <main className="flex-1 min-w-0 overflow-hidden">
                        <div className="relative mx-auto flex h-full w-full max-w-[100rem] flex-col pl-2 pr-2 py-6 lg:pl-6 lg:pr-[280px]">
                            {children}

                            {/* 오른쪽 친구 패널 (데스크톱에서만) */}
                            {showFriends && (
                                <div className="hidden lg:block absolute right-0 h-full w-[266px]">
                                    <div className="flex flex-col rounded-2xl max-h-[50rem] border border-slate-200 bg-white shadow-soft">
                                        <FriendsPage />
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                ) : (
                    <main className="flex-1 min-w-0 overflow-hidden">
                        <div className="relative mx-auto flex w-full max-w-[90rem] flex-col pl-2 pr-2 py-6 lg:pl-6 lg:pr-20">
                            {children}

                            {/* 오른쪽 친구 패널 (데스크톱에서만) */}
                            {showFriends && (
                                <div className="hidden lg:block absolute right-[-200px] top-0 h-full w-[266px]">
                                    <div className="flex h-full flex-col rounded-2xl max-h-[50rem] border border-slate-200 bg-white shadow-soft">
                                        <FriendsPage />
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                )}
            </div>
        </div>
    );
}
