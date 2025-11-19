import { useSnackbar } from './SnackbarContext';

export default function Snackbar() {
    const { snackbar } = useSnackbar();

    if (!snackbar.open) return null;

    return (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white shadow-lg animate-fade-in-down">
            {snackbar.message}
        </div>
    );
}
