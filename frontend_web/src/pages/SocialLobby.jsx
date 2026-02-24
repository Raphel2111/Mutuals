import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import SmartSuggestions from '../components/SmartSuggestions';
import './SocialLobby.css';

export default function SocialLobby({ eventId, eventName, currentUser, onBack }) {
    const { theme } = useTheme();
    const [messages, setMessages] = useState([]);
    const [attendees, setAttendees] = useState({}); // { user_id: { username, avatar_url, ghost } }
    const [input, setInput] = useState('');
    const [ghostMode, setGhostMode] = useState(false);
    const [connected, setConnected] = useState(false);
    const ws = useRef(null);
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (!eventId) return;

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host === 'localhost:5173' ? 'localhost:8000' : window.location.host;
        const token = localStorage.getItem('access_token');

        const socketUrl = `${protocol}://${host}/ws/lobby/${eventId}/?token=${token}`;
        ws.current = new WebSocket(socketUrl);

        ws.current.onopen = () => {
            setConnected(true);
            // Join as attendee or ghost
            ws.current.send(JSON.stringify({
                type: 'join',
                ghost: ghostMode
            }));
        };

        ws.current.onmessage = (e) => {
            const data = json_parse(e.data);
            if (!data) return;

            if (data.type === 'lobby.presence') {
                if (data.action === 'join') {
                    setAttendees(prev => ({
                        ...prev,
                        [data.user_id]: {
                            username: data.username,
                            avatar_url: data.avatar_url,
                            ghost: data.ghost
                        }
                    }));
                } else if (data.action === 'leave') {
                    setAttendees(prev => {
                        const next = { ...prev };
                        delete next[data.user_id];
                        return next;
                    });
                }
            } else if (data.type === 'lobby.chat') {
                setMessages(prev => [...prev, data]);
            }
        };

        ws.current.onclose = () => setConnected(false);

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [eventId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim() || ghostMode) return;

        ws.current.send(JSON.stringify({
            type: 'chat',
            message: input
        }));
        setInput('');
    };

    const handleWave = (targetId) => {
        if (ghostMode) return;
        ws.current.send(JSON.stringify({
            type: 'wave',
            target_id: targetId
        }));
        // Visual feedback locally would go here
    };

    const handleIcebreaker = (text) => {
        if (ghostMode) return;
        setInput(text);
        // We focus the input if possible
        document.querySelector('.chat-input')?.focus();
    };

    const toggleGhost = () => {
        const newVal = !ghostMode;
        setGhostMode(newVal);
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'join',
                ghost: newVal
            }));
        }
    };

    const json_parse = (str) => {
        try { return JSON.parse(str); } catch { return null; }
    };

    const attendeeList = Object.entries(attendees);
    const visibleAttendees = attendeeList.filter(([_, data]) => !data.ghost);
    const ghostCount = attendeeList.length - visibleAttendees.length;

    return (
        <div className="social-lobby-page fade-in">
            <header className="lobby-header">
                {onBack && <button className="btn-ghost-sm" onClick={onBack} style={{ marginBottom: '16px' }}>← Salir del Lobby</button>}
                <h1 className="lobby-title">{eventName || 'Social Lobby'}</h1>
                <p className="lobby-stats">
                    Activos ahora: <span className="lobby-count">{visibleAttendees.length}</span>
                    {ghostCount > 0 && <span style={{ opacity: 0.6 }}> (+{ghostCount} fantasmas)</span>}
                </p>

                <div className="ghost-mode-row" style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                    <label className="ghost-mode-toggle">
                        <span className="switch">
                            <input type="checkbox" checked={ghostMode} onChange={toggleGhost} />
                            <span className="slider"></span>
                        </span>
                        <span>Modo Fantasma {ghostMode ? 'Activado 👻' : 'Desactivado'}</span>
                    </label>
                </div>
            </header>

            <div className="lobby-content">
                {/* ── Attendees Grid ── */}
                <section className="lobby-attendees-section">
                    <h2 className="sp-section-title">Asistentes en la sala</h2>
                    <div className="attendees-grid">
                        {visibleAttendees.map(([uid, data]) => (
                            <div key={uid} className="attendee-card" onClick={() => handleWave(uid)}>
                                <div className="attendee-avatar-wrap">
                                    <img
                                        src={data.avatar_url || `https://ui-avatars.com/api/?name=${data.username}&background=random`}
                                        alt={data.username}
                                        className="attendee-avatar"
                                    />
                                    <span className="status-indicator" />
                                    <button className="wave-btn" title="Saludar">👋</button>
                                </div>
                                <span className="attendee-name">{data.username}</span>
                            </div>
                        ))}
                        {visibleAttendees.length === 0 && <p className="sp-empty">Esperando a que alguien se una...</p>}
                    </div>
                </section>

                {/* ── Chat Section ── */}
                <section className="lobby-chat-section">
                    <SmartSuggestions
                        eventId={eventId}
                        onIcebreaker={handleIcebreaker}
                    />

                    <div className="chat-header">
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.7 }}>Chat Efímero 💬</span>
                        {!connected && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>Desconectado</span>}
                    </div>

                    <div className="chat-messages">
                        {messages.map((m, i) => (
                            <div key={i} className={`chat-msg ${m.user_id === currentUser.id ? 'own' : 'others'}`}>
                                <span className="msg-user">{m.username}</span>
                                <p style={{ margin: 0 }}>{m.message}</p>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form className="chat-input-area" onSubmit={handleSend}>
                        <input
                            type="text"
                            className="chat-input"
                            placeholder={ghostMode ? "Modo fantasma: no puedes hablar" : "Escribe algo..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={ghostMode || !connected}
                        />
                        <button type="submit" className="chat-send-btn" disabled={ghostMode || !connected}>
                            🚀
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
