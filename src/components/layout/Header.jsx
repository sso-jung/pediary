import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import {Link} from "react-router-dom";

export default function Header() {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);

    return (
        <div className="mx-auto flex max-w-[85rem] items-center justify-between px-4 py-3 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
            {/* 로고 / 타이틀 */}
            <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-2xl bg-primary-100" />
                <span className="text-lg font-semibold text-slate-800">
                Pediary
              </span>
            </div>
        </Link>

            {/* 오른쪽 영역 (추후 검색, 프로필 등) */}
            <div className="flex items-center gap-3">
                {user && (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span>{user.email}</span>
                        <Button variant="ghost" onClick={signOut}>
                            로그아웃
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
