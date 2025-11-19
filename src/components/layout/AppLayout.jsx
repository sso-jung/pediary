import Header from './Header';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                {/* 데스크톱 사이드바 */}
                <aside className="hidden w-72 border-r border-slate-200 bg-white/70 backdrop-blur lg:block">
                    <Sidebar />
                </aside>

                {/* 메인 컨텐츠 */}
                <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
                    <div className="mx-auto max-w-5xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
