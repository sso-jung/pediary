import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'

import App from './App';
import { SnackbarProvider } from './components/ui/SnackbarContext';
import Snackbar from './components/ui/Snackbar';

ReactDOM.createRoot(document.getElementById('root')).render(
    <SnackbarProvider>
        <App />
        <Snackbar />
    </SnackbarProvider>
);
