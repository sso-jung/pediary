// src/components/layout/Header.jsx
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

export default function Header({ onToggleFriends }) {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);

    return (
        <div className="mx-auto flex max-w-[85rem] items-center justify-between px-4 py-3 lg:px-8">
            <Link to="/" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-2xl bg-primary-100" />
                    <span className="text-lg font-semibold text-slate-800">
                        Pediary
                    </span>
                </div>
            </Link>

            <div className="flex items-center gap-2">
                {user && (
                    <>
                        <span className="text-xs text-slate-500">
                            {user.email}
                        </span>

                        {/* 친구 패널 토글 버튼 */}
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="rounded-full px-[7px] py-[5px] text-xs"
                            onClick={onToggleFriends}
                        >
                            친구
                        </Button>

                        {/* 로그아웃 버튼 - 같은 톤으로 작게 */}
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
