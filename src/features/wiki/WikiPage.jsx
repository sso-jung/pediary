// src/features/wiki/WikiPage.jsx
import ActivityCalendar from './ActivityCalendar';

export default function WikiPage() {
  return (
      <div className="flex h-full min-h-0 flex-col">
        {/* 상단 인사 */}
        <section className="shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              {/*<h1 className="pediary-heading ui-page-title flex items-center gap-[7px] text-2xl font-semibold">*/}
              {/*  <span>환영해, Pediary</span>*/}
              {/*  <SparkleIcon className="h-6 w-6"/>*/}
              {/*</h1>*/}
              {/*<p className="ui-page-subtitle mt-1 text-sm">*/}
              {/*  오늘 내가 어떤 문서를 작성·수정·조회했는지 한눈에 볼 수 있어.*/}
              {/*</p>*/}
            </div>
          </div>
        </section>

        {/* 메인 영역 */}
        <section className="ui-surface mt-1 mb-1 flex-1 min-h-0 rounded-2xl px-4 py-3 overflow-y-auto">
          <ActivityCalendar/>
        </section>
      </div>
  );
}
