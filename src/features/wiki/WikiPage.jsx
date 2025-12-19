// src/features/wiki/WikiPage.jsx
import { useEffect, useState } from 'react';
import ActivityCalendar from './ActivityCalendar';
import SparkleIcon from '../../components/icons/SparkleIcon';
import { useAuthStore } from '../../store/authStore';
import { useSnackbar } from '../../components/ui/SnackbarContext';
import { downloadMyDocumentsExcel } from '../../lib/exportMyDocumentsExcel';

import PediaryInsightPanel from './PediaryInsightPanel';
import { usePediaryAiSummary } from './hooks/usePediaryAiSummary';
import { useAiRecentActivity } from './hooks/useAiRecentActivity';
import { useRecentDocsForAi } from './hooks/useRecentDocsForAi';

const HOME_VIEW_MODE_KEY = 'pediary-home-view-mode';

export default function WikiPage() {
  // 🔹 활동: 오늘 + 어제
  const { data: rawActivity, isLoading: activityLoading } = useAiRecentActivity();

  // 🔹 문서: 날짜 상관없이 최신 수정 10개
  const { data: recentDocsForAi } = useRecentDocsForAi();

  // 🔹 AI 요약 훅 (한 번만 호출)
  const ai = usePediaryAiSummary(rawActivity || [], recentDocsForAi || null);
  const { loading: aiLoading, result: aiResult, canAnalyze, analyze } = ai;

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'today';

    const saved = window.localStorage.getItem(HOME_VIEW_MODE_KEY);
    return saved || 'today';
  });

  const user = useAuthStore((s) => s.user);
  const { showSnackbar } = useSnackbar();
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!user) {
      showSnackbar?.('로그인 후에 내보내기를 할 수 있어.');
      return;
    }
    if (exporting) return;

    try {
      setExporting(true);
      await downloadMyDocumentsExcel(user.id);
      showSnackbar?.('엑셀 백업 파일을 내려받았어.');
    } catch (e) {
      console.error(e);
      showSnackbar?.('엑셀 내보내기에 실패했어. 잠시 후 다시 시도해줘.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HOME_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const hasActivity = !!rawActivity && rawActivity.length > 0;

  // ✅ viewMode 가 'today'일 때 자동 분석 트리거
  useEffect(() => {
    if (
        viewMode === 'today' &&
        canAnalyze &&
        !activityLoading &&   // 활동 데이터 로딩 끝
        // hasActivity &&      // 원하면 다시 켜도 됨
        !aiLoading &&
        !aiResult
    ) {
      analyze();
    }
  }, [
    viewMode,
    canAnalyze,
    activityLoading,
    // hasActivity,
    aiLoading,
    aiResult,
    analyze,
  ]);

  return (
      <div className="flex h-full min-h-0 flex-col">
        {/* 상단 인사 + 토글 버튼 */}
        <section className="shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="pediary-heading ui-page-title flex items-center gap-[7px] text-2xl font-semibold">
                <span>환영해, Pediary</span>
                <SparkleIcon className="h-6 w-6"/>
              </h1>
              <p className="ui-page-subtitle mt-1 text-sm">
                오늘 내가 어떤 문서를 작성·수정·조회했는지 한눈에 볼 수 있어.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* 엑셀 내보내기 */}
              <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="ui-btn-success inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm disabled:opacity-60"
              >
                <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                  <path d="M4 4h16v6H4z" />
                  <path d="M9 4v6" />
                  <path d="M15 4v6" />
                  <path d="M6 14l3 3-3 3" />
                  <path d="M10 20h8" />
                </svg>
                <span>{exporting ? '내보내는 중...' : '엑셀로 백업'}</span>
              </button>

              {/* 달력 / 오늘 토글 */}
              <button
                  type="button"
                  onClick={() =>
                      setViewMode((m) => (m === 'today' ? 'diary' : 'today'))
                  }
                  className="ui-control inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium"
              >
                <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <path d="M8 2v4M16 2v4M3 10h18" />
                </svg>
                <span>
                {viewMode === 'today' ? '다이어리 달력' : '내 활동 요약'}
              </span>
              </button>
            </div>
          </div>
        </section>

        {/* 메인 영역 */}
        <section className="ui-surface mt-3 flex-1 min-h-0 rounded-2xl px-4 py-1 overflow-y-auto">
          {viewMode === 'diary' ? (
              <ActivityCalendar/>
          ) : (
              <div className="mt-3 relative min-h-[180px]">
                {(aiLoading || activityLoading) && (
                    <div
                        className="ui-overlay absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
                      <div className="flex flex-col items-center gap-2">
                        <div
                            className="h-8 w-8 animate-spin rounded-full border border-border-subtle border-t-[var(--color-text-main)]"/>
                        <p className="ui-page-subtitle text-xs">
                        오늘 활동을 분석하는 중이야...
                      </p>
                      </div>
                    </div>
                )}

                <PediaryInsightPanel
                    ai={ai}
                    isLoadingActivity={activityLoading}
                    hasActivity={hasActivity}
                />
              </div>
          )}
        </section>
      </div>
  );
}
