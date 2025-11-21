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
            <div className="flex h-full items-center justify-center text-[11px] text-slate-400">
                로그인 후 이용해 주세요.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col text-xs">
            {/* 상단 바 */}
            <div className="border-b border-slate-100 px-3 pt-3 pb-1">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                        친구
                    </span>
                </div>

                {/* 상단 탭 (친구 목록 / 받은 요청 / 친구 찾기) */}
                <div className="mt-2 inline-flex rounded-full bg-slate-100 p-1 text-[11px]">
                    <button
                        type="button"
                        onClick={() => setTab('friends')}
                        className={
                            'rounded-full px-3 py-1 ' +
                            (tab === 'friends'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700')
                        }
                    >
                        친구 목록
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('requests')}
                        className={
                            'rounded-full px-3 py-1 ' +
                            (tab === 'requests'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700')
                        }
                    >
                        받은 요청
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('sent')}
                        className={
                            'rounded-full px-3 py-1 ' +
                            (tab === 'sent'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700')
                        }
                    >
                        보낸 요청
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('search')}
                        className={
                            'rounded-full px-3 py-1 ' +
                            (tab === 'search'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700')
                        }
                    >
                        친구 찾기
                    </button>
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
                        onSendRequest={(friendId) =>
                            sendReq.mutate({ friendId })
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

function FriendsList({ friends = [], onDelete }) {
    if (!friends.length) {
        return (
            <p className="text-[11px] text-slate-400">
                아직 친구가 없어요. <br />
                &quot;친구 찾기&quot; 탭에서 친구를 추가해 보세요.
            </p>
        );
    }

    return (
        <ul className="space-y-1">
            {friends.map((f) => (
                <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5"
                >
                    <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-slate-800">
                            친구 ID: {f.friend_id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                            {new Date(f.created_at).toLocaleDateString(
                                'ko-KR',
                            )}{' '}
                            친구가 되었어요.
                        </span>
                    </div>
                    <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => onDelete(f.id)}
                    >
                        삭제
                    </Button>
                </li>
            ))}
        </ul>
    );
}

function SentRequests({ outgoing = [], onCancel }) {
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
                            className="px-2 py-[2px] text-[10px]"
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
                                className="px-2 py-[2px] text-[10px]"
                                onClick={() => onAccept(r.id)}
                            >
                                수락
                            </Button>
                            <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                className="px-2 py-[2px] text-[10px]"
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
                          onSendRequest,
                      }) {
    return (
        <div className="space-y-2">
            <div className="space-y-1">
                <input
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                    placeholder="이메일(아이디)로 검색..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">
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
                    {profiles.map((p) => (
                        <li
                            key={p.id}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5"
                        >
                            <div className="flex flex-col">
                                {/* 닉네임이 있으면 닉네임, 없으면 이메일을 메인으로 */}
                                <span className="text-[11px] font-medium text-slate-800">
                                    {p.nickname || p.email}
                                </span>
                                {p.nickname && (
                                    <span className="text-[10px] text-slate-400">
                                        {p.email}
                                    </span>
                                )}
                            </div>
                            <Button
                                type="button"
                                size="xs"
                                className="px-[7px] py-[3px] text-[9pt]"
                                disabled={p.id === userId}
                                onClick={() => onSendRequest(p.id)}
                            >
                                친구 요청
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
