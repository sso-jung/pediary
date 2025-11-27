// src/components/layout/Header.jsx
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import pediaryMark from '../../assets/logo.png';

export default function Header({
                                   onToggleFriends,
                                   onToggleMyInfo,
                                   onToggleSidebar,
                                   activeSidePanel,
                                   isSidebarOpen,
                                   theme,
                                   onToggleTheme,
                               }) {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);

    const location = useLocation();
    const navigate = useNavigate();

    const path = location.pathname;
    const isDocs =
        path.startsWith('/wiki') ||
        path.startsWith('/category') ||
        path.startsWith('/docs') ||
        path.startsWith('/trash');

    const activeTab = isDocs ? 'docs' : 'home';

    const isFriendsOpen = activeSidePanel === 'friends';
    const isMyInfoOpen = activeSidePanel === 'me';

    return (
        <div className="mx-auto flex max-w-[100rem] items-center justify-between px-4 py-[10px] lg:px-8">
            {/* 왼쪽: 로고 + 탭 + (모바일용 카테고리 버튼) */}
            <div className="flex items-center gap-3">
                <Link to="/" className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className="h-[36px] w-[36px] rounded-3xl bg-primary-100 overflow-hidden">
                            <img
                                src={pediaryMark}
                                alt="Pediary"
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <span className="text-lg font-semibold text-slate-800">
                            Pediary
                        </span>
                    </div>
                </Link>

                {/* 상단 탭 (홈 / 문서) */}
                <div className="sm:inline-flex rounded-full bg-slate-100 p-1 text-xs">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className={
                            'rounded-full px-3 py-1 ' +
                            (activeTab === 'home'
                                ? 'bg-white text-slate-900 shadow'
                                : 'text-slate-500 hover:text-slate-700')
                        }
                    >
                        홈
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/docs')}
                        className={
                            'rounded-full px-3 py-1 ' +
                            (activeTab === 'docs'
                                ? 'bg-white text-slate-900 shadow'
                                : 'text-slate-500 hover:text-slate-700')
                        }
                    >
                        문서
                    </button>
                </div>

                {/* 모바일/태블릿용 카테고리 토글 버튼 (문서 화면에서만) */}
                {isDocs && onToggleSidebar && (
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className={`
                          inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] transition
                          min-[1420px]:hidden            /* ✅ 1420px 이상(데스크탑)에서는 숨김 */
                          ${isSidebarOpen
                            ? 'bg-slate-100 text-slate-800'
                            : 'bg-white/80 text-slate-600 hover:bg-slate-100'}
                        `}
                    >
                        카테고리
                    </button>
                )}
            </div>

            {/* 오른쪽: 유저 정보 + 테마 + 내정보/친구/로그아웃 */}
            <div className="flex items-center gap-2">
                {/* 테마 토글 버튼 (로그인 여부와 무관하게 노출해도 되고, 지금은 로그인한 경우에만) */}
                {user && (
                    <button
                        type="button"
                        onClick={onToggleTheme}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-[13px] text-slate-500 shadow-sm hover:bg-slate-100"
                        aria-label="테마 전환"
                    >
                        {theme === 'dark' ? '🌙' : '☀️'}
                    </button>
                )}

                {user && (
                    <>
                        <span className="hidden sm:inline-block text-xs text-slate-500 max-w-[160px] truncate">
                            {user.email}
                        </span>

                        {/* ✅ 내정보 버튼 */}
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className={
                                'hidden sm:inline-flex rounded-full px-[7px] py-[5px] text-xs transition ' +
                                (isMyInfoOpen
                                    ? '!bg-gray-500 !text-white shadow-sm hover:!bg-gray-500'
                                    : 'bg-transparent text-slate-600 hover:bg-slate-100')
                            }
                            onClick={onToggleMyInfo}
                        >
                            내정보
                        </Button>

                        {/* ✅ 친구 버튼 */}
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className={
                                'hidden sm:inline-flex rounded-full px-[7px] py-[5px] text-xs transition ' +
                                (isFriendsOpen
                                    ? '!bg-gray-500 !text-white shadow-sm hover:!bg-gray-500'
                                    : 'bg-transparent text-slate-600 hover:bg-slate-100')
                            }
                            onClick={onToggleFriends}
                        >
                            친구
                        </Button>

                        <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            className="rounded-full px-[7px] py-[5px] text-xs"
                            onClick={signOut}
                        >
                            로그아웃
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
