// src/components/layout/AppLayout.jsx
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import FriendsPage from '../../features/friends/FriendsPage';
import MyInfoPanel from '../../features/account/MyInfoPanel';

const THEME_STORAGE_KEY = 'pediary-theme';

function getOrbitTheme() {
    const hour = new Date().getHours();

    if (hour >= 8 && hour < 16) return 'noon';
    if (hour >= 16) return 'dusk';
    return 'midnight';
}

function normalizeThemeSetting(value) {
    if (value === 'dusk') return 'sunset';
    if (value === 'dark') return 'midnight';
    if (value === 'light') return 'noon';
    if (value === 'noon' || value === 'sunset' || value === 'midnight' || value === 'orbit') {
        return value;
    }
    return 'noon';
}

function getEffectiveTheme(themeSetting) {
    if (themeSetting === 'orbit') return getOrbitTheme();
    if (themeSetting === 'sunset') return 'dusk';
    return themeSetting;
}

export default function AppLayout({ children }) {
    const [activeSidePanel, setActiveSidePanel] = useState(null); // 'friends' | 'me' | null
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [orbitTick, setOrbitTick] = useState(() => Date.now());
    const sidebarSwipeRef = useRef(null);

    const [themeSetting, setThemeSetting] = useState(() => {
        if (typeof window === 'undefined') return 'noon';
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

        return normalizeThemeSetting(stored);
    });

    const theme = useMemo(() => getEffectiveTheme(themeSetting), [themeSetting, orbitTick]);

    const handleSaveThemeSetting = useCallback((nextThemeSetting) => {
        const normalized = normalizeThemeSetting(nextThemeSetting);

        setThemeSetting(normalized);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
        }
    }, []);

    const handleToggleFriends = () => {
        setActiveSidePanel((prev) => (prev === 'friends' ? null : 'friends'));
    };

    const handleToggleMyInfo = () => {
        setActiveSidePanel((prev) => (prev === 'me' ? null : 'me'));
    };

    const handleToggleSidebar = () => {
        setIsSidebarOpen((prev) => !prev);
    };

    const handleSidebarTouchStart = (e) => {
        if (!showSidebarLayout) return;

        const touch = e.touches?.[0];
        if (!touch) return;
        if (!isSidebarOpen && touch.clientX > 28) return;

        sidebarSwipeRef.current = {
            x: touch.clientX,
            y: touch.clientY,
        };
    };

    const handleSidebarTouchEnd = (e) => {
        if (!showSidebarLayout) return;

        const start = sidebarSwipeRef.current;
        sidebarSwipeRef.current = null;
        const touch = e.changedTouches?.[0];
        if (!start || !touch) return;

        const diffX = touch.clientX - start.x;
        const diffY = touch.clientY - start.y;
        if (Math.abs(diffX) < 64 || Math.abs(diffX) < Math.abs(diffY) * 1.4) return;

        if (diffX > 0) {
            setIsSidebarOpen(true);
            return;
        }

        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        }
    };

    const location = useLocation();
    const path = location.pathname;

    const isMaterials = path.startsWith('/materials');

    const isDocsLayout =
        path.startsWith('/wiki') ||
        path.startsWith('/category') ||
        path.startsWith('/docs') ||
        path.startsWith('/trash');

    const isDocumentPage = path.startsWith('/wiki/');

    const showSidebarLayout =
        !isMaterials &&
        !isDocumentPage &&
        (path.startsWith('/category') ||
            path.startsWith('/docs') ||
            path.startsWith('/trash'));

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsSidebarOpen(false);
        setActiveSidePanel(null);
    }, [path]);

    const sidePanelContent = useMemo(() => {
        if (activeSidePanel === 'friends') return <FriendsPage />;
        if (activeSidePanel === 'me') {
            return (
                <MyInfoPanel
                    themeSetting={themeSetting}
                    onSaveThemeSetting={handleSaveThemeSetting}
                />
            );
        }
        return null;
    }, [activeSidePanel, handleSaveThemeSetting, themeSetting]);

    const homeLikeInnerClass = isMaterials
        ? `
      relative mx-auto flex h-full min-h-0 w-full max-w-[100rem] flex-col
      pl-2 pr-2 py-6
      lg:pl-[80px] lg:pr-[80px]
    `
        : `
      relative mx-auto flex h-full min-h-0 w-full max-w-[100rem] flex-col
      px-3 py-4 sm:px-4 lg:px-9
    `;

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    useEffect(() => {
        if (themeSetting !== 'orbit') return;

        const timer = window.setInterval(() => {
            setOrbitTick(Date.now());
        }, 60 * 1000);

        return () => window.clearInterval(timer);
    }, [themeSetting]);


    return (
        <div
            data-theme={theme}
            className="app-shell flex h-full flex-col"
        >
            <header className="app-header shrink-0">
                <Header
                    onToggleFriends={handleToggleFriends}
                    onToggleMyInfo={handleToggleMyInfo}
                    onToggleSidebar={showSidebarLayout ? handleToggleSidebar : undefined}
                    activeSidePanel={activeSidePanel}
                    isSidebarOpen={isSidebarOpen}
                    theme={theme}
                />
            </header>

            <div
                className="flex flex-1 min-h-0"
                onTouchStart={handleSidebarTouchStart}
                onTouchEnd={handleSidebarTouchEnd}
            >
                {showSidebarLayout && (
                    <>
                        <aside
                            className="
                                hidden basic:block
                                w-[232px] min-h-0 shrink-0 border-r border-border-subtle
                                bg-surface-elevated/80 backdrop-blur
                              "
                        >
                            <Sidebar />
                        </aside>

                        <div
                            className={`fixed inset-0 z-40 basic:hidden ${
                                isSidebarOpen ? '' : 'pointer-events-none invisible'
                            }`}
                        >
                            <div
                                className={`absolute inset-0 bg-black/30 transition-opacity ${
                                    isSidebarOpen ? 'opacity-100' : 'opacity-0'
                                }`}
                                onClick={() => setIsSidebarOpen(false)}
                            />

                            <div
                                className={`absolute inset-y-0 left-0 flex w-[78%] max-w-[320px] transform transition-transform duration-200 ${
                                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                                }`}
                            >
                                <div className="panel-surface flex h-full w-full flex-col rounded-r-2xl shadow-xl">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                                        <span className="text-[11px] font-semibold">카테고리</span>
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

                {isDocsLayout ? (
                    <main className="relative flex-1 min-w-0 min-h-0">
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

                        {activeSidePanel && sidePanelContent && (
                            <>
                                <div className="hidden min-[1420px]:block absolute right-[16px] top-6 bottom-6 w-[266px]">
                                    <div className="panel-surface flex h-full flex-col rounded-2xl border shadow-soft">
                                        {sidePanelContent}
                                    </div>
                                </div>

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
                        <div className={homeLikeInnerClass}>{children}</div>

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
            <div id="portal-root" />
        </div>
    );
}
