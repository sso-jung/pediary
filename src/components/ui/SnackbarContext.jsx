import { createContext, useContext, useState, useCallback } from 'react';

const SnackbarContext = createContext(null);

export function SnackbarProvider({ children }) {
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
    });

    const showSnackbar = useCallback((message) => {
        setSnackbar({ open: true, message });

        setTimeout(() => {
            setSnackbar({ open: false, message: '' });
        }, 2000);
    }, []);

    return (
        <SnackbarContext.Provider value={{ snackbar, showSnackbar }}>
            {children}
        </SnackbarContext.Provider>
    );
}

export function useSnackbar() {
    const ctx = useContext(SnackbarContext);
    if (!ctx) {
        throw new Error('useSnackbar must be used within SnackbarProvider');
    }
    return ctx;
}
