// src/components/layout/Header.jsx
import { useState } from 'react';
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import pediaryMark from '../../assets/logo.png';
import pediaryMarkDark from '../../assets/logo-dark.png';
import pediaryMarkDusk from '../../assets/logo-dusk.svg';
import { useSnackbar } from '../ui/SnackbarContext';
import { downloadMyDocumentsExcel } from '../../lib/exportMyDocumentsExcel';

export default function Header({
                                   onToggleFriends,
                                   onToggleMyInfo,
                                   onToggleSidebar,
                                   activeSidePanel,
                                   isSidebarOpen,
                                   theme,
                               }) {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);
    const { showSnackbar } = useSnackbar();
    const [exporting, setExporting] = useState(false);

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

    const handleExportExcel = async () => {
        if (!user) {
            showSnackbar?.('로그인 후에 내보내기를 할 수 있어.');
            return;
        }
        if (exporting) return;

        try {
            setExporting(true);
            await downloadMyDocumentsExcel(user.id);
            showSnackbar?.('엑셀 백업 파일을 내려받았어.');
        } catch (e) {
            console.error(e);
            showSnackbar?.('엑셀 내보내기에 실패했어. 잠시 후 다시 시도해줘.');
        } finally {
            setExporting(false);
        }
    };

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

                {activeTab === 'home' && (
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={exporting}
                        className="ui-btn-success inline-flex items-center gap-1 rounded-full border px-2.5 py-[5px] text-[10px] font-medium shadow-sm disabled:opacity-60 sm:px-3 sm:py-1.5 sm:text-xs"
                    >
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 4h16v6H4z" />
                            <path d="M9 4v6" />
                            <path d="M15 4v6" />
                            <path d="M6 14l3 3-3 3" />
                            <path d="M10 20h8" />
                        </svg>
                        <span>{exporting ? '내보내는 중...' : '엑셀로 백업'}</span>
                    </button>
                )}

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

            {/* 오른쪽: 유저 정보 + 내정보/친구/로그아웃 */}
            <div className="flex items-center gap-1.5">
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
