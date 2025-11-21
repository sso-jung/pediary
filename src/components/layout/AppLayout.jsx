// src/components/layout/AppLayout.jsx
import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import FriendsPage from '../../features/friends/FriendsPage';

export default function AppLayout({ children }) {
    // 🔹 친구 패널 on/off 상태
    const [showFriends, setShowFriends] = useState(false);

    const handleToggleFriends = () => {
        setShowFriends((prev) => !prev);
    };

    return (
        <div className="flex h-full flex-col bg-softbg">
            {/* 상단 헤더 */}
            <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
                <Header onToggleFriends={handleToggleFriends} />
            </header>

            {/* 아래 영역: 좌측 고정 + 우측 영역만 높이 채우기 */}
            <div className="flex flex-1 min-h-0">
                {/* 좌측: 카테고리/문서 트리 */}
                <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur overflow-y-auto">
                    <Sidebar />
                </aside>

                {/* 우측: 메인 + 오른쪽 친구 패널 자리 */}
                <main className="flex-1 min-w-0 overflow-hidden">
                    <div className="relative mx-auto flex h-full w-full max-w-[85rem] flex-col pl-2 pr-2 py-6 lg:pl-0 lg:pr-[18rem]">
                        {/* 기존 메인 콘텐츠 */}
                        {children}

                        {/* 🔹 오른쪽 친구 패널 (데스크톱에서만) */}
                        {showFriends && (
                            <div className="hidden lg:block absolute right-0 top-0 h-full w-[266px]">
                                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-soft">
                                    {/* FriendsPage는 내부에서 h-full 기준으로 잘 쓰니까 그대로 사용 */}
                                    <FriendsPage />
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
