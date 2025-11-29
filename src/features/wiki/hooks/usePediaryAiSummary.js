// src/features/wiki/hooks/usePediaryAiSummary.js
import { useMemo, useRef, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/authStore';

export function usePediaryAiSummary(rawActivity = []) {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // 🔹 언마운트 플래그
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🔹 최근 활동/문서들 전처리
  const {
    recentActivityPayload,
    recentDocs,
    topEditedDocs,
  } = useMemo(() => {
    if (!Array.isArray(rawActivity) || rawActivity.length === 0) {
      return {
        recentActivityPayload: [],
        recentDocs: [],
        topEditedDocs: [],
      };
    }

    // 1) activity 그대로 보내기
    const recentActivityPayload = rawActivity;

    // 2) 활동에 등장한 문서들 정리 (최대 10개)
    //    fetchTodayActivity 가 created_at DESC 로 정렬해서 주고 있으니
    //    그 순서 그대로 사용하면 "최근에 다룬 문서" 순서가 됨
    const docMap = new Map();

    for (const row of rawActivity) {
      const doc = row.documents;
      if (!doc || doc.deleted_at) continue;

      if (!docMap.has(doc.id)) {
        docMap.set(doc.id, {
          id: doc.id,
          title: doc.title,
          categoryId: doc.category_id ?? null,
          categoryName: doc.category?.name ?? null,
          updatedAt: doc.updated_at ?? row.created_at ?? null,
          content: doc.content_markdown ?? '',
        });
      }
    }

    const recentDocs = Array.from(docMap.values()).slice(0, 10);

    // 3) 많이 수정된 문서(topEdited) 후보 만들기
    //    여기선 단순히 "updated 로그 개수" 기준으로 추려서
    //    Edge Function 에서 세션 기준 editCount 를 다시 계산할 때
    //    base 정보(title/category/content)를 보완용으로 쓰게 함
    const updateCountMap = new Map();

    for (const row of rawActivity) {
      if (row.action === 'updated' && row.document_id != null) {
        const docId = row.document_id;
        updateCountMap.set(docId, (updateCountMap.get(docId) || 0) + 1);
      }
    }

    const topEditedDocs = Array.from(docMap.values())
      .map((doc) => ({
        ...doc,
        _count: updateCountMap.get(doc.id) || 0,
      }))
      .filter((d) => d._count > 0)
      .sort((a, b) => b._count - a._count)
      .slice(0, 5)
      .map(({ _count, ...rest }) => rest);

    return {
      recentActivityPayload,
      recentDocs,
      topEditedDocs,
    };
  }, [rawActivity]);

  const canAnalyze = !!user;

  const analyze = async () => {
    if (!user || loading) return;

    // 언마운트 됐으면 아무 것도 안 함
    if (!isMountedRef.current) return;

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // 1️⃣ profiles 에서 닉네임/이메일 가져오기
      let displayName = '사용자';

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('nickname, email')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('fetch profile for AI error', profileError);
        }

        if (profile?.nickname && profile.nickname.trim()) {
          displayName = profile.nickname.trim();
        } else if (profile?.email) {
          displayName = profile.email;
        } else if (user.email) {
          displayName = user.email;
        }
      } catch (e) {
        console.error('profile fetch exception', e);
        // 실패해도 그냥 기본 displayName 써서 진행
      }

      const payload = {
        userId: user.id,
        userName: displayName,          // ✅ 닉네임 우선, 없으면 이메일
        recentActivity: recentActivityPayload,
        recentDocs,
        topEditedDocs,
      };

      // 2️⃣ Edge Function 호출 (여기서 12시간 캐시 처리까지 함)
      const { data, error: fnError } = await supabase.functions.invoke(
        'pediary-ai-summary',
        { body: payload },
      );

      if (fnError) {
        console.error('pediary-ai-summary error', fnError);
        throw fnError;
      }

      if (isMountedRef.current) {
        setResult(data);
      }
    } catch (e) {
      console.error(e);
      if (isMountedRef.current) {
        setError(e);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return {
    loading,
    result,
    error,
    canAnalyze,
    analyze,
  };
}
