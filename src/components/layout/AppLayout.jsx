// src/components/layout/AppLayout.jsx
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
    return (
        <div className="flex h-full flex-col bg-softbg">
            {/* 상단 헤더 */}
            <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
                <Header />
            </header>

            {/* 아래 영역: 좌측 고정 + 우측 영역만 높이 채우기 */}
            <div className="flex flex-1 min-h-0">
                {/* 좌측: 카테고리/문서 트리 */}
                <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur overflow-y-auto">
                    <Sidebar />
                </aside>

                {/* 우측: 메인 – 여기서는 스크롤 안 함, 안쪽에서 처리 */}
                <main className="flex-1 min-w-0 overflow-hidden">
                    <div className="mx-auto flex h-full w-full max-w-[85rem] flex-col pl-2 pr-2 py-6 lg:pl-0 lg:pr-[10rem]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
