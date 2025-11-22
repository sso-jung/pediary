// src/lib/wikiApi.js
import { supabase } from './supabaseClient';

// ─────────────────────────────
// 카테고리
// ─────────────────────────────
export async function fetchCategories(userId) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('parent_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
}

export async function createCategory({ userId, name, parentId = null }) {
    const { data, error } = await supabase
        .from('categories')
        .insert({
            user_id: userId,
            name,
            parent_id: parentId,
            sort_order: 0,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// ─────────────────────────────
// 문서
// ─────────────────────────────

// 간단한 slug 생성 함수 (유일성 보장을 위해 timestamp를 섞음)
function slugify(title) {
    return title
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '') // 문자/숫자/공백/하이픈만
        .replace(/\s+/g, '-')              // 공백 → -
        .replace(/-+/g, '-');              // 연속 - 정리
}

export function generateDocumentSlug(title) {
    const base = slugify(title) || 'doc';
    const ts = Date.now().toString(36); // 간단한 유니크 suffix
    return `${base}-${ts}`;
}

// 특정 카테고리의 문서 목록
export async function fetchDocumentsByCategory({ userId, categoryId }) {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
}

// 문서 생성
export async function createDocument({ userId, categoryId, title, visibility = 'private' }) {
    const slug = generateDocumentSlug(title);

    const { data, error } = await supabase
        .from('documents')
        .insert({
            user_id: userId,
            category_id: categoryId,
            title,
            slug,
            content_markdown: '',
            visibility,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// slug로 문서 조회
export async function fetchDocumentBySlug({ userId, slug }) {
    // 1) 슬러그로 문서 하나를 찾고
    const { data: doc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();

    if (error) throw error;
    if (!doc) return null;

    // 2) 내가 작성자면 무조건 OK
    if (doc.user_id === userId) {
        return doc;
    }

    // 3) public 이면 (나중을 위해 대비) OK
    if (doc.visibility === 'public') {
        return doc;
    }

    // 4) friends 공개인 경우 → 친구 관계 확인
    if (doc.visibility === 'friends') {
        const { data: rel, error: relError } = await supabase
            .from('friends')
            .select('id')
            .eq('user_id', userId)
            .eq('friend_id', doc.user_id)
            .eq('status', 'accepted')
            .maybeSingle();

        if (relError) throw relError;

        if (rel) {
            return doc; // 친구면 OK
        }

        // 친구 아니면 볼 수 없음
        return null;
    }

    // 5) 그 외(나만보기, 기타) → 작성자가 아니면 접근 불가
    return null;
}

// 문서 내용/제목 수정
export async function updateDocument({ userId, documentId, title, contentMarkdown, visibility }) {
    const payload = {
        title,
        content_markdown: contentMarkdown,
        updated_at: new Date().toISOString(),
    };

    // visibility를 함께 전달받으면 항상 업데이트
    if (visibility) {
        payload.visibility = visibility; // 'private' / 'friends'
    }

    const { data, error } = await supabase
        .from('documents')
        .update(payload)
        .eq('id', documentId)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// 전체 문서 (현재 유저의 모든 문서) 가져오기
export async function fetchAllDocuments(userId) {
    if (!userId) return [];

    // 1) 내 문서 전체
    const myDocs = await fetchMyDocuments(userId); // 이미 아래쪽에 정의돼 있음

    // 2) 내가 볼 수 있는 문서들 (내 것 + 친구공개 + public)
    const visibleDocs = await fetchVisibleDocuments(userId);

    // 3) 두 배열을 합치되, 같은 문서(id 기준)는 한 번만
    const map = new Map();
    [...myDocs, ...visibleDocs].forEach((doc) => {
        if (doc && doc.id != null) {
            map.set(doc.id, doc);
        }
    });

    return Array.from(map.values());
}

// ─────────────────────────────
// 문서 활동 로그
// ─────────────────────────────

// 활동 기록 (created / updated / viewed)
export async function logDocumentActivity({ userId, documentId, action }) {
    try {
        const { error } = await supabase.from('document_activity').insert({
            user_id: userId,
            document_id: documentId,
            action,
        });

        if (error) {
            console.error('logDocumentActivity error', error);
        }
    } catch (e) {
        console.error('logDocumentActivity exception', e);
    }
    // 실패해도 본 기능은 막지 않기 위해 throw 하지 않음
}

// 최근 활동 목록 가져오기
export async function fetchRecentActivity({ userId, limit = 20 }) {
    const { data, error } = await supabase
        .from('document_activity')
        .select(
            `
              id,
              action,
              created_at,
              document_id,
              documents:document_id (
                id,
                title,
                slug,
                deleted_at
              )
            `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;

    return (data ?? []).filter((row) => !row.documents?.deleted_at);
}

// 특정 날짜의 활동 조회
export async function fetchDailyActivity(userId, dateStr) {
    if (!dateStr) return [];

    const start = `${dateStr} 00:00:00`;
    const end = `${dateStr} 23:59:59`;

    const { data, error } = await supabase
        .from('document_activity')
        .select(
            `
      id,
      action,
      created_at,
      document_id,
      documents:document_id (
        id,
        title,
        slug,
        deleted_at
      )
    `
        )
        .eq('user_id', userId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).filter((row) => !row.documents?.deleted_at);
}
// 오늘 기준 활동만 가져오기
export async function fetchTodayActivity(userId) {
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const start = `${yyyy}-${mm}-${dd} 00:00:00`;
    const end = `${yyyy}-${mm}-${dd} 23:59:59`;

    const { data, error } = await supabase
        .from('document_activity')
        .select(
            `
      id,
      action,
      created_at,
      document_id,
      documents:document_id (
        id,
        title,
        slug,
        deleted_at
      )
    `
        )
        .eq('user_id', userId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // 🔹 documents.deleted_at 이 있는(soft delete 된) 문서는 걸러냄
    return (data ?? []).filter((row) => !row.documents?.deleted_at);
}

export async function fetchMonthlyActivity(userId, year, month) {
    if (!userId || !year || !month) return [];

    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');

    const start = `${yyyy}-${mm}-01 00:00:00`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextYyyy = String(nextYear);
    const nextMm = String(nextMonth).padStart(2, '0');
    const end = `${nextYyyy}-${nextMm}-01 00:00:00`;

    const { data, error } = await supabase
        .from('document_activity')
        .select(
            `
      id,
      action,
      created_at,
      document_id,
      documents:document_id (
        id,
        title,
        slug,
        deleted_at
      )
    `
        )
        .eq('user_id', userId)
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).filter((row) => !row.documents?.deleted_at);
}

// ─────────────────────────────
// 친구 기능
// ─────────────────────────────

// 친구 목록 (status = accepted, 내가 보낸 기준)
export async function fetchFriends(userId) {
    // 1) 우선 friends row들 가져오기
    const { data: rows, error } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, created_at, status')
        .eq('user_id', userId)
        .eq('status', 'accepted');

    if (error) throw error;

    const friends = rows ?? [];
    if (friends.length === 0) return [];

    // 2) friend_id 목록으로 profiles 조회
    const friendIds = [...new Set(friends.map((f) => f.friend_id))];

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', friendIds);

    if (profileError) throw profileError;

    const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
    );

    // 3) friends row에 friend_profile 붙여서 리턴
    return friends.map((f) => ({
        ...f,
        friend_profile: profileMap.get(f.friend_id) || null,
    }));
}

// ✅ 내가 받은 친구 요청 (상대 프로필까지 join)
export async function fetchIncomingFriendRequests(userId) {
    // 1) friends 테이블에서 pending 요청 가져오기
    const { data: rows, error } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status, created_at')
        .eq('friend_id', userId)
        .eq('status', 'pending');

    if (error) throw error;
    const requests = rows ?? [];
    if (requests.length === 0) return [];

    // 2) 요청 보낸 사람들의 user_id 목록으로 profiles 조회
    const requesterIds = [...new Set(requests.map((r) => r.user_id))];

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', requesterIds);

    if (profileError) throw profileError;

    const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
    );

    // 3) friends row에 requester_profile 붙여서 리턴
    return requests.map((r) => ({
        ...r,
        requester_profile: profileMap.get(r.user_id) || null,
    }));
}

// 내가 보낸 친구 요청 (status = pending, + 상대 프로필)
export async function fetchOutgoingFriendRequests(userId) {
    // 1) friends 테이블에서 내가 보낸 pending 요청
    const { data: rows, error } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending');

    if (error) throw error;
    const requests = rows ?? [];
    if (requests.length === 0) return [];

    // 2) friend_id 들로 profiles 조회
    const friendIds = [...new Set(requests.map((r) => r.friend_id))];

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', friendIds);

    if (profileError) throw profileError;

    const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
    );

    // 3) friends row에 friend_profile 붙여서 리턴
    return requests.map((r) => ({
        ...r,
        friend_profile: profileMap.get(r.friend_id) || null,
    }));
}

// 친구 요청 보내기 (이건 지금 안 써도 됨. 참고용)
export async function sendFriendRequest({ userId, friendId }) {
    const { data, error } = await supabase
        .from('friends')
        .insert({
            user_id: userId,
            friend_id: friendId,
            status: 'pending',
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// 친구 요청 수락
export async function acceptFriendRequest(requestId) {
    // 1) 먼저 해당 요청 row를 accepted 로 바꾸면서 user_id / friend_id 가져오기
    const { data, error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId)
        .select('id, user_id, friend_id, status')
        .single();

    if (error) throw error;

    const { user_id, friend_id } = data;

    // 2) 역방향(B -> A) row도 accepted 로 upsert
    //    (이미 있으면 그대로 두고, 없으면 새로 생성)
    const { error: upsertError } = await supabase
        .from('friends')
        .upsert(
            {
                user_id: friend_id,   // 수락한 사람
                friend_id: user_id,   // 원래 신청한 사람
                status: 'accepted',
            },
            {
                onConflict: 'user_id,friend_id',
            },
        );

    if (upsertError) throw upsertError;

    return data;
}

// 친구 요청 거절 / 삭제
export async function deleteFriendRelation(id) {
    // 1) 우선 기준이 되는 row의 user_id / friend_id를 조회
    const { data, error: fetchError } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .eq('id', id)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!data) return; // 이미 지워졌다면 조용히 종료

    const { user_id, friend_id } = data;

    // 2) 양방향 모두 삭제:
    //    (user_id, friend_id) 와 (friend_id, user_id)
    const { error } = await supabase
        .from('friends')
        .delete()
        .or(
            `and(user_id.eq.${user_id},friend_id.eq.${friend_id}),` +
            `and(user_id.eq.${friend_id},friend_id.eq.${user_id})`,
        );

    if (error) throw error;
}

// 프로필 검색 (닉네임/이메일에 keyword 포함)
export async function searchProfiles(keyword) {
    const value = (keyword || '').trim();
    if (!value) return [];

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        // 🔹 email === value OR nickname === value
        .or(`email.eq.${value},nickname.eq.${value}`);

    if (error) throw error;
    return data;
}

// 내가 볼 수 있는 문서 (내 문서 + 친구공개 + 전체공개)
export async function fetchVisibleDocuments(userId) {
    // 1) 내 친구 목록
    const friends = await fetchFriends(userId);
    const friendIds = friends.map((f) => f.friend_id);
    const friendIdList = friendIds.length ? friendIds.join(',') : null;

    let orConditions = [`user_id.eq.${userId}`];
    orConditions.push('visibility.eq.public');

    if (friendIdList) {
        orConditions.push(
            `and(user_id.in.(${friendIdList}),visibility.eq.friends)`,
        );
    }

    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .or(orConditions.join(','))
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function fetchMyProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
}

export async function updateMyProfile(userId, { nickname }) {
    const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, nickname })
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

// 내가 작성한 전체 문서 (카테고리 무관)
export async function fetchMyDocuments(userId) {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

// 내가 볼 수 있는 카테고리 (내 것 + 친구 것)
export async function fetchVisibleCategories(userId) {
    // 1) 내 카테고리 (문서 없어도 항상 보이게)
    const { data: myCats, error: myError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('parent_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (myError) throw myError;
    const myCategories = myCats ?? [];

    // 2) 내 친구들
    const friends = await fetchFriends(userId); // 이미 위쪽에 정의돼 있음
    const friendIds = friends.map((f) => f.friend_id);

    if (friendIds.length === 0) {
        // 친구가 없으면 내 카테고리만
        return myCategories;
    }

    // 3) 내가 볼 수 있는 모든 문서 (내 것 + 친구공개)
    const visibleDocs = await fetchVisibleDocuments(userId);

    // 4) 그 중에서 "친구의 문서"에 해당하는 category_id만 추출
    const friendCategoryIdSet = new Set(
        visibleDocs
            .filter((doc) => doc.user_id !== userId && doc.category_id != null)
            .map((doc) => doc.category_id),
    );

    const friendCategoryIds = Array.from(friendCategoryIdSet);
    if (friendCategoryIds.length === 0) {
        // 공유받은 문서는 있지만 category_id가 없거나,
        // 혹은 아직 친구 카테고리에 문서가 없는 경우 → 내 카테고리만
        return myCategories;
    }

    // 5) "공유 문서가 실제로 존재하는 카테고리"만 조회
    const { data: friendCats, error: friendCatError } = await supabase
        .from('categories')
        .select('*')
        .in('id', friendCategoryIds)
        .order('parent_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (friendCatError) throw friendCatError;

    const friendCategories = friendCats ?? [];

    // 6) 내 카테고리 + 친구 카테고리 합쳐서 리턴
    return [...myCategories, ...friendCategories];
}

export async function fetchVisibleDocumentsByCategory({ userId, categoryId }) {
    const all = await fetchVisibleDocuments(userId); // 내 + 친구공개

    // categoryId가 null/undefined/'' 이면 전체 문서 리턴 (전체 카테고리 용도)
    if (categoryId == null || categoryId === '') {
        return all;
    }

    const targetId = Number(categoryId);
    if (Number.isNaN(targetId)) {
        // 숫자로 변환이 안 되면 그냥 빈 배열
        return [];
    }

    return all.filter((doc) => Number(doc.category_id) === targetId);
}

export async function softDeleteDocument({ documentId, userId }) {
    const { error } = await supabase
        .from('documents')
        .update({
            deleted_at: new Date().toISOString(),
            deleted_by: userId ?? null,
        })
        .eq('id', documentId);

    if (error) {
        console.error('softDeleteDocument error', error);
        throw error;
    }
}

// 🔹 문서 완전 삭제 (hard delete)
export async function hardDeleteDocument({ documentId, userId }) {
    let query = supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

    // 안전하게: 내 문서만 지우게
    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
        console.error('hardDeleteDocument error', error);
        throw error;
    }
}

// 🔹 문서 복구 (deleted_at, deleted_by NULL)
export async function restoreDocument({ documentId, userId }) {
    let query = supabase
        .from('documents')
        .update({
            deleted_at: null,
            deleted_by: null,
        })
        .eq('id', documentId);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query.select('*').single();

    if (error) {
        console.error('restoreDocument error', error);
        throw error;
    }
    return data;
}

// 🔹 휴지통: soft delete 된 문서 목록
export async function fetchDeletedDocuments(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('documents')
        .select(
            `
      id,
      user_id,
      category_id,
      title,
      slug,
      visibility,
      created_at,
      updated_at,
      deleted_at
    `
        )
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
}