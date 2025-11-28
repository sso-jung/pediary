// src/components/icons/SpeechBubbleIcon.jsx (예시)
export default function SpeechBubbleIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 22 22"
      className={`h-6 w-6 ${className}`}  // 🔺 더 크고 시원하게
      aria-hidden="true"
    >
      {/* 말풍선 큰 동그라미 + 꼬리 (연회색 계열, currentColor 로 채움) */}
      <g fill="currentColor">
        {/* 둥근 말풍선 본체 */}
        <circle cx="10" cy="10" r="7.5" />

        {/* 꼬리: 오른쪽 아래로 살짝 빠지는 삼각형 형태 */}
        <path d="M15 13.5 L19 16 L16.2 11.8 Z" />
      </g>

      {/* 말풍선 안의 "말하는" 텍스트 선 */}
      <path
        d="M7 9h6M7 11h4"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
