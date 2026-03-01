import React, { useState, useEffect } from 'react';
import './Toast.css';

// Singleton para añadir toasts desde cualquier parte sin React Context
let globalAddToast = () => { console.warn('ToastContainer no montado'); };

export const toast = {
    success: (msg) => globalAddToast({ msg, type: 'success' }),
    error: (msg) => globalAddToast({ msg, type: 'error' }),
    info: (msg) => globalAddToast({ msg, type: 'info' }),
};

export function ToastContainer() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        globalAddToast = (newToast) => {
            const id = Date.now() + Math.random();
            setToasts(prev => [...prev, { ...newToast, id }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 4000); // 4 segundos de duración
        };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type} toast-enter`}>
                    <span className="toast-icon">
                        {t.type === 'success' ? '✅' : t.type === 'error' ? '🚨' : 'ℹ️'}
                    </span>
                    <span className="toast-msg">{t.msg}</span>
                </div>
            ))}
        </div>
    );
}
