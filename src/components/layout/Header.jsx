// src/components/layout/Header.jsx
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import pediaryMark from '../../assets/logo.png';

export default function Header({ onToggleFriends, onToggleMyInfo, activeSidePanel }) {
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
            {/* 왼쪽: 로고 + 탭 */}
            <div className="flex items-center gap-4">
                <Link to="/" className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className="h-[36px] h-[36px] rounded-3xl bg-primary-100 overflow-hidden">
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

                <div className="hidden sm:inline-flex rounded-full bg-slate-100 p-1 text-xs">
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
            </div>

            {/* 오른쪽: 유저 정보 + 내정보/친구/로그아웃 */}
            <div className="flex items-center gap-2">
                {user && (
                    <>
                        <span className="text-xs text-slate-500">
                            {user.email}
                        </span>

                        {/* ✅ 내정보 버튼 */}
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className={
                            'hidden lg:block rounded-full px-[7px] py-[5px] text-xs transition ' +
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
                            'hidden lg:block rounded-full px-[7px] py-[5px] text-xs transition ' +
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
