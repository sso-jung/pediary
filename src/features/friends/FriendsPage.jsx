// src/features/friends/FriendsPage.jsx
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
    useFriends,
    useIncomingFriendRequests, useOutgoingFriendRequests,
    useProfileSearch,
} from './hooks/useFriends';
import {
    useSendFriendRequest,
    useAcceptFriendRequest,
    useDeleteFriendRelation,
} from './hooks/useFriendMutations';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';

export default function FriendsPage() {
    const user = useAuthStore((s) => s.user);
    const userId = user?.id;

    const [tab, setTab] = useState('friends'); // friends | requests | sent | search
    const [keyword, setKeyword] = useState('');

    const { data: friends } = useFriends(userId);
    const { data: incoming } = useIncomingFriendRequests(userId);
    const { data: outgoing } = useOutgoingFriendRequests(userId);
    const { data: profiles } = useProfileSearch(keyword);

    const sendReq = useSendFriendRequest(userId);
    const acceptReq = useAcceptFriendRequest(userId);
    const deleteRel = useDeleteFriendRelation(userId);

    if (!userId) {
        return (
            <div className="flex h-full items-center justify-center text-[11px]"
                 style={{color: "var(--color-text-muted)"}}>
                로그인 후 이용해 주세요.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col text-xs">
            {/* 상단 바 */}
            <div className="border-b px-3 pt-3 pb-1" style={{borderColor: "var(--color-border-subtle)"}}>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold ui-page-title">친구</span>
                </div>

                <div className="mt-2 ui-tabbar text-[11px] w-full">
                    {['friends', 'requests', 'sent', 'search'].map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setTab(k)}
                            className="ui-tab w-[25%]"
                            data-active={tab === k}
                        >
                            {k === 'friends' && '친구\n목록'}
                            {k === 'requests' && '받은\n요청'}
                            {k === 'sent' && '보낸\n요청'}
                            {k === 'search' && '친구\n찾기'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 내용 영역 */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
                {tab === 'friends' && (
                    <FriendsList
                        friends={friends}
                        onDelete={(id) => deleteRel.mutate(id)}
                    />
                )}

                {tab === 'requests' && (
                    <FriendRequests
                        incoming={incoming}
                        onAccept={(id) => acceptReq.mutate(id)}
                        onReject={(id) => deleteRel.mutate(id)}
                    />
                )}

                {tab === 'sent' && (
                    <SentRequests
                        outgoing={outgoing}
                        onCancel={(id) => deleteRel.mutate(id)}
                    />
                )}

                {tab === 'search' && (
                    <FriendSearch
                        keyword={keyword}
                        setKeyword={setKeyword}
                        profiles={profiles}
                        userId={userId}
                        friends={friends}                // ✅ 추가
                        onSendRequest={(friendId) =>
                            sendReq.mutate({friendId})
                        }
                    />
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────
// 하위 컴포넌트들
// ─────────────────────────────

function FriendsList({friends = [], onDelete}) {
    if (!friends.length) {
        return (
            <EmptyState
                icon="friends"
                title="아직 친구가 없어."
                description={
                    '친구 찾기 탭에서 친구를 추가하면, 친구의 문서도 열람할 수 있어.'
                }
            />
        );
    }

    return (
        <ul className="space-y-1">
            {friends.map((f) => {
                const profile = f.friend_profile;
                const displayName =
                    profile?.nickname || profile?.email || f.friend_id;

                return (
                    <li key={f.id} className="ui-list-item">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-medium" style={{color: "var(--color-text-main)"}}>
                              {displayName}
                            </span>
                            {profile?.nickname && (
                                <span className="text-[10px]" style={{color: "var(--color-text-muted)"}}>
                                  {profile.email}
                                </span>
                            )}
                            <span className="text-[10px]" style={{color: "var(--color-text-muted)"}}>
                              {new Date(f.created_at).toLocaleDateString('ko-KR')} 친구가 되었어요.
                            </span>
                        </div>

                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="px-[10px] py-[2pt] text-[8.5pt]"
                            onClick={() => onDelete(f.id)}
                        >
                            삭제
                        </Button>
                    </li>
                );
            })}
        </ul>
    );
}

function SentRequests({outgoing = [], onCancel}) {
    if (!outgoing.length) {
        return (
            <p className="text-[11px] text-slate-400">
                보낸 친구 요청이 없어요.
            </p>
        );
    }

    return (
        <ul className="space-y-1">
            {outgoing.map((r) => {
                const profile = r.friend_profile;
                const displayName =
                    profile?.nickname || profile?.email || r.friend_id;

                return (
                    <li
                        key={r.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5"
                    >
                        <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-slate-800">
                                {displayName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                                {new Date(r.created_at).toLocaleString('ko-KR')}
                            </span>
                        </div>
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="px-[8pt] py-[2pt] text-[8.5pt]"
                            onClick={() => onCancel(r.id)}
                        >
                            요청 취소
                        </Button>
                    </li>
                );
            })}
        </ul>
    );
}

function FriendRequests({ incoming = [], onAccept, onReject }) {
    if (!incoming.length) {
        return (
            <p className="text-[11px] text-slate-400">
                받은 친구 요청이 없어요.
            </p>
        );
    }

    return (
        <ul className="space-y-1">
            {incoming.map((r) => {
                const profile = r.requester_profile;
                const displayName =
                    profile?.nickname || profile?.email || r.user_id;

                return (
                    <li
                        key={r.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5"
                    >
                        <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-slate-800">
                                {displayName}
                            </span>
                            {profile?.nickname && (
                                <span className="text-[10px] text-slate-400">
                                    {profile.email}
                                </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                                {new Date(r.created_at).toLocaleString('ko-KR')}
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                size="xs"
                                className="px-[8px] py-[2pt] text-[8.5pt]"
                                onClick={() => onAccept(r.id)}
                            >
                                수락
                            </Button>
                            <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                className="px-[8px] py-[2pt] text-[8.5pt]"
                                onClick={() => onReject(r.id)}
                            >
                                거절
                            </Button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}


function FriendSearch({
    keyword,
    setKeyword,
    profiles = [],
    userId,
    friends = [],        // ✅ 추가
    onSendRequest,
}) {
    return (
        <div className="space-y-2">
            <div className="space-y-1">
                <input
                    className="w-full rounded-lg border px-2 py-1.5 text-[11px] outline-none"
                    style={{
                        backgroundColor: "var(--color-control-bg)",
                        borderColor: "var(--color-control-border)",
                        color: "var(--color-text-main)",
                    }}
                    placeholder="이메일(아이디)로 검색..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <p className="text-[10px]" style={{color: "var(--color-text-muted)"}}>
                    친구의 로그인 이메일을 입력해 검색할 수 있어요.
                </p>
            </div>

            {!keyword ? (
                <p className="text-[11px] text-slate-400">
                    이메일을 입력하면 검색 결과가 보여요.
                </p>
            ) : !profiles || profiles.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                    일치하는 사용자가 없어요.
                </p>
            ) : (
                <ul className="space-y-1">
                    {profiles.map((p) => {
                        const isSelf = p.id === userId;
                        const isFriend = friends?.some((f) => f.friend_id === p.id);

                        // 표시 이름: 닉네임 > 이메일
                        const displayName = p.nickname || p.email;

                        return (
                            <li
                                key={p.id}
                                className="ui-list-item"
                            >
                                <div className="flex flex-col">
      <span
          className="text-[11px] font-medium"
          style={{ color: "var(--color-text-main)" }}
      >
        {displayName}
      </span>

                                    {p.nickname && (
                                        <span
                                            className="text-[10px]"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
          {p.email}
        </span>
                                    )}
                                </div>

                                {/* 🔹 버튼 영역 */}
                                {isSelf ? (
                                    <Button
                                        type="button"
                                        size="xs"
                                        disabled
                                        className="ui-badge-fixed px-[7pt] py-[1pt] text-[9px] cursor-default disabled:opacity-100 shadow-none"
                                    >
                                        내 계정
                                    </Button>
                                ) : isFriend ? (
                                    <Button
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        disabled
                                        className="ui-badge-fixed px-[7pt] py-[1pt] text-[9px] cursor-default disabled:opacity-100 shadow-none"
                                    >
                                        친구
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="xs"
                                        className="ui-badge-fixed px-[7pt] py-[1pt] text-[9px]"
                                        onClick={() => onSendRequest(p.id)}
                                    >
                                        친구 요청
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
