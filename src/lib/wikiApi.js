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
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
}

// 문서 생성
export async function createDocument({ userId, categoryId, title }) {
    const slug = generateDocumentSlug(title);

    const { data, error } = await supabase
        .from('documents')
        .insert({
            user_id: userId,
            category_id: categoryId,
            title,
            slug,
            content_markdown: '',
            visibility: 'private',
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// slug로 문서 조회
export async function fetchDocumentBySlug({ userId, slug }) {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .eq('slug', slug)
        .single();

    if (error) throw error;
    return data;
}

// 문서 내용/제목 수정
export async function updateDocument({ userId, documentId, title, contentMarkdown }) {
    const { data, error } = await supabase
        .from('documents')
        .update({
            title,
            content_markdown: contentMarkdown,
            updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// 전체 문서 (현재 유저의 모든 문서) 가져오기
export async function fetchAllDocuments(userId) {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
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
      documents:document_id (
        id,
        title,
        slug
      )
    `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
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
      documents:document_id (
        id,
        title,
        slug
      )
    `
        )
        .eq('user_id', userId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
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
        slug
      )
    `
        )
        .eq('user_id', userId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false }); // 최신이 위로

    if (error) throw error;
    return data;
}

export async function fetchMonthlyActivity(userId, year, month) {
    if (!userId || !year || !month) return [];

    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');

    const start = `${yyyy}-${mm}-01 00:00:00`;
    // 다음 달 1일 00:00:00 기준으로 조회 범위 끝내기
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
        slug
      )
    `
        )
        .eq('user_id', userId)
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// ─────────────────────────────
// 친구 기능
// ─────────────────────────────

// 친구 목록 (status = accepted, 내가 보낸 기준)
export async function fetchFriends(userId) {
    const { data, error } = await supabase
        .from('friends')
        .select('id, friend_id, created_at, status')
        .eq('user_id', userId)
        .eq('status', 'accepted');

    if (error) throw error;
    return data;
}

// 내가 받은 친구 요청 (status = pending)
export async function fetchIncomingFriendRequests(userId) {
    const { data, error } = await supabase
        .from('friends')
        .select('id, user_id, created_at, status')
        .eq('friend_id', userId)
        .eq('status', 'pending');

    if (error) throw error;
    return data;
}

// 친구 요청 보내기
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
    const { data, error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// 친구 요청 거절 / 삭제
export async function deleteFriendRelation(id) {
    const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', id);

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
    // 1) 친구 목록
    const friends = await fetchFriends(userId);
    const friendIds = friends.map((f) => f.friend_id);

    // 친구가 아직 없으면 내 문서 + public 만
    const friendIdList = friendIds.length ? friendIds.join(',') : null;

    let orConditions = [`user_id.eq.${userId}`, 'visibility.eq.public'];

    if (friendIdList) {
        orConditions.push(
            `and(user_id.in.(${friendIdList}),visibility.eq.friends)`,
        );
    }

    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .or(orConditions.join(','))
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
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
