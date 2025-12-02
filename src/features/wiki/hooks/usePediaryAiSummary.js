// src/features/wiki/hooks/usePediaryAiSummary.js
import { useMemo, useRef, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/authStore';

export function usePediaryAiSummary(rawActivity = [], recentDocsOverride = null) {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    recentActivityPayload,
    recentDocs,
    topEditedDocs,
  } = useMemo(() => {
    const safeActivity = Array.isArray(rawActivity) ? rawActivity : [];

    // 1) 활동 그대로 보내기
    const recentActivityPayload = safeActivity;

    // 2) 활동에 등장한 문서들 (fallback 용)
    const docMap = new Map();

    for (const row of safeActivity) {
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

    const activityBasedDocs = Array.from(docMap.values()).slice(0, 10);

    // 🔹 최종 recentDocs: override가 있으면 그걸 우선 사용
    const recentDocs =
        recentDocsOverride && recentDocsOverride.length > 0
            ? recentDocsOverride
            : activityBasedDocs;

    // 3) 많이 수정된 문서 후보 (오늘+어제 활동 기준, 프론트 레벨)
    const updateCountMap = new Map();
    for (const row of safeActivity) {
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
  }, [rawActivity, recentDocsOverride]);

  const canAnalyze = !!user;

  const analyze = async () => {
    if (!user || loading) return;
    if (!isMountedRef.current) return;

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // 🔹 1) 먼저 displayName 만들기 (닉네임 > 이메일 > user.email)
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
        // 실패해도 그냥 기본 displayName('사용자')로 진행
      }

      // 🔹 2) Edge Function 에 넘길 payload
      const payload = {
        userId: user.id,
        userName: displayName,
        recentActivity: recentActivityPayload,
        recentDocs,
        topEditedDocs,
      };

      const { data, error: fnError } = await supabase.functions.invoke(
          'pediary-ai-summary',
          { body: payload },
      );

      if (fnError) throw fnError;

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
