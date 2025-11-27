export default function ListIcon({ className = '' }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 ${className}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {/*<circle cx="5" cy="7" r="1.4" />*/}
            {/*<circle cx="5" cy="12" r="1.4" />*/}
            {/*<circle cx="5" cy="17" r="1.4" />*/}

            <line x1="3.5" y1="6" x2="21" y2="6" />
            <line x1="3.5" y1="12" x2="21" y2="12" />
            <line x1="3.5" y1="18" x2="21" y2="18" />
        </svg>
    );
}