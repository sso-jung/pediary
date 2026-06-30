import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';

import App from './App';
import { SnackbarProvider } from './components/ui/SnackbarContext';
import Snackbar from './components/ui/Snackbar';

ReactDOM.createRoot(document.getElementById('root')).render(
    <SnackbarProvider>
        <App />
        <Snackbar />
    </SnackbarProvider>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.error('Service worker registration failed:', err);
        });
    });
}
