// src/features/account/MyInfoPanel.jsx
import { useState, useMemo, useEffect  } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
    fetchMyProfile,
    updateMyProfile,
    fetchMyDocuments,
    fetchMonthlyActiveDays,
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
    const [sectionColor, setSectionColor] = useState('');
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

    // 닉네임 업데이트
    const updateNicknameMutation = useMutation({
        mutationFn: ({ nickname, sectionNumberColor }) =>
            updateMyProfile(userId, {
                nickname,
                email: user?.email,
                sectionNumberColor, // ✅ 추가
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myProfile', userId] });
            showSnackbar('저장했어.');
        },
        onError: (err) => {
            console.error('updateMyProfile error', err);
            showSnackbar('저장에 실패했어. 잠시 후 다시 시도해줘.');
        },
    });

    const handleSaveNickname = (e) => {
        e.preventDefault();
        const value = nicknameInput.trim();

        updateNicknameMutation.mutate({
            nickname: value || null,
            sectionNumberColor: sectionColor ? sectionColor : null, // ''이면 null로 저장(기본)
        });
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

    const { data: activeDaysThisMonth = 0 } = useQuery({
        queryKey: ['monthlyActiveDays', userId, year, month],
        queryFn: () => fetchMonthlyActiveDays(userId, year, month),
        enabled: !!userId,
    });

    useEffect(() => {
        if (!profile) return;

        // 닉네임 초기값
        setNicknameInput(profile.nickname ?? '');

        // 섹션 번호 색 초기값 (DB 컬럼: section_number_color)
        setSectionColor(profile.section_number_color ?? '');
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
                            <div className="mt-2">
                                <label className="block text-[9pt] text-slate-400 mb-1">
                                    섹션 번호 색상
                                </label>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={sectionColor || '#94a3b8'}
                                        onChange={(e) => setSectionColor(e.target.value)}
                                        disabled={profileLoading || updateNicknameMutation.isLoading}
                                        className="h-8 w-10 rounded border border-slate-200 bg-white"
                                    />

                                    <Input
                                        type="text"
                                        value={sectionColor}
                                        onChange={(e) => setSectionColor(e.target.value)}
                                        placeholder="#RRGGBB)"
                                        disabled={profileLoading || updateNicknameMutation.isLoading}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setSectionColor('')}
                                        disabled={profileLoading || updateNicknameMutation.isLoading}
                                        className="
                                            inline-flex h-8 w-8 items-center justify-center
                                            rounded-md border border-slate-200 bg-white
                                            text-slate-500 shadow-sm
                                            hover:bg-slate-50 hover:text-slate-700
                                            disabled:opacity-60
                                        "
                                        aria-label="기본 색으로 재설정"
                                        title="기본 색으로"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 12a9 9 0 1 1-3-6.7"/>
                                            <path d="M21 3v6h-6"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    size="xs"
                                    disabled={updateNicknameMutation.isLoading}
                                    className="mt-1 px-3 py-[4px] text-[9pt]"
                                >
                                    {updateNicknameMutation.isLoading ? '저장 중...' : '프로필 저장'}
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
