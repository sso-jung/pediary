// src/components/layout/Header.jsx
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import pediaryMark from '../../assets/logo.png';
import pediaryMarkDark from '../../assets/logo-dark.png';
import pediaryMarkDusk from '../../assets/logo-dusk.svg';

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

    const logoSrc =
        theme === 'dusk'
            ? pediaryMarkDusk
            : theme === 'midnight'
                ? pediaryMarkDark
                : pediaryMark;

    const isMaterials = path.startsWith('/materials');

    const isDocs =
        !isMaterials &&
        (path.startsWith('/wiki') ||
            path.startsWith('/category') ||
            path.startsWith('/docs') ||
            path.startsWith('/trash'));

    let activeTab = 'home';
    if (isDocs) activeTab = 'docs';
    if (isMaterials) activeTab = 'materials';

    const isFriendsOpen = activeSidePanel === 'friends';
    const isMyInfoOpen = activeSidePanel === 'me';

    return (
        <div
            className="
        mx-auto flex max-w-[100rem] items-center justify-between
        px-3 py-2 sm:px-4 lg:px-8
        gap-1.5
      "
        >
            {/* 왼쪽: 로고 + 탭 + (모바일용 카테고리 버튼) */}
            <div className="flex items-center gap-1.5">
                <Link to="/" className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <div
                            className="h-[30px] w-[30px] sm:h-[36px] sm:w-[36px] rounded-3xl bg-primary-100 overflow-hidden">
                            <img
                                src={logoSrc}
                                alt="Pediary"
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <span className="text-[15px] sm:text-lg font-semibold"
                              style={{color: "var(--color-text-main)"}}>
                          Pediary
                        </span>
                    </div>
                </Link>

                {/* 상단 탭 (홈 / 문서 / 자료 분석) */}
                <div className="header-pill">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="header-tab"
                        data-active={activeTab === 'home'}
                    >
                        홈
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/docs')}
                        className="header-tab"
                        data-active={activeTab === 'docs'}
                    >
                        문서
                    </button>
                    {/*<button*/}
                    {/*    type="button"*/}
                    {/*    onClick={() => navigate('/materials')}*/}
                    {/*    className="header-tab"*/}
                    {/*    data-active={activeTab === 'materials'}*/}
                    {/*>*/}
                    {/*    자료 분석*/}
                    {/*</button>*/}
                </div>

                {/* 모바일/태블릿용 카테고리 토글 버튼 (문서 화면에서만) */}
                {isDocs && onToggleSidebar && (
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className={`
              inline-flex items-center rounded-full border border-slate-200
              px-2 py-[2px] text-[9px]
              bg-slate-100 transition shrink-0
              basic:hidden
              ${
                            isSidebarOpen
                                ? 'bg-slate-100 text-slate-800'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
            `}
                    >
                        카테고리
                    </button>
                )}
            </div>

            {/* 오른쪽: 유저 정보 + 테마 + 내정보/친구/로그아웃 */}
            <div className="flex items-center gap-1.5">
                {user && (
                    <button
                        type="button"
                        onClick={onToggleTheme}
                        className="ui-control h-7 w-7 sm:h-8 sm:w-8 text-[11px] sm:text-[13px]"
                        aria-label="테마 전환"
                        title={theme}
                    >
                        {theme === 'noon' && '☀️'}
                        {theme === 'midnight' && '🌙'}
                        {theme === 'twilight' && '🌅'}
                        {theme === 'dusk' && '🌆'}
                    </button>
                )}

                {user && (
                    <>
                        {/* 이메일은 여전히 sm 이상에서만 */}
                        <span className="hidden sm:inline-block text-xs max-w-[160px] truncate"
                              style={{color: "var(--color-text-muted)"}}>
                          {user.email}
                        </span>

                        {/* 내정보 / 친구 버튼 (모바일에서는 숨김) */}
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="hidden sm:inline-flex rounded-full px-[7px] py-[5px] text-xs"
                            data-active={isMyInfoOpen}
                            onClick={onToggleMyInfo}
                        >
                            내정보
                        </Button>

                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="hidden sm:inline-flex px-[7px] py-[5px] text-xs"
                            data-active={isFriendsOpen}
                            onClick={onToggleFriends}
                        >
                            친구
                        </Button>

                        {/* 커스텀 로그아웃 버튼 – 더 작게 */}
                        <button
                            type="button"
                            onClick={signOut}
                            className="ui-control px-2 py-[3px] text-[10px] sm:px-[7px] sm:py-[5px] sm:text-xs"
                        >
                            로그아웃
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
