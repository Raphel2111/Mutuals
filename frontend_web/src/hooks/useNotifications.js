import { useState, useEffect, useRef, useCallback } from 'react';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * useNotifications — WebSocket hook for real-time notification streaming.
 *
 * Connects to ws://<host>/ws/notifications/?token=<jwt>
 * Automatically reconnects on unexpected close with exponential back-off.
 *
 * Returns: { notifications, unreadCount, markAllRead, markOneRead, addToast }
 */
export function useNotifications(userId) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [toasts, setToasts] = useState([]);
    const wsRef = useRef(null);
    const reconnectDelay = useRef(1000);

    // ── Fetch persisted notifications on mount ──────────────────────────────
    useEffect(() => {
        if (!userId) return;
        const token = localStorage.getItem('access_token');
        if (!token) return;

        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'}notifications/`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => {
                const list = data.results || data;
                setNotifications(Array.isArray(list) ? list : []);
                setUnreadCount(list.filter(n => !n.is_read).length);
            })
            .catch(() => { });
    }, [userId]);

    // ── WebSocket connection with auto-reconnect ─────────────────────────────
    const connect = useCallback(() => {
        if (!userId) return;
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const ws = new WebSocket(`${WS_BASE}/ws/notifications/?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
            reconnectDelay.current = 1000; // reset back-off
        };

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.type === 'notification') {
                    const newNotif = {
                        id: msg.id,
                        title: msg.title,
                        body: msg.body,
                        type: msg.notif_type,
                        is_read: false,
                        data_json: msg.data || {},
                        created_at: new Date().toISOString(),
                    };
                    setNotifications(prev => [newNotif, ...prev]);
                    setUnreadCount(c => c + 1);
                    // Show toast
                    setToasts(prev => [...prev, { ...newNotif, toast_id: Date.now() }]);
                }
            } catch { }
        };

        ws.onclose = (evt) => {
            if (evt.code !== 1000 && evt.code !== 4401) {
                // Unexpected close — reconnect with back-off
                setTimeout(connect, reconnectDelay.current);
                reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
            }
        };

        // Ping every 25s to keep alive through proxies
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 25_000);

        return () => {
            clearInterval(pingInterval);
            ws.close(1000);
        };
    }, [userId]);

    useEffect(() => {
        const cleanup = connect();
        return () => { cleanup?.(); };
    }, [connect]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const markAllRead = useCallback(async () => {
        const token = localStorage.getItem('access_token');
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'}notifications/mark_read/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    }, []);

    const markOneRead = useCallback(async (id) => {
        const token = localStorage.getItem('access_token');
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'}notifications/${id}/read/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(c => Math.max(0, c - 1));
    }, []);

    const dismissToast = useCallback((toast_id) => {
        setToasts(prev => prev.filter(t => t.toast_id !== toast_id));
    }, []);

    return { notifications, unreadCount, toasts, markAllRead, markOneRead, dismissToast };
}
