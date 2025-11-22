import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const signUp = useAuthStore((s) => s.signUp);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== passwordConfirm) {
            setError('비밀번호가 서로 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        try {
            // 🔹 1) 회원가입을 한 번만 호출하고 user 객체를 받는다.
            const user = await signUp(email, password);

            // 🔹 2) profiles 테이블에 프로필 생성/업데이트
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        email: user.email,
                    });

                if (profileError) {
                    console.error('profiles upsert error:', profileError);
                    // 여기서 throw 해도 되고, 그냥 콘솔만 찍고 넘어가도 됨
                    // throw profileError;
                }
            }

            alert(
                '회원가입이 완료되었습니다. 이메일로 전송된 인증 링크를 클릭한 후 로그인해 주세요.',
            );
            navigate('/login', { replace: true });
        } catch (err) {
            console.error(err);
            setError(err.message || '회원가입에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-softbg px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft">
                <h1 className="text-xl font-semibold text-slate-800 text-center">
                    Pediary 회원가입
                </h1>
                <p className="mt-1 text-sm text-slate-500 text-center">
                    나만의 위키 다이어리를 지금 시작해볼까?
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
                            placeholder="최소 6자 이상"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            비밀번호 확인
                        </label>
                        <Input
                            type="password"
                            placeholder="한 번 더 입력"
                            value={passwordConfirm}
                            onChange={(e) => setPasswordConfirm(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-500 mt-1">
                            {error}
                        </p>
                    )}

                    <Button
                        className="w-full mt-2"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? '회원가입 중...' : '회원가입'}
                    </Button>

                    <p className="mt-3 text-xs text-slate-500 text-center">
                        이미 계정이 있다면{' '}
                        <Link
                            to="/login"
                            className="text-primary-500 hover:text-primary-600 font-medium"
                        >
                            로그인
                        </Link>
                        해줘.
                    </p>
                </form>
            </div>
        </div>
    );
}
