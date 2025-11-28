// src/features/wiki/PediaryInsightPanel.jsx
import SpeechBubbleIcon from '../../components/icons/SpeechBubbleIcon';
import Button from '../../components/ui/Button';

export default function PediaryInsightPanel({ ai }) {
  const { result, loading, error, analyze } = ai;

    function SectionDot() {
      return (
        <span className="inline-block h-[6px] w-[6px] rounded-full bg-slate-300 flex-none" />
      );
    }

    function CheckIcon({ className = '' }) {
      return (
        <svg
          viewBox="0 0 15 15"
          className={`h-3 w-3 ${className}`}
          aria-hidden="true"
        >
          {/* 체크 표시 */}
          <path
            d="M6 10.2 8.7 13 14 7.5"
            fill="none"
            stroke="#2F6F7A"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

  return (
    <div className="rounded-2xl bg-slate-50 p-3 lg:p-4 border border-slate-100 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <SpeechBubbleIcon className="text-[#719ea8]" />
              <p className="text-[11pt] font-bold text-[#34456e]">
                피디어리의 한 마디
              </p>
        </div>
{/*         <Button */}
{/*           type="button" */}
{/*           size="xs" */}
{/*           variant="soft" */}
{/*           onClick={analyze} */}
{/*           disabled={loading}   // 이제 로딩 중일 때만 막자 */}
{/*         > */}
{/*           {loading ? '분석 중...' : '오늘 상태 분석하기'} */}
{/*         </Button> */}
      </div>

      {error && (
        <p className="text-[9.5pt] text-rose-500">
          분석 중 오류가 있었어. 잠시 후 다시 시도해줘.
        </p>
      )}

      {!result && !loading && !error && (
        <p className="text-[9.5pt] text-slate-500">
          최근 작성·수정·조회한 문서들을 읽고,
          해야 할 일과 요즘 너의 상태를 정리해줄게.
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3 text-[11px]">
          {/* 포커스 요약 */}
          {result.focusSummary && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <SectionDot />
                <p className="font-semibold text-[10pt] text-slate-700">
                  요즘 내 관심사는?
                </p>
              </div>
              <div className="space-y-0.5 pl-[10px] max-w-[150px] mb-[5px] text-[9.5pt]">
                <Row label="업무" value={result.focusSummary.workPercent} />
                <Row label="일상" value={result.focusSummary.lifePercent} />
                <Row label="취미" value={result.focusSummary.hobbyPercent} />
              </div>
              {result.focusSummary.comment && (
                <p className="mt-1 text-[9.5pt] text-slate-500">
                  {result.focusSummary.comment}
                </p>
              )}
            </div>
          )}

          {/* 체크리스트 */}
          {result.checklist && result.checklist.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <div className="flex items-center gap-1.5 mb-2">
                <SectionDot />
                <p className="font-semibold text-[10pt] text-slate-700">
                  이런 일을 해 볼까?
                </p>
              </div>

              <ul className="space-y-1.5">
                {result.checklist.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-[9.5pt]"
                  >
                    {/* ✅ 체크 아이콘 */}
                    <CheckIcon className="mt-[2px]" />

                    <div>
                      <p className="font-medium text-slate-700 text-[9.5pt]">
                        {item.text}
                      </p>
                      {item.reason && (
                        <p className="mt-[1px] text-[9.5pt] text-slate-500">
                          {item.reason}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 피디어리의 한 마디 */}
          {result.pediaryMessage && (
            <div className="border-t border-slate-100 pt-2">
                <div className="flex items-center gap-1.5 mb-2">
                      <SectionDot />
                      <p className="font-semibold text-[10pt] text-slate-700">
                        피디어리가 본 요즘 너는?
                      </p>
                </div>
              <p className="text-[9.5pt] leading-relaxed text-slate-600 whitespace-pre-line">
                {result.pediaryMessage.text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  const safeValue = Math.max(0, Math.min(100, value || 0));

  // 🔹 라벨별 바 색상 (톤다운 파스텔 느낌)
  const barColorClass =
    label === '업무'
      ? 'bg-[#7FA8E6]' // 파스텔 블루
      : label === '일상'
      ? 'bg-[#7BC8B0]' // 파스텔 그린
      : label === '취미'
      ? 'bg-[#F29C9C]' // 파스텔 레드/코랄
      : 'bg-slate-500'; // 그 외 예비 색

  return (
    <div className="flex items-center justify-between gap-2">
      {/* 라벨: 줄바꿈 방지 + 최소 폭 */}
      <span className="text-slate-600 whitespace-nowrap min-w-[36px]">
        {label}
      </span>

      <div className="flex items-center gap-1.5">
        <div className="h-[6px] w-16 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full ${barColorClass}`}
            style={{ width: `${safeValue}%` }}
          />
        </div>
        <span className="tabular-nums text-slate-500 whitespace-nowrap text-[9pt]">
          {safeValue.toFixed ? safeValue.toFixed(2) : safeValue}%
        </span>
      </div>
    </div>
  );
}
