// src/features/wiki/hooks/usePediaryAiSummary.js
import { useMemo, useRef, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/authStore';

// ✅ 이건 이제 안 쓰니까 지워도 됨
// const AI_ENDPOINT = import.meta.env.VITE_PEDIAIY_AI_ENDPOINT;

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

  // 🔹 최근 활동/문서들 전처리 (지금은 생략 버전)
  const {
    recentActivityPayload,
    recentDocs,
    topEditedDocs,
  } = useMemo(() => {
    return {
      recentActivityPayload: rawActivity,
      recentDocs: [],
      topEditedDocs: [],
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
