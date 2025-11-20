// src/features/wiki/HeadingTree.jsx
export function HeadingTree({ items }) {
    if (!items || items.length === 0) return null;

    return (
        <nav className="mt-2 text-sm">
            {items.map((h) => (
                <button
                    key={h.number + h.id}
                    type="button"
                    onClick={() => {
                        const el = document.getElementById(h.id);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }}
                    className={[
                        'block w-full text-left py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded',
                        h.level === 1 ? 'pl-0 font-semibold' :
                            h.level === 2 ? 'pl-4' :
                                'pl-8 text-neutral-500 dark:text-neutral-400'
                    ].join(' ')}
                >
                    <span className="mr-1 text-neutral-400">{h.number}</span>
                    {h.text}
                </button>
            ))}
        </nav>
    );
}
