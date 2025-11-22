// src/features/account/MyInfoPanel.jsx
import { useState, useMemo, useEffect  } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
    fetchMyProfile,
    updateMyProfile,
    fetchMyDocuments,
    fetchMonthlyActivity,
} from '../../lib/wikiApi';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useSnackbar } from '../../components/ui/SnackbarContext';

export default function MyInfoPanel() {
    const user = useAuthStore((s) => s.user);
    const userId = user?.id;
    const queryClient = useQueryClient();
    const { showSnackbar } = useSnackbar();

    const [nicknameInput, setNicknameInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // ✅ v5 스타일: useQuery({ queryKey, queryFn, ... })
    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['myProfile', userId],
        queryFn: () => fetchMyProfile(userId),
        enabled: !!userId,
    });

    const { data: myDocs } = useQuery({
        queryKey: ['myDocuments', userId],
        queryFn: () => fetchMyDocuments(userId),
        enabled: !!userId,
    });

    const { data: monthlyActivity } = useQuery({
        queryKey: ['monthlyActivity', userId, year, month],
        queryFn: () => fetchMonthlyActivity(userId, year, month),
        enabled: !!userId,
    });

    // 닉네임 업데이트
    const updateNicknameMutation = useMutation({
        mutationFn: (nickname) =>
            updateMyProfile(userId, {
                nickname,
                email: user?.email,   // ✅ 이메일 같이 전송
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myProfile', userId] });
            showSnackbar('닉네임을 수정했어.');
        },
        onError: (err) => {
            console.error('updateMyProfile error', err);
            showSnackbar('닉네임 변경에 실패했어. 잠시 후 다시 시도해줘.');
        },
    });

    const handleSaveNickname = (e) => {
        e.preventDefault();
        const value = nicknameInput.trim();
        updateNicknameMutation.mutate(value || null);
    };

    // 비밀번호 변경
    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!newPassword || !newPasswordConfirm) {
            showSnackbar('새 비밀번호를 입력해줘.');
            return;
        }
        if (newPassword !== newPasswordConfirm) {
            showSnackbar('비밀번호가 서로 일치하지 않아.');
            return;
        }

        try {
            setPwLoading(true);
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (error) {
                console.error(error);
                showSnackbar('비밀번호 변경에 실패했어.');
            } else {
                showSnackbar('비밀번호를 변경했어.');
                setNewPassword('');
                setNewPasswordConfirm('');
            }
        } finally {
            setPwLoading(false);
        }
    };

    // 간단 통계
    const totalDocs = myDocs?.length ?? 0;

    const activeDaysThisMonth = useMemo(() => {
        if (!monthlyActivity || monthlyActivity.length === 0) return 0;
        const set = new Set(
            monthlyActivity.map((a) => a.created_at.slice(0, 10)),
        );
        return set.size;
    }, [monthlyActivity]);

    useEffect(() => {
        if (profile && profile.nickname != null) {
            setNicknameInput(profile.nickname);
        }
    }, [profile]);

    return (
        <div className="flex h-full flex-col text-xs">
            {/* 상단 헤더 */}
            <div className="border-b border-slate-100 px-3 pt-3 pb-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                        내 정보
                    </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                    닉네임과 비밀번호를 관리하고, 나의 기록 통계를 확인해 보자.
                </p>
            </div>

            {/* 내용 영역 */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-4">
                {/* 프로필 섹션 */}
                <section>
                    <h2 className="mb-1 text-[11px] font-semibold text-slate-500">
                        프로필
                    </h2>
                    <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-2">
                        <div>
                            <div className="text-[10px] text-slate-400">
                                이메일
                            </div>
                            <div className="text-[11px] text-slate-700">
                                {user?.email}
                            </div>
                        </div>

                        <form onSubmit={handleSaveNickname} className="space-y-1">
                            <label className="block text-[9pt] text-slate-400">
                                닉네임
                            </label>
                            <Input
                                type="text"
                                value={nicknameInput}
                                onChange={(e) => setNicknameInput(e.target.value)}
                                placeholder="표시할 닉네임"
                                disabled={profileLoading || updateNicknameMutation.isLoading}
                            />
                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    size="xs"
                                    disabled={updateNicknameMutation.isLoading}
                                    className="mt-1 px-3 py-[4px] text-[9pt]"
                                >
                                    {updateNicknameMutation.isLoading ? '저장 중...' : '닉네임 저장'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </section>

                {/* 비밀번호 변경 섹션 */}
                <section>
                    <h2 className="mb-1 text-[9pt] font-semibold text-slate-500">
                        비밀번호 변경
                    </h2>
                    <form
                        onSubmit={handleChangePassword}
                        className="space-y-2 rounded-xl bg-slate-50 px-3 py-2"
                    >
                        <div>
                            <label className="block text-[9pt] text-slate-400 mb-1">
                                새 비밀번호
                            </label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="새 비밀번호"
                            />
                        </div>
                        <div>
                            <label className="block text-[9pt] text-slate-400 mb-1">
                                새 비밀번호 확인
                            </label>
                            <Input
                                type="password"
                                value={newPasswordConfirm}
                                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                placeholder="한 번 더 입력"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                size="xs"
                                disabled={pwLoading}
                                className="mt-1 px-3 py-[4px] text-[9pt]"
                            >
                                {pwLoading ? '변경 중...' : '비밀번호 변경'}
                            </Button>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            로그인된 상태에서 바로 비밀번호를 바꿀 수 있어.
                        </p>
                    </form>
                </section>

                {/* 나의 통계 섹션 */}
                <section>
                    <h2 className="mb-1 text-[11px] font-semibold text-slate-500">
                        나의 통계
                    </h2>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-xl bg-white px-3 py-2 shadow-sm border border-slate-100">
                            <div className="text-[10px] text-slate-400">
                                작성한 문서 수
                            </div>
                            <div className="mt-1 text-base font-semibold text-slate-800">
                                {totalDocs}
                            </div>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 shadow-sm border border-slate-100">
                            <div className="text-[10px] text-slate-400">
                                이번 달 활동일수
                            </div>
                            <div className="mt-1 text-base font-semibold text-slate-800">
                                {activeDaysThisMonth}
                                <span className="ml-1 text-[10px] text-slate-400">
                                    일
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                        활동일수는 이번 달에 문서를 작성하거나 수정, 조회한 날의 수야.
                    </p>
                </section>
            </div>
        </div>
    );
}
