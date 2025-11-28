import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export const useAuthStore = create((set) => ({
    user: null,
    loading: true,

    setUser(user) {
        set({ user });
    },

    // 앱 시작 시 세션 확인
    async initSession() {
      try {
        // 1️⃣ 현재 세션 먼저 확인 (세션 없어도 error 안 던짐)
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('getSession error', error);
          set({ user: null, loading: false });
          return;
        }

        // 세션이 있으면 user 세팅, 없으면 null
        set({ user: session?.user ?? null, loading: false });

        // 2️⃣ 로그인 / 로그아웃 / 계정 전환 시 자동 반영
        supabase.auth.onAuthStateChange((_event, newSession) => {
          set({ user: newSession?.user ?? null });
        });
      } catch (e) {
        console.error('initSession exception', e);
        set({ user: null, loading: false });
      }
    },

    // 로그인
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw error;
        }

        const user = data.user ?? data.session?.user ?? null;
        set({ user });

        return data;
    },

    // 회원가입
    async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            throw error;
        }

        // 가입 직후 user 객체만 리턴 (세션 여부와 상관없이)
        const user = data.user ?? data.session?.user ?? null;

        // 이메일 인증을 요구하는 플로우라면,
        // 여기서 set({ user }) 해서 로그인 상태로 만들지 않는 게 더 안전함.
        // set({ user });

        return user;
    },

    // 로그아웃
    async signOut() {
        await supabase.auth.signOut();
        set({ user: null });
    },
}));
