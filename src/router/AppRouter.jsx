import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import WikiPage from '../features/wiki/WikiPage';
import CategoryPage from '../features/wiki/CategoryPage';
import DocumentPage from '../features/wiki/DocumentPage';
import { useAuthStore } from '../store/authStore';
import CalendarPage from "../features/wiki/CalendarPage.jsx";
import WikiQuickSearch from "../features/wiki/WikiQuickSearch.jsx";
import FriendsPage from "../features/friends/FriendsPage.jsx";
import DocumentsPage from '../features/wiki/DocumentsPage.jsx';
import TrashPage from '../features/wiki/TrashPage.jsx';
import MaterialAnalysisPage from '../features/wiki/MaterialAnalysisPage.jsx';
import CarePage from '../features/care/CarePage.jsx';

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
                {/* 홈: 오늘 활동 / 다이어리 페이지 */}
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

                {/* 🔹 문서 탭: 전체 문서 목록 */}
                <Route
                    path="/docs"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <DocumentsPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />

                {/* CARE */}
                <Route
                    path="/care"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <CarePage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />

                {/* 🔹 휴지통 */}
                <Route
                    path="/trash"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <TrashPage />
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

                {/* (필요하면 여기도 ProtectedRoute로 감싸도 됨) */}
                <Route
                    path="/calendar"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <CalendarPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />
                {/* 🔹 자료 분석 탭 */}
                <Route
                    path="/materials"
                    element={
                        <ProtectedRoute>
                            <AppLayout>
                                <MaterialAnalysisPage />
                            </AppLayout>
                        </ProtectedRoute>
                    }
                />
            </Routes>

            {/* 전역 단축키 검색 (Ctrl+K) */}
            <WikiQuickSearch />
        </BrowserRouter>
    );
}

