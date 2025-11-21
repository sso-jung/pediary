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
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                console.error(error);
                set({ user: null, loading: false });
                return;
            }
            set({ user: data.user ?? null, loading: false });
        } catch (e) {
            console.error(e);
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
