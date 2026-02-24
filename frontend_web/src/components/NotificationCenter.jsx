import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import './NotificationCenter.css';

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'ahora mismo';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
}

const TYPE_ICON = {
    match: '🌐', connection_request: '🤝', wave: '👋',
    memories_unlocked: '📸', event_reminder: '📅', system: '⚙️',
};

// ─── Toast Component ─────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
    useEffect(() => {
        const t = setTimeout(() => onDismiss(toast.toast_id), 4000);
        return () => clearTimeout(t);
    }, [toast.toast_id, onDismiss]);

    return (
        <div className="notif-toast slide-in-right" onClick={() => onDismiss(toast.toast_id)}>
            <span className="notif-toast-icon">{TYPE_ICON[toast.type] || '🔔'}</span>
            <div className="notif-toast-body">
                <p className="notif-toast-title">{toast.title}</p>
                {toast.body && <p className="notif-toast-sub">{toast.body}</p>}
            </div>
            <button className="notif-toast-close">✕</button>
        </div>
    );
}

// ─── Main NotificationCenter ──────────────────────────────────────────────────
export default function NotificationCenter({ userId }) {
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const { notifications, unreadCount, toasts, markAllRead, markOneRead, dismissToast } = useNotifications(userId);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <>
            {/* Toast container */}
            <div className="toast-container">
                {toasts.map(t => (
                    <Toast key={t.toast_id} toast={t} onDismiss={dismissToast} />
                ))}
            </div>

            {/* Bell button */}
            <div className="notif-bell-wrap" ref={panelRef}>
                <button
                    className="notif-bell-btn"
                    onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) markAllRead(); }}
                    aria-label="Notificaciones"
                >
                    🔔
                    {unreadCount > 0 && (
                        <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                </button>

                {/* Panel */}
                {open && (
                    <div className="notif-panel fade-in">
                        <div className="notif-panel-header">
                            <span className="notif-panel-title">Notificaciones</span>
                            <button className="notif-mark-all" onClick={markAllRead}>
                                ✓ Todo leído
                            </button>
                        </div>

                        <div className="notif-list">
                            {notifications.length === 0 ? (
                                <div className="notif-empty">
                                    <span>🔕</span>
                                    <p>Sin notificaciones aún.</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <button
                                        key={n.id}
                                        className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                                        onClick={() => markOneRead(n.id)}
                                    >
                                        <span className="notif-item-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                                        <div className="notif-item-body">
                                            <p className="notif-item-title">{n.title}</p>
                                            {n.body && <p className="notif-item-sub">{n.body}</p>}
                                            <p className="notif-item-time">{timeAgo(n.created_at)}</p>
                                        </div>
                                        {!n.is_read && <span className="notif-dot" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
