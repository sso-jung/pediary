import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import AppRouter from './router/AppRouter';
import { useAuthStore } from './store/authStore';

export default function App() {
    const initSession = useAuthStore((s) => s.initSession);

    useEffect(() => {
        initSession();
    }, [initSession]);

    return (
        <QueryClientProvider client={queryClient}>
            <AppRouter />
        </QueryClientProvider>
    );
}
