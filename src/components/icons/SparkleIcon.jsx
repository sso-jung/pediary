export default function SparkleIcon({ className = '' }) {
    return (
        <svg
            viewBox="0 0 30 25"
            className={`h-7 w-7 ${className}`}
            aria-hidden="true"
        >
            {/* 큰 스파클 (1.5배 확대) */}
            <path
                d="M0 -5 L1.4 0 L6 1.4 L1.4 2.8 L0 7.5 L-1.4 2.8 L-6 1.4 L-1.4 0 Z"
                transform="translate(11,12) scale(2)"
                fill="#FFD206"
                opacity="0.9"
            />
            {/* 작은 스파클 (오른쪽 위, 1.5배 확대) */}
            <path
                d="M0 -4 L1.2 0 L4.3 1.2 L1.2 2.4 L0 6 L-1.2 2.4 L-4.3 1.2 L-1.2 0 Z"
                transform="translate(23,5) scale(1.5)"
                fill="#FFD206"
                opacity="0.7"
            />
        </svg>
    );
}