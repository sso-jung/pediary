// src/components/ui/Snackbar.jsx
import { useSnackbar } from './SnackbarContext';

export default function Snackbar() {
    const { snackbar } = useSnackbar();

    if (!snackbar.open) return null;

    return (
        <div
            className="
        ui-snackbar
        fixed left-1/2 top-6 z-50 -translate-x-1/2
        rounded-xl px-4 py-2 text-sm shadow-lg
        animate-fade-in-down
      "
            role="status"
            aria-live="polite"
        >
            {snackbar.message}
        </div>
    );
}
