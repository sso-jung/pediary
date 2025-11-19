export default function Button({
                                   children,
                                   className = '',
                                   variant = 'primary',
                                   ...props
                               }) {
    const base =
        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium shadow-soft transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
        primary:
            'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-300',
        ghost:
            'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus:ring-primary-200',
    };

    return (
        <button
            className={`${base} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
