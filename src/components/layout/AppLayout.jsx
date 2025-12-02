// src/components/layout/AppLayout.jsx
import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import FriendsPage from '../../features/friends/FriendsPage';
import MyInfoPanel from '../../features/account/MyInfoPanel';

const THEME_STORAGE_KEY = 'pediary-theme';

export default function AppLayout({ children }) {
    const [activeSidePanel, setActiveSidePanel] = useState(null); // 'friends' | 'me' | null
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'light';
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return stored === 'dark' ? 'dark' : 'light';
    });

    const toggleTheme = () => {
        setTheme((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(THEME_STORAGE_KEY, next);
            }
            return next;
        });
    };

    const handleToggleFriends = () => {
        setActiveSidePanel((prev) => (prev === 'friends' ? null : 'friends'));
    };

    const handleToggleMyInfo = () => {
        setActiveSidePanel((prev) => (prev === 'me' ? null : 'me'));
    };

    const handleToggleSidebar = () => {
        setIsSidebarOpen((prev) => !prev);
    };

    const location = useLocation();
    const path = location.pathname;

    // 🔹 자료 분석 페이지 여부
    const isMaterials = path.startsWith('/materials');

    // 🔹 "문서 탭 계열" 레이아웃을 쓸지 여부
    //    → 자료분석은 홈이랑 같은 브랜치로 보내려고 여기에서 뺌!
    const isDocsLayout =
        path.startsWith('/wiki') ||
        path.startsWith('/category') ||
        path.startsWith('/docs') ||
        path.startsWith('/trash');

    // 🔹 실제 문서 상세 페이지(/wiki/:slug) 인지 여부
    const isDocumentPage = path.startsWith('/wiki/');

    // 🔹 좌측 카테고리 사이드바를 보여줄지 여부
    const showSidebarLayout =
        !isMaterials &&
        !isDocumentPage &&
        (path.startsWith('/category') ||
            path.startsWith('/docs') ||
            path.startsWith('/trash'));

    // 라우트 변경 시 오버레이/패널 닫기
    useEffect(() => {
        setIsSidebarOpen(false);
        setActiveSidePanel(null);
    }, [path]);

    const sidePanelContent = useMemo(() => {
        if (activeSidePanel === 'friends') return <FriendsPage />;
        if (activeSidePanel === 'me') return <MyInfoPanel />;
        return null;
    }, [activeSidePanel]);

    // 🔹 홈(/) & 자료분석(/materials) 공용 내부 레이아웃 클래스
    //    - 기본: 홈 레이아웃
    //    - 자료분석: 폭 조금 더 넓게 + 좌우 여백 감소
    const homeLikeInnerClass = isMaterials
        ? `
      relative mx-auto flex h-full min-h-0 w-full max-w-[100rem] flex-col
      pl-2 pr-2 py-6
      lg:pl-[80px] lg:pr-[80px]
    `
        : `
      relative mx-auto flex h-full min-h-0 w-full max-w-[90rem] flex-col
      pl-2 pr-2 py-6
      lg:pl-[147px] lg:pr-[147px]
    `;

    return (
        <div
            data-theme={theme}
            className="app-shell flex h-full flex-col"
        >
            {/* 상단 헤더 */}
            <header className="app-header shrink-0">
                <Header
                    onToggleFriends={handleToggleFriends}
                    onToggleMyInfo={handleToggleMyInfo}
                    onToggleSidebar={showSidebarLayout ? handleToggleSidebar : undefined}
                    activeSidePanel={activeSidePanel}
                    isSidebarOpen={isSidebarOpen}
                    theme={theme}
                    onToggleTheme={toggleTheme}
                />
            </header>

            {/* 아래 영역 */}
            <div className="flex flex-1 min-h-0">
                {/* 🔹 문서 탭이면서, DocumentPage가 아닐 때만 좌측 카테고리 영역 사용 */}
                {showSidebarLayout && (
                    <>
                        {/* PC용 고정 사이드바 (lg 이상) */}
                        <aside
                            className="
                hidden basic:block
                w-[220px] shrink-0 border-r border-border-subtle
                bg-surface-elevated/80 backdrop-blur overflow-y-auto
              "
                        >
                            <Sidebar />
                        </aside>

                        {/* 모바일/태블릿용 슬라이드 사이드바 (lg 미만) */}
                        <div
                            className={`fixed inset-0 z-40 basic:hidden ${
                                isSidebarOpen ? '' : 'pointer-events-none invisible'
                            }`}
                        >
                            {/* 배경 딤드 */}
                            <div
                                className={`absolute inset-0 bg-black/30 transition-opacity ${
                                    isSidebarOpen ? 'opacity-100' : 'opacity-0'
                                }`}
                                onClick={() => setIsSidebarOpen(false)}
                            />

                            {/* 왼쪽에서 슬라이드 인 */}
                            <div
                                className={`absolute inset-y-0 left-0 flex w-[78%] max-w-[320px] transform transition-transform duration-200 ${
                                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                                }`}
                            >
                                <div className="panel-surface flex h-full w-full flex-col rounded-r-2xl shadow-xl">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                    <span className="text-[11px] font-semibold">
                      카테고리
                    </span>
                                        <button
                                            type="button"
                                            className="rounded-full px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-100/60"
                                            onClick={() => setIsSidebarOpen(false)}
                                        >
                                            닫기
                                        </button>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto">
                                        <Sidebar />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* 우측: 메인 + 오른쪽 패널 자리 */}
                {isDocsLayout ? (
                    <main className="relative flex-1 min-w-0 min-h-0">
                        {/* 중앙 컨텐츠 영역 (문서 레이아웃) */}
                        <div
                            className="
                relative mx-auto flex h-full min-h-0 w-full max-w-[100rem] flex-col
                pl-2 pr-2
                py-4 md:py-5 min-[1420px]:py-6
                min-[1420px]:pl-6 min-[1420px]:pr-[300px]
              "
                        >
                            {children}
                        </div>

                        {/* 오른쪽 패널 (PC: 옆에, 모바일/태블릿: bottom sheet) */}
                        {activeSidePanel && sidePanelContent && (
                            <>
                                {/* PC용 오른쪽 고정 패널 */}
                                <div className="hidden min-[1420px]:block absolute right-[16px] top-6 bottom-6 w-[266px]">
                                    <div className="panel-surface flex h-full flex-col rounded-2xl border shadow-soft">
                                        {sidePanelContent}
                                    </div>
                                </div>

                                {/* 모바일/태블릿용 bottom sheet */}
                                <div className="fixed inset-0 z-40 flex items-end bg-black/30 min-[1420px]:hidden">
                                    <div className="panel-surface w-full max-h-[75%] rounded-t-2xl border border-border-subtle shadow-xl">
                                        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
                      <span className="text-xs font-semibold">
                        {activeSidePanel === 'friends' ? '친구' : '내 정보'}
                      </span>
                                            <button
                                                type="button"
                                                className="rounded-full px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-100/60"
                                                onClick={() => setActiveSidePanel(null)}
                                            >
                                                닫기
                                            </button>
                                        </div>
                                        <div className="max-h-[calc(75vh-40px)] overflow-y-auto px-3 py-2">
                                            {sidePanelContent}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </main>
                ) : (
                    <main className="relative flex-1 min-w-0 min-h-0">
                        {/* 홈 / 자료분석 레이아웃 (같은 계열, 폭만 다름) */}
                        <div className={homeLikeInnerClass}>
                            {children}
                        </div>

                        {/* 오른쪽 패널 (홈에서도 동일 로직) */}
                        {activeSidePanel && sidePanelContent && (
                            <>
                                <div className="hidden lg:block absolute right-[16px] top-6 bottom-6 w-[266px]">
                                    <div className="panel-surface flex h-full flex-col rounded-2xl border shadow-soft">
                                        {sidePanelContent}
                                    </div>
                                </div>

                                <div className="fixed inset-0 z-40 flex items-end bg-black/30 lg:hidden">
                                    <div className="panel-surface w-full max-h-[75%] rounded-t-2xl border border-border-subtle shadow-xl">
                                        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
                      <span className="text-xs font-semibold">
                        {activeSidePanel === 'friends' ? '친구' : '내 정보'}
                      </span>
                                            <button
                                                type="button"
                                                className="rounded-full px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-100/60"
                                                onClick={() => setActiveSidePanel(null)}
                                            >
                                                닫기
                                            </button>
                                        </div>
                                        <div className="max-h-[calc(75vh-40px)] overflow-y-auto px-3 py-2">
                                            {sidePanelContent}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </main>
                )}
            </div>
        </div>
    );
}
