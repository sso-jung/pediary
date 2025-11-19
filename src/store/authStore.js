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

        // const user = data.user ?? data.session?.user ?? null;
        // set({ user });

        return data;
    },

    // 로그아웃
    async signOut() {
        await supabase.auth.signOut();
        set({ user: null });
    },
}));
