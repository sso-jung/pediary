// src/features/wiki/PediaryInsightPanel.jsx
import SpeechBubbleIcon from '../../components/icons/SpeechBubbleIcon';
import Button from '../../components/ui/Button';

export default function PediaryInsightPanel({ ai }) {
  const { result, loading, error, analyze } = ai;

    function SectionDot() {
      return (
          <span className = "inline-block h-[6px] w-[6px] rounded-full flex-none"
            style = {{ backgroundColor: "var(--color-dot)" }}/>
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
            stroke="var(--color-success)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

  return (
      <div className="ui-panel rounded-2xl p-3 lg:p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <SpeechBubbleIcon style={{ color: "var(--color-text-muted)" }} />
                  <p className="text-[11pt] font-bold" style={{color: "var(--color-text-main)"}}>
                      피디어리의 한 마디
                  </p>
              </div>
          </div>

          {error && (
              <p className="text-[9.5pt] text-rose-500">
                  분석 중 오류가 있었어. 잠시 후 다시 시도해줘.
              </p>
          )}

          {!result && !loading && !error && (
              <p className="ui-page-subtitle text-[9.5pt]">
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
                              <SectionDot/>
                              <p className="font-semibold text-[10pt]" style={{color: "var(--color-text-main)"}}>
                                  요즘 내 관심사는?
                              </p>
                          </div>
                          <div className="space-y-0.5 pl-[10px] max-w-[150px] mb-[5px] text-[9.5pt]">
                              <Row label="업무" value={result.focusSummary.workPercent}/>
                              <Row label="일상" value={result.focusSummary.lifePercent}/>
                              <Row label="취미" value={result.focusSummary.hobbyPercent}/>
                          </div>
                          {result.focusSummary.comment && (
                              <p className="mt-1 text-[9.5pt]" style={{color: "var(--color-text-muted)"}}>
                                  {result.focusSummary.comment}
                              </p>
                          )}
                      </div>
                  )}

                  {/* 체크리스트 */}
                  {result.checklist && result.checklist.length > 0 && (
                      <div className="border-t pt-2" style={{borderColor: "var(--color-border-subtle)"}}>
                          <div className="flex items-center gap-1.5 mb-2">
                              <SectionDot/>
                              <p className="font-semibold text-[10pt]" style={{color: "var(--color-text-main)"}}>
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
                                      <CheckIcon className="mt-[2px]"/>

                                      <div>
                                          <p className="font-medium text-[9.5pt]"
                                             style={{color: "var(--color-text-main)"}}>
                                              {item.text}
                                          </p>
                                          {item.reason && (
                                              <p className="ui-page-subtitle mt-[1px] text-[9.5pt]">
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
                      <div className="border-t pt-2" style={{borderColor: "var(--color-border-subtle)"}}>
                          <div className="flex items-center gap-1.5 mb-2">
                              <SectionDot/>
                              <p className="font-semibold text-[10pt]" style={{color: "var(--color-text-main)"}}>
                                  피디어리가 본 요즘 너는?
                              </p>
                          </div>
                          <p className="text-[9.5pt] leading-relaxed whitespace-pre-line" style={{ color: "var(--color-text-muted)" }}>
                              {result.pediaryMessage.text}
                          </p>
                      </div>
                  )}
              </div>
          )}
      </div>
  );
}

function Row({label, value}) {
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
        <span className="whitespace-nowrap min-w-[36px]" style={{color: "var(--color-text-muted)"}}>
        {label}
      </span>

        <div className="flex items-center gap-1.5">
            <div className="h-[6px] w-16 rounded-full overflow-hidden"
                 style={{ backgroundColor: "color-mix(in srgb, var(--color-border-subtle) 35%, transparent)" }}>
          <div
            className={`h-full ${barColorClass}`}
            style={{ width: `${safeValue}%` }}
          />
        </div>
            <span className="tabular-nums whitespace-nowrap text-[9pt]" style={{color: "var(--color-text-muted)"}}>
          {safeValue.toFixed ? safeValue.toFixed(2) : safeValue}%
        </span>
        </div>
    </div>
  );
}
