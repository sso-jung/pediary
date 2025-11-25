// src/components/layout/AppLayout.jsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import FriendsPage from '../../features/friends/FriendsPage';
import MyInfoPanel from '../../features/account/MyInfoPanel'; // ✅ 새 패널

export default function AppLayout({ children }) {
    const [activeSidePanel, setActiveSidePanel] = useState(null); // 'friends' | 'me' | null

    const handleToggleFriends = () => {
        setActiveSidePanel((prev) => (prev === 'friends' ? null : 'friends'));
    };

    const handleToggleMyInfo = () => {
        setActiveSidePanel((prev) => (prev === 'me' ? null : 'me'));
    };

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
                <Header
                    onToggleFriends={handleToggleFriends}
                    onToggleMyInfo={handleToggleMyInfo}
                    activeSidePanel={activeSidePanel}
                />
            </header>

            {/* 아래 영역 */}
            <div className="flex flex-1 min-h-0">
                {/* 🔹 문서 탭에서만 좌측 Sidebar 보여주기 */}
                {isDocs && (
                    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur overflow-y-auto">
                        <Sidebar />
                    </aside>
                )}

                {/* 우측: 메인 + 오른쪽 패널 자리 */}
                {isDocs ? (
                    <main className="flex-1 min-w-0 min-h-0">
                        <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[100rem] flex-col pl-2 pr-2 py-6 lg:pl-6 lg:pr-[300px]">
                        {children}

                        {/* 오른쪽 패널 (데스크톱에서만) */}
                        {activeSidePanel && (
                            <div className="hidden lg:block absolute right-[16px] top-6 bottom-6 w-[266px]">
                                <div
                                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-soft">
                                    {activeSidePanel === 'friends' && <FriendsPage/>}
                                    {activeSidePanel === 'me' && <MyInfoPanel/>}
                                </div>
                            </div>
                        )}
                        </div>
                    </main>
                ) : (
                    <main className="relative flex-1 min-w-0 min-h-0">
                        {/* 가운데 콘텐츠 영역: max-w + 오른쪽 패널 자리 확보 */}
                        <div
                            className="mx-auto flex h-full min-h-0 w-full max-w-[90rem] flex-col
                       pl-2 pr-2 py-6 lg:pl-[147px] lg:pr-[147px]"
                        >
                            {children}
                        </div>

                        {/* 오른쪽 패널 (데스크톱에서만) – 이제는 main 기준으로 브라우저 오른쪽에 붙음 */}
                        {activeSidePanel && (
                            <div className="hidden lg:block absolute right-[16px] top-6 bottom-6 w-[266px]">
                                <div
                                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-soft">
                                    {activeSidePanel === 'friends' && <FriendsPage/>}
                                    {activeSidePanel === 'me' && <MyInfoPanel/>}
                                </div>
                            </div>
                        )}
                    </main>
                )}
            </div>
        </div>
    );
}
