import React, { useState, useEffect, useRef } from 'react';
import { fetchMutualMatches, updateAvailabilityStatus } from '../api';
import './SocialRadar.css';

const MEET_EMOJIS = ['🍎', '🎯', '🦋', '🌊', '⚡', '🎸', '🏄', '🌙', '🔮', '🦄'];

function getRandomPositions(count) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const radius = 38 + (i % 3) * 7; // vary the orbit radius slightly
        positions.push({
            top: `${50 + radius * Math.sin(angle)}%`,
            left: `${50 + radius * Math.cos(angle)}%`,
        });
    }
    return positions;
}

export default function SocialRadar({ eventId, currentUser, initialFilter }) {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState(initialFilter || ''); // Nuevo: barra de búsqueda con estado inicial
    const [available, setAvailable] = useState(
        currentUser?.availability_status !== false
    );
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [meetMode, setMeetMode] = useState(false);
    const [myEmoji] = useState(() => MEET_EMOJIS[Math.floor(Math.random() * MEET_EMOJIS.length)]);
    const drawerRef = useRef(null);

    useEffect(() => {
        if (eventId && available) loadMatches();
    }, [eventId, available]);

    const loadMatches = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetchMutualMatches(eventId);
            setMatches(res.data.matches || []);
        } catch (err) {
            const msg = err.response?.data?.detail || 'No se pudo cargar el radar.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const toggleAvailability = async () => {
        const newVal = !available;
        setAvailable(newVal);
        try {
            await updateAvailabilityStatus(newVal);
            if (newVal) loadMatches();
            else setMatches([]);
        } catch {
            setAvailable(!newVal); // rollback on error
        }
    };

    const filteredMatches = matches.filter(m => {
        if (!filter) return true;
        const search = filter.toLowerCase().replace('#', '');
        return m.name.toLowerCase().includes(search) ||
            m.shared_tags?.some(tag => tag.toLowerCase().includes(search));
    });

    const positions = getRandomPositions(filteredMatches.length);

    return (
        <div className="social-radar-page">
            <div className="radar-header">
                <h1 className="radar-title">
                    <span className="radar-title-gradient">Radar Social</span> 🌐
                </h1>
                <p className="radar-subtitle">
                    Descubre quién coincide contigo en este evento ahora mismo.
                </p>

                {/* Availability Toggle */}
                <div className="availability-toggle-row">
                    <button
                        className={`availability-btn ${available ? 'available' : 'hidden'}`}
                        onClick={toggleAvailability}
                    >
                        <span className="avail-dot" />
                        {available ? 'Disponible para charlar' : 'Solo observando'}
                    </button>

                    <button
                        className={`meet-mode-btn ${meetMode ? 'active' : ''}`}
                        onClick={() => setMeetMode(!meetMode)}
                    >
                        {meetMode ? '❌ Salir del Modo Encuentro' : '🎭 Activar Modo Encuentro'}
                    </button>
                </div>

                {/* Search / Filter Bar */}
                <div className="radar-search-container">
                    <input
                        type="text"
                        placeholder="Filtrar por nombre o #tag..."
                        className="radar-search-input"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    {filter && (
                        <button className="radar-clear-filter" onClick={() => setFilter('')}>✕</button>
                    )}
                </div>
            </div>

            {/* ── MEET MODE OVERLAY ── */}
            {meetMode && (
                <div className="meet-mode-overlay fade-in">
                    <div className="meet-mode-emoji">{myEmoji}</div>
                    <h2 className="meet-mode-instruction">
                        Busca a la persona con el emoji
                        <span className="meet-emoji-highlight"> {myEmoji} </span>
                        en su pantalla, cerca de la barra o la entrada.
                    </h2>
                    <p className="meet-mode-hint">
                        Tu match también te está buscando ahora mismo. ¡El primer gesto lo rompe todo!
                    </p>
                    <button className="btn-ghost" onClick={() => setMeetMode(false)}>
                        Cancelar
                    </button>
                </div>
            )}

            {/* ── RADAR CANVAS ── */}
            {!meetMode && (
                <>
                    <div className="radar-canvas-wrap">
                        <div className="radar-canvas">
                            {/* Pulsing rings */}
                            <div className="ring ring-1" />
                            <div className="ring ring-2" />
                            <div className="ring ring-3" />

                            {/* Center core */}
                            <div className="radar-core">
                                <img
                                    src={currentUser?.avatar_url || `https://ui-avatars.com/api/?name=${currentUser?.username}&background=7c3aed&color=fff&size=80`}
                                    alt="Tú"
                                    className="radar-center-avatar"
                                />
                                <span className="radar-you-label">Tú</span>
                            </div>

                            {/* Match Avatars */}
                            {!loading && filteredMatches.map((match, i) => (
                                <button
                                    key={match.user_id}
                                    className="radar-avatar-btn"
                                    style={positions[i]}
                                    onClick={() => setSelectedMatch(match)}
                                    title={match.name}
                                >
                                    <img
                                        src={match.avatar_url}
                                        alt={match.name}
                                        className="radar-avatar-img"
                                    />
                                    <span className="radar-avatar-score">
                                        {match.match_score}✨
                                    </span>
                                </button>
                            ))}

                            {loading && (
                                <div className="radar-scan-line" />
                            )}
                        </div>
                    </div>

                    {/* Status rows */}
                    {!available && (
                        <p className="radar-off-msg">
                            Estás en modo <strong>Solo observando</strong>. Activa tu disponibilidad para aparecer en el radar de otros.
                        </p>
                    )}
                    {available && !loading && matches.length === 0 && !error && (
                        <p className="radar-empty">
                            🔍 Aún no hay matches en esta sala. El radar se actualiza continuamente — ¡el mejor momento para conocer a alguien es cuando llegas!
                        </p>
                    )}
                    {error && <p className="radar-error">{error}</p>}

                    {/* Match count summary */}
                    {!loading && filteredMatches.length > 0 && (
                        <p className="radar-found">
                            🎯 {filteredMatches.length} persona{filteredMatches.length !== 1 ? 's' : ''} afín{filteredMatches.length !== 1 ? 'es' : ''} {filter ? 'con esa etiqueta' : 'en esta sala'}. Toca un avatar para ver qué tenéis en común.
                        </p>
                    )}
                </>
            )}

            {/* ── MATCH DRAWER ── */}
            {selectedMatch && (
                <div className="drawer-backdrop" onClick={() => setSelectedMatch(null)}>
                    <div
                        className="match-drawer slide-up"
                        ref={drawerRef}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="match-drawer-handle" />
                        <img
                            src={selectedMatch.avatar_url}
                            alt={selectedMatch.name}
                            className="match-drawer-avatar"
                        />
                        <h3 className="match-drawer-name">{selectedMatch.name}</h3>

                        <div className="match-tags">
                            <p className="match-tags-label">Coincidís en:</p>
                            <div className="match-tag-list">
                                {selectedMatch.shared_tags.map(tag => (
                                    <span key={tag} className="tag-pill">#{tag}</span>
                                ))}
                            </div>
                        </div>

                        <div className="icebreaker-box">
                            <p className="icebreaker-label">💬 Sugerencia de rompehielos:</p>
                            <p className="icebreaker-text">"{selectedMatch.icebreaker_suggestion}"</p>
                        </div>

                        <div className="match-drawer-actions">
                            <button
                                className="btn-primary-full"
                                onClick={() => {
                                    setMeetMode(true);
                                    setSelectedMatch(null);
                                }}
                            >
                                🎭 Activar Modo Encuentro
                            </button>
                            <button className="btn-ghost-sm" onClick={() => setSelectedMatch(null)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
