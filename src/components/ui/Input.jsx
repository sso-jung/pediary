export default function Input({ className = '', ...props }) {
    return (
        <input
            className={`w-full rounded-xl border border-slate-200 bg-white px-[12px] py-[6px] text-[9.5pt] shadow-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-200 ${className}`}
            {...props}
        />
    );
}