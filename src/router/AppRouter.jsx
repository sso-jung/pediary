import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import WikiPage from '../features/wiki/WikiPage';
import CategoryPage from '../features/wiki/CategoryPage';
import DocumentPage from '../features/wiki/DocumentPage';
import { useAuthStore } from '../store/authStore';
import CalendarPage from "../features/wiki/CalendarPage.jsx";

function ProtectedRoute({ children }) {
    const { user, loading } = useAuthStore();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-slate-500">
                로딩 중...
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* 홈: 간단한 환영/안내 화면 */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <WikiPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />

                {/* 카테고리별 문서 목록 */}
                <Route
                    path="/category/:categoryId"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <CategoryPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />

                {/* 문서 상세 */}
                <Route
                    path="/wiki/:slug"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <DocumentPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />

                {/* Auth */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
            </Routes>
        </BrowserRouter>
    );
}
