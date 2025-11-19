import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true); // 일단 기본 on
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const signIn = useAuthStore((s) => s.signIn);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // TODO: rememberMe 값 이용해서 세션 저장 방식 세분화 (나중에)
            await signIn(email, password);

            // 로그인 성공 시 메인으로
            navigate('/', { replace: true });
        } catch (err) {
            console.error(err);
            const msg = err?.message || '';

            if (msg.includes('Email not confirmed')) {
                setError(
                    '이메일 인증이 아직 완료되지 않았어요.\n메일함에서 인증 링크를 클릭한 다음 다시 로그인해 주세요.'
                );
            } else if (msg.includes('Invalid login credentials')) {
                setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            } else {
                setError('로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-softbg px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft">
                <h1 className="text-xl font-semibold text-slate-800 text-center">
                    Pediary 로그인
                </h1>
                <p className="mt-1 text-sm text-slate-500 text-center">
                    나만의 위키 다이어리에 다시 들어가볼까?
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            이메일
                        </label>
                        <Input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            비밀번호
                        </label>
                        <Input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300 text-primary-500 focus:ring-primary-300"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span>로그인 유지</span>
                        </label>

                        <Link
                            to="/signup"
                            className="text-primary-500 hover:text-primary-600 font-medium"
                        >
                            회원가입
                        </Link>
                    </div>

                    {error && (
                        <p className="text-xs text-red-500 mt-1 whitespace-pre-line">
                            {error}
                        </p>
                    )}

                    <Button
                        className="w-full mt-2"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? '로그인 중...' : '로그인'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
