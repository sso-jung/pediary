// src/lib/wikiApi.js
import { supabase } from './supabaseClient';
import {buildSectionNumberMapping} from "./sectionDiff.js";

// ─────────────────────────────
// 카테고리
// ─────────────────────────────
export async function fetchCategories(userId) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('parent_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
}

export async function createCategory({ userId, name, parentId = null }) {
    const targetParentId = parentId ?? null;

    let orderQuery = supabase
        .from('categories')
        .select('sort_order')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1);

    if (targetParentId == null) {
        orderQuery = orderQuery.is('parent_id', null);
    } else {
        orderQuery = orderQuery.eq('parent_id', targetParentId);
    }

    const { data: lastRows, error: orderError } = await orderQuery;
    if (orderError) throw orderError;

    const nextSortOrder = (lastRows?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('categories')
        .insert({
            user_id: userId,
            name,
            parent_id: targetParentId,
            sort_order: nextSortOrder,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

/** 🔹 카테고리 이름 변경 */
export async function updateCategoryName({ userId, categoryId, name }) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
        throw new Error('카테고리 이름을 입력해 줘.');
    }

    const { data, error } = await supabase
        .from('categories')
        .update({ name: trimmed })
        .eq('id', categoryId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// 🔹 카테고리 depth + sort_order 변경
export async function moveCategory({
                                       userId,
                                       categoryId,
                                       parentId,
                                       beforeCategoryId = null,
                                   }) {
    const targetParentId = parentId ?? null;

    // 1) parent_id 먼저 수정 (⚠ updated_at 없음)
    const { error: parentError } = await supabase
        .from('categories')
        .update({
            parent_id: targetParentId,
        })
        .eq('id', categoryId)
        .eq('user_id', userId);

    if (parentError) {
        console.error('moveCategory - parent update error', parentError);
        throw parentError;
    }

    // 2) 동일 parent 아래 형제들 조회 (본인 포함)
    let siblingQuery = supabase
        .from('categories')
        .select('id, parent_id, sort_order, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null);

    if (targetParentId == null) {
        siblingQuery = siblingQuery.is('parent_id', null);
    } else {
        siblingQuery = siblingQuery.eq('parent_id', targetParentId);
    }

    const { data: siblings, error: siblingsError } = await siblingQuery
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (siblingsError) {
        console.error('moveCategory - siblings fetch error', siblingsError);
        throw siblingsError;
    }
    if (!siblings || siblings.length === 0) return;

    // 3) 새 sort_order 순서 배열 만들기
    const orderedIds = siblings
        .map((s) => s.id)
        .filter((id) => id !== categoryId);

    let insertIndex;
    if (beforeCategoryId && orderedIds.includes(beforeCategoryId)) {
        insertIndex = orderedIds.indexOf(beforeCategoryId);
    } else {
        // beforeCategoryId 없으면 맨 뒤
        insertIndex = orderedIds.length;
    }
    orderedIds.splice(insertIndex, 0, categoryId);

    // 4) 각 카테고리에 sort_order 재할당 (⚠ updated_at 없음)
    for (let i = 0; i < orderedIds.length; i += 1) {
        const id = orderedIds[i];
        const { error: orderError } = await supabase
            .from('categories')
            .update({
                sort_order: i,
            })
            .eq('id', id)
            .eq('user_id', userId);

        if (orderError) {
            console.error('moveCategory - sort_order update error', orderError);
            throw orderError;
        }
    }
}


// 🔹 카테고리 soft delete + 하위 카테고리 & 그 안의 문서들까지 휴지통으로
export async function softDeleteCategoryAndDocuments({ userId, categoryId }) {
    const now = new Date().toISOString();

    // 0) categoryId가 이상하면 그냥 종료
    if (!categoryId) return;

    // 1) 현재 유저의 살아있는 카테고리 전체 조회 (id, parent_id 만으로 트리 구성)
    const { data: cats, error: catsError } = await supabase
        .from('categories')
        .select('id, parent_id')
        .eq('user_id', userId)
        .is('deleted_at', null);

    if (catsError) {
        console.error('softDeleteCategoryAndDocuments - fetch categories error', catsError);
        throw catsError;
    }

    // 2) parent_id -> [childId, ...] 맵 만들기
    const childrenMap = new Map();
    for (const c of cats || []) {
        const key = c.parent_id; // null 도 key 로 사용
        if (!childrenMap.has(key)) {
            childrenMap.set(key, []);
        }
        childrenMap.get(key).push(c.id);
    }

    // 3) BFS/DFS 로 categoryId 포함 모든 하위 카테고리 id 수집
    const targetIds = [];
    const queue = [categoryId];

    while (queue.length > 0) {
        const current = queue.shift();
        if (targetIds.includes(current)) continue; // 중복 방지

        targetIds.push(current);

        const children = childrenMap.get(current) || [];
        queue.push(...children);
    }

    if (targetIds.length === 0) {
        // 이 카테고리가 이미 삭제됐거나 없는 경우
        return;
    }

    // 4) 해당 카테고리들 soft delete
    const { error: catError } = await supabase
        .from('categories')
        .update({ deleted_at: now })
        .eq('user_id', userId)
        .in('id', targetIds);

    if (catError) {
        console.error('softDeleteCategoryAndDocuments - category update error', catError);
        throw catError;
    }

    // 5) 그 카테고리들에 속한 내 문서들도 soft delete (이미 휴지통인 건 건들지 않음)
    const { error: docError } = await supabase
        .from('documents')
        .update({
            deleted_at: now,
            deleted_by: userId,
        })
        .eq('user_id', userId)
        .in('category_id', targetIds)
        .is('deleted_at', null);

    if (docError) {
        console.error('softDeleteCategoryAndDocuments - documents update error', docError);
        throw docError;
    }
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
export async function updateDocument({
    userId,
    documentId,
    title,
    contentMarkdown,
    visibility,
    categoryId,   // 🔹 추가
}) {
    const payload = {
        title,
        content_markdown: contentMarkdown,
        updated_at: new Date().toISOString(),
    };

    if (visibility) {
        payload.visibility = visibility; // 'private' / 'friends'
    }

    // 🔹 categoryId 도 같이 업데이트 (undefined면 건드리지 않음)
    if (categoryId !== undefined) {
        payload.category_id = categoryId;
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

// 🔹 문서 복구 (카테고리가 삭제된 경우 처리 포함)
export async function restoreDocumentWithCategoryHandling({ documentId, userId }) {
    // 0) 문서 조회 (soft delete 포함)
    const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

    if (docError) throw docError;
    if (!doc) throw new Error('문서를 찾을 수 없어.');

    if (doc.user_id !== userId) {
        throw new Error('내 문서만 복구할 수 있어.');
    }

    // 카테고리가 없으면 그냥 복구만
    if (!doc.category_id) {
        const { data: restored, error: restoreError } = await supabase
            .from('documents')
            .update({
                deleted_at: null,
                deleted_by: null,
            })
            .eq('id', documentId)
            .eq('user_id', userId)
            .select('*')
            .single();

        if (restoreError) throw restoreError;
        return restored;
    }

    const categoryId = doc.category_id;

    // 1) 현재 카테고리 상태 조회 (삭제 여부 포함)
    const { data: category, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .eq('user_id', userId)
        .maybeSingle();

    if (catError) throw catError;

    let targetCategoryId = categoryId;

    // 1-1) 카테고리가 존재하고 삭제되지 않았다면 → 그대로 사용
    if (category && !category.deleted_at) {
        // 아무 처리 필요 없음
    } else if (category && category.deleted_at) {
        // 1-2) 카테고리가 soft delete 된 경우
        const categoryName = category.name;

        // 동일한 이름의 살아있는 카테고리가 있는지 먼저 확인
        const { data: sameNameActive, error: sameNameError } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', userId)
            .eq('name', categoryName)
            .is('deleted_at', null)
            .maybeSingle();

        if (sameNameError) throw sameNameError;

        if (sameNameActive) {
            targetCategoryId = sameNameActive.id;
        } else {
            // 없으면 새 카테고리 생성
            const { data: newCategory, error: newCatError } = await supabase
                .from('categories')
                .insert({
                    user_id: userId,
                    name: categoryName,
                    parent_id: category.parent_id ?? null,
                    sort_order: category.sort_order ?? 0,
                })
                .select('*')
                .single();

            if (newCatError) throw newCatError;
            targetCategoryId = newCategory.id;
        }
    } else {
        // category row 자체가 아예 없는 경우는
        // 위에서 soft delete 로만 지우기로 했으니 이 케이스는 안 생기는 게 정상.
        // 혹시 모를 경우 대비: 카테고리를 null 로 두고 복구.
        targetCategoryId = null;
    }

    // 2) 문서 복구 + 카테고리 id 업데이트
    const { data: restored, error: restoreError } = await supabase
        .from('documents')
        .update({
            category_id: targetCategoryId,
            deleted_at: null,
            deleted_by: null,
        })
        .eq('id', documentId)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (restoreError) throw restoreError;
    return restored;
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
    if (!userId || !dateStr) return [];

    const [yyyy, mm, dd] = dateStr.split('-').map(Number);

    // 🔹 로컬 기준 해당 날짜 00:00 ~ 다음날 00:00
    const start = new Date(yyyy, mm - 1, dd);
    const end = new Date(yyyy, mm - 1, dd + 1);

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
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).filter((row) => !row.documents?.deleted_at);
}

// 오늘 기준 활동만 가져오기
export async function fetchTodayActivity(userId) {
    if (!userId) return [];

    const now = new Date();

    // 🔹 로컬 타임존 기준 "오늘 00:00" ~ "내일 00:00"
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

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
        content_markdown,
        category_id,
        updated_at,
        deleted_at,
        category:category_id (
          id,
          name
        )
      )
    `
        )
        .eq('user_id', userId)
        // 🔹 UTC ISO 문자열로 비교 (created_at 이 timestamptz 라는 가정)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())   // 내일 00:00 "미만"
        .order('created_at', { ascending: false });

    if (error) throw error;

    // soft delete 문서 제거
    return (data ?? []).filter((row) => !row.documents?.deleted_at);
}

export async function fetchMonthlyActiveDays(userId, year, month) {
    if (!userId || !year || !month) return 0;

    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const startKstUtc = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS);
    const endKstUtc = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS);

    const { data, error } = await supabase.rpc('get_monthly_active_days', {
        p_user_id: userId,
        p_start: startKstUtc.toISOString(),
        p_end: endKstUtc.toISOString(),
    });

    if (error) throw error;

    return data ?? 0; // data는 int
}

export async function fetchMonthlyActivity(userId, year, month) {
    if (!userId || !year || !month) return [];

    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const startKstUtc = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS);
    const endKstUtc   = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS);

    const pageSize = 500;
    let from = 0;
    let all = [];

    while (true) {
        const { data, error } = await supabase
            .from('document_activity')
            .select(`
        id,
        action,
        created_at,
        document_id,
        documents:document_id (
          id,
          title,
          slug
        )
      `)
            .eq('user_id', userId)
            .gte('created_at', startKstUtc.toISOString())
            .lt('created_at', endKstUtc.toISOString())
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) throw error;

        const chunk = data ?? [];
        all = all.concat(chunk);

        if (chunk.length < pageSize) break;
        from += pageSize;
    }

    return all;
}

export async function fetchHolidaysByYear(year) {
    if (!year) return [];

    const start = `${year}-01-01`;
    const end = `${year + 1}-01-01`;

    const { data, error } = await supabase
        .from('holidays')
        .select('holiday_date, name, is_holiday')
        .eq('is_holiday', true)
        .gte('holiday_date', start)
        .lt('holiday_date', end)
        .order('holiday_date', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function syncHolidaysByYear(year) {
    const { data, error } = await supabase.functions.invoke(
        'sync-holidays',
        { body: { year } },
    );

    if (error) throw error;
    return data;
}

export async function fetchDiaryByDate({ userId, diaryDate }) {
    if (!userId || !diaryDate) return null;

    const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('user_id', userId)
        .eq('diary_date', diaryDate)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function fetchDiariesByDateRange({ userId, startDate, endDate }) {
    if (!userId || !startDate || !endDate) return [];

    const { data, error } = await supabase
        .from('diaries')
        .select(`
            *,
            diary_property_values (
                value,
                diary_properties (
                    type,
                    section_id,
                    sort_order
                )
            )
        `)
        .eq('user_id', userId)
        .gte('diary_date', startDate)
        .lt('diary_date', endDate)
        .order('diary_date', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function fetchDiaryProperties(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('diary_properties')
        .select('*')
        .eq('user_id', userId)
        .order('section_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function createDiaryProperty({
    userId,
    name,
    type,
    icon,
    sectionId = null,
    config = {},
    defaultValue = null,
}) {
    const trimmed = (name || '').trim();
    if (!userId || !trimmed || !type) {
        throw new Error('속성 정보를 확인할 수 없어.');
    }

    let sortQuery = supabase
        .from('diary_properties')
        .select('sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: false })
        .limit(1);

    sortQuery = sectionId == null
        ? sortQuery.is('section_id', null)
        : sortQuery.eq('section_id', sectionId);

    const { data: lastRows, error: sortError } = await sortQuery;

    if (sortError) throw sortError;

    const nextSortOrder = (lastRows?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('diary_properties')
        .insert({
            user_id: userId,
            name: trimmed,
            type,
            icon: (icon || '').trim() || null,
            section_id: sectionId,
            sort_order: nextSortOrder,
            config,
            default_value: defaultValue,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function updateDiaryProperty({
    userId,
    propertyId,
    name,
    type,
    icon,
    sectionId,
}) {
    const trimmed = (name || '').trim();
    if (!userId || !propertyId || !trimmed || !type) {
        throw new Error('속성 정보를 확인할 수 없어.');
    }

    const updatePayload = {
        name: trimmed,
        type,
        icon: (icon || '').trim() || null,
        updated_at: new Date().toISOString(),
    };

    if (sectionId !== undefined) {
        updatePayload.section_id = sectionId;
    }

    const { data, error } = await supabase
        .from('diary_properties')
        .update(updatePayload)
        .eq('id', propertyId)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function fetchDiaryPropertySections(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('diary_property_sections')
        .select('*')
        .eq('user_id', userId)
        .order('parent_section_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function createDiaryPropertySection({ userId, name, parentSectionId = null }) {
    const trimmed = (name || '').trim();
    if (!userId || !trimmed) {
        throw new Error('섹션 정보를 확인할 수 없어.');
    }

    let sortQuery = supabase
        .from('diary_property_sections')
        .select('sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: false })
        .limit(1);

    sortQuery = parentSectionId == null
        ? sortQuery.is('parent_section_id', null)
        : sortQuery.eq('parent_section_id', parentSectionId);

    const { data: lastRows, error: sortError } = await sortQuery;

    if (sortError) throw sortError;

    const nextSortOrder = (lastRows?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('diary_property_sections')
        .insert({
            user_id: userId,
            parent_section_id: parentSectionId,
            name: trimmed,
            sort_order: nextSortOrder,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function updateDiaryPropertySection({
    userId,
    sectionId,
    name,
    parentSectionId,
    collapsed,
}) {
    if (!userId || !sectionId) {
        throw new Error('섹션 정보를 확인할 수 없어.');
    }

    const updatePayload = {
        updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
        const trimmed = (name || '').trim();
        if (!trimmed) return null;
        updatePayload.name = trimmed;
    }

    if (parentSectionId !== undefined) {
        updatePayload.parent_section_id = parentSectionId;
    }

    if (collapsed !== undefined) {
        updatePayload.collapsed = collapsed;
    }

    const { data, error } = await supabase
        .from('diary_property_sections')
        .update(updatePayload)
        .eq('id', sectionId)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function deleteDiaryPropertySection({ userId, sectionId }) {
    if (!userId || !sectionId) return;

    const { error } = await supabase
        .from('diary_property_sections')
        .delete()
        .eq('id', sectionId)
        .eq('user_id', userId);

    if (error) throw error;
}

export async function updateDiaryPropertySectionOrder({ userId, sections }) {
    if (!userId || !Array.isArray(sections)) return [];

    const updates = sections.map((section) =>
        supabase
            .from('diary_property_sections')
            .update({
                parent_section_id: section.parentSectionId ?? null,
                sort_order: section.sortOrder ?? 0,
                updated_at: new Date().toISOString(),
            })
            .eq('id', section.sectionId)
            .eq('user_id', userId),
    );

    const results = await Promise.all(updates);
    const errorResult = results.find((result) => result.error);
    if (errorResult?.error) throw errorResult.error;

    return [];
}

export async function deleteDiaryProperty({ userId, propertyId }) {
    if (!userId || !propertyId) return;

    const { error } = await supabase
        .from('diary_properties')
        .delete()
        .eq('id', propertyId)
        .eq('user_id', userId);

    if (error) throw error;
}

export async function fetchDiaryLayout(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('diary_layouts')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function updateDiaryLayout({ userId, items }) {
    if (!userId || !Array.isArray(items)) return [];

    const rows = items.map((item, index) => ({
        user_id: userId,
        property_id: item.propertyId,
        sort_order: index,
        visibility: item.visibility || 'always',
        updated_at: new Date().toISOString(),
    }));

    if (rows.length === 0) return [];

    const { data, error } = await supabase
        .from('diary_layouts')
        .upsert(rows, {
            onConflict: 'user_id,property_id',
        })
        .select('*');

    if (error) throw error;

    const propertyUpdates = items
        .filter((item) => item.propertyId)
        .map((item, index) =>
            supabase
                .from('diary_properties')
                .update({
                    section_id: item.sectionId ?? null,
                    sort_order: index,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', item.propertyId)
                .eq('user_id', userId),
        );

    const propertyResults = await Promise.all(propertyUpdates);
    const propertyErrorResult = propertyResults.find((result) => result.error);
    if (propertyErrorResult?.error) throw propertyErrorResult.error;

    return data ?? [];
}

export async function fetchDiaryPropertyValues({ userId, diaryDate }) {
    if (!userId || !diaryDate) return [];

    const { data, error } = await supabase
        .from('diary_property_values')
        .select('*')
        .eq('user_id', userId)
        .eq('diary_date', diaryDate);

    if (error) throw error;
    return data ?? [];
}

export async function upsertDiary({ userId, diaryDate, title, contentMarkdown, propertyValues = [] }) {
    if (!userId || !diaryDate) {
        throw new Error('다이어리 날짜를 확인할 수 없어.');
    }

    const safeTitle = String(title ?? '').trim() || '다이어리';

    const { data, error } = await supabase
        .from('diaries')
        .upsert(
            {
                user_id: userId,
                diary_date: diaryDate,
                title: safeTitle,
                content_markdown: contentMarkdown || '',
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: 'user_id,diary_date',
            },
        )
        .select('*')
        .single();

    if (error) throw error;

    if (propertyValues.length > 0) {
        const rows = propertyValues.map((item) => ({
            user_id: userId,
            diary_date: diaryDate,
            property_id: item.propertyId,
            value: item.value,
            updated_at: new Date().toISOString(),
        }));

        const { error: valueError } = await supabase
            .from('diary_property_values')
            .upsert(rows, {
                onConflict: 'user_id,diary_date,property_id',
            });

        if (valueError) throw valueError;
    }

    return data;
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

export async function updateMyProfile(userId, { nickname, email, sectionNumberColor  }) {
    const payload = {
        id: userId,
        nickname,
    };

    // 새 row를 만들 때 NOT NULL 에 걸리지 않게 이메일도 넣어준다.
    if (email) {
        payload.email = email;
    }

    if (sectionNumberColor !== undefined) {
        payload.section_number_color = sectionNumberColor;
    }

    const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
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
        .is('deleted_at', null)
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

    // 5) "공유 문서가 실제로 존재하는 카테고리" 조회 (일단 직접 사용된 카테고리들)
    const { data: friendCats, error: friendCatError } = await supabase
        .from('categories')
        .select('*')
        .in('id', friendCategoryIds)
        .is('deleted_at', null)
        .order('parent_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (friendCatError) throw friendCatError;

    let friendCategories = friendCats ?? [];

    // 5-1) 위에서 가져온 카테고리들의 부모(1depth)도 함께 포함시키기
    //      (지금 구조가 1depth / 2depth 라서 부모 한 번만 올려도 충분)
    if (friendCategories.length > 0) {
        // 이미 friendCategoryIdSet 은 위에서 한 번 만든 상태
        const parentIds = Array.from(
            new Set(
                friendCategories
                    .map((c) => c.parent_id)
                    .filter(
                        (pid) =>
                            pid != null && !friendCategoryIdSet.has(pid),
                    ),
            ),
        );

        if (parentIds.length > 0) {
            const { data: parentCats, error: parentErr } = await supabase
                .from('categories')
                .select('*')
                .in('id', parentIds)
                .is('deleted_at', null)
                .order('parent_id', { ascending: true, nullsFirst: true })
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });

            if (parentErr) throw parentErr;

            // 부모를 앞에 붙여서 루트들이 먼저 오게
            friendCategories = [
                ...(parentCats ?? []),
                ...friendCategories,
            ];
        }
    }

    // 6) 내 카테고리 + 친구 카테고리 합쳐서 리턴
    return [...myCategories, ...friendCategories];
}

export async function fetchVisibleDocumentsByCategory({
                                                          userId,
                                                          categoryId,
                                                          includeChildren = false, // 🔹 추가 옵션
                                                      }) {
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

    // 기본은 자기 자신만
    let targetIds = [targetId];

    if (includeChildren) {
        // 🔹 parent_id = targetId 인 2depth 카테고리들 조회
        const { data: children, error } = await supabase
            .from('categories')
            .select('id')
            .eq('parent_id', targetId)
            .is('deleted_at', null);

        if (error) throw error;

        const childIds = (children || []).map((c) => c.id);
        targetIds = [...targetIds, ...childIds];
    }

    return all.filter(
        (doc) =>
            doc.category_id != null &&
            targetIds.includes(Number(doc.category_id)),
    );
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
      content_markdown,
      visibility,
      created_at,
      updated_at,
      deleted_at,
      category:category_id (
        id,
        name,
        deleted_at
      )
    `
        )
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

// 🔹 문서의 카테고리 변경
export async function updateDocumentCategory({ userId, documentId, categoryId }) {
    const { data, error } = await supabase
        .from('documents')
        .update({
            category_id: categoryId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

// 🔹 특정 문서의 섹션 번호가 바뀌었을 때,
//    그 문서를 doc:ID 로 참조하는 다른 문서들의 링크를 함께 수정한다.
export async function updateSectionLinksForDocument({
                                                        documentId,
                                                        oldMarkdown,
                                                        newMarkdown,
                                                    }) {
    // 1) 섹션 번호 변화 계산
    const mappings = buildSectionNumberMapping(oldMarkdown || '', newMarkdown || '');
    if (!mappings || mappings.length === 0) {
        return; // 번호 변화 없음
    }

    // 2) 이 문서를 참조하는 문서들 조회
    //    ([[doc:7#...]] / [[doc:7...]] 둘 다 있을 수 있으니,
    //    공통으로 들어가는 "doc:7" 만 LIKE 로 찾으면 충분
    const likePattern = `doc:${documentId}`;

    const { data: docs, error } = await supabase
        .from('documents')
        .select('id, content_markdown')
        .ilike('content_markdown', `%${likePattern}%`);

    if (error) throw error;
    if (!docs || docs.length === 0) return;

    const nowIso = new Date().toISOString();

    for (const d of docs) {
        let markdown = d.content_markdown || '';
        let updated = markdown;

        for (const { oldNumber, newNumber } of mappings) {
            // ─────────────────────────────
            // ① 이스케이프 안 된 형태
            //    [[doc:7#1.1|...]]
            //    [[doc:7#1.1]]
            // ─────────────────────────────
            const rawOld1 = `[[doc:${documentId}#${oldNumber}|`;
            const rawOld2 = `[[doc:${documentId}#${oldNumber}]]`;
            const rawNew1 = `[[doc:${documentId}#${newNumber}|`;
            const rawNew2 = `[[doc:${documentId}#${newNumber}]]`;

            updated = updated.split(rawOld1).join(rawNew1);
            updated = updated.split(rawOld2).join(rawNew2);

            // ─────────────────────────────
            // ② 예전에 저장된, 이스케이프 된 형태
            //    \[\[doc:7\#1\.1\|...]]
            //    \[\[doc:7\#1\.1\]\]
            //    → sanitizeWikiSyntax 로 "패턴"만 변환해서 사용
            // ─────────────────────────────
            const escOld1 = sanitizeWikiSyntax(rawOld1);
            const escOld2 = sanitizeWikiSyntax(rawOld2);
            const escNew1 = sanitizeWikiSyntax(rawNew1);
            const escNew2 = sanitizeWikiSyntax(rawNew2);

            updated = updated.split(escOld1).join(escNew1);
            updated = updated.split(escOld2).join(escNew2);
        }

        if (updated !== markdown) {
            const { error: upErr } = await supabase
                .from('documents')
                .update({
                    content_markdown: updated,
                    updated_at: nowIso,
                })
                .eq('id', d.id);

            if (upErr) {
                console.error('updateSectionLinksForDocument - update error', upErr);
                // 필요하면 throw upErr; 로 바꿀 수 있음
            }
        }
    }
}

function sanitizeWikiSyntax(str = '') {
    return str
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/#/g, '\\#')
        .replace(/\|/g, '\\|')
        .replace(/\./g, '\\.');
}

/** 내 즐겨찾기 목록 (document_id 만) */
export async function fetchMyDocumentFavorites(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('document_favorites')
        .select('document_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/** 즐겨찾기 추가 */
export async function addDocumentFavorite({ userId, documentId }) {
    const { error } = await supabase
        .from('document_favorites')
        .upsert(
            { user_id: userId, document_id: documentId },
            { onConflict: 'user_id,document_id' },
        );

    if (error) throw error;
}

/** 즐겨찾기 삭제 */
export async function removeDocumentFavorite({ userId, documentId }) {
    const { error } = await supabase
        .from('document_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('document_id', documentId);

    if (error) throw error;
}
