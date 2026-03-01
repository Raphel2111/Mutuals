import React, { useEffect, useState, useRef } from 'react';
import axios from '../api';
import EventDetail from './EventDetail';
import ClubDetail from './ClubDetail';
import EventCard from '../components/EventCard';
import { fetchCurrentUser } from '../auth';
import { toast } from '../components/Toast';

export default function EventList(props) {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [selectedClubId, setSelectedClubId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    // Filtros
    const [searchText, setSearchText] = useState('');
    const [visibilityFilter, setVisibilityFilter] = useState('all');
    const [isFreeFilter, setIsFreeFilter] = useState(false);
    const [orderBy, setOrderBy] = useState('-date');
    const [clubs, setClubs] = useState([]);
    const [selectedClub, setSelectedClub] = useState('');

    const [favorites, setFavorites] = useState({});
    const [heroIndex, setHeroIndex] = useState(0);

    // Predictive search
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const searchRef = useRef(null);

    // Auto-rotate hero
    useEffect(() => {
        const interval = setInterval(() => {
            setHeroIndex(prev => (prev + 1) % 3);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleFavorite = (id) => {
        setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleShare = async (e, ev) => {
        e.stopPropagation();
        const text = `🔥 ¡Mira este evento: ${ev.name} en MUTUALS! \nEntradas volando...`;
        if (navigator.share) {
            try { await navigator.share({ title: ev.name, text, url: window.location.href }); }
            catch (err) { }
        }
    };

    useEffect(() => {
        fetchCurrentUser().then(u => setCurrentUser(u));
        axios.get('clubs/')
            .then(res => {
                const payload = res.data;
                setClubs(Array.isArray(payload) ? payload : (payload.results || []));
            })
            .catch(err => console.error('Error loading clubs:', err));
    }, []);

    useEffect(() => { loadEvents(); }, [searchText, visibilityFilter, isFreeFilter, orderBy, selectedClub]);

    function loadEvents() {
        setLoading(true);
        const params = {};
        if (searchText) params.search = searchText;
        if (visibilityFilter !== 'all') params.visibility = visibilityFilter;
        if (isFreeFilter) params.is_free = 'true';
        if (orderBy) params.order_by = orderBy;
        if (selectedClub) params.club = selectedClub;

        axios.get('events/', { params })
            .then(res => {
                const payload = res.data;
                setEvents(Array.isArray(payload) ? payload : (payload.results || []));
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }

    function deleteEvent(eventId, eventName) {
        if (!window.confirm(`¿Eliminar "${eventName}"?`)) return;
        axios.delete(`events/${eventId}/`)
            .then(() => setEvents(prev => prev.filter(e => e.id !== eventId)))
            .catch(err => toast.error('Error: ' + (err.response?.data?.detail || err.message)));
    }

    function isEventAdmin(event) {
        if (!currentUser) return false;
        if (currentUser.is_staff) return true;
        return event.admins?.some(a => a.id === currentUser.id);
    }

    // ─── Predictive suggestions (local filter, no extra API call) ────────────
    const suggestions = inputValue.length >= 2
        ? events.filter(ev =>
            ev.name.toLowerCase().includes(inputValue.toLowerCase()) ||
            (ev.location || '').toLowerCase().includes(inputValue.toLowerCase())
        ).slice(0, 5)
        : [];

    const handleSearchInput = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setShowSuggestions(val.length >= 2);
    };

    const commitSearch = (value) => {
        setInputValue(value);
        setSearchText(value);
        setShowSuggestions(false);
    };

    if (selectedClubId) {
        return <ClubDetail clubId={selectedClubId} onBack={() => setSelectedClubId(null)} />;
    }

    if (selectedEventId) {
        return <EventDetail
            eventId={selectedEventId}
            onBack={() => setSelectedEventId(null)}
            onViewClub={(clubId) => { setSelectedEventId(null); setSelectedClubId(clubId); }}
            onJoinLobby={props.onJoinLobby}
        />;
    }

    if (loading) {
        return (
            <div className="container slide-up" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '80px' }}>
                <div className="skeleton-box" style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', height: '400px', marginBottom: '32px' }} />
                <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', overflow: 'hidden' }}>
                    {[100, 120, 90].map((w, i) => (
                        <div key={i} className="skeleton-box" style={{ height: '44px', width: `${w}px`, borderRadius: '22px' }} />
                    ))}
                </div>
                <div className="grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton-card">
                            <div className="skeleton-box skeleton-img" />
                            <div style={{ padding: '24px' }}>
                                <div className="skeleton-box skeleton-text-1" />
                                <div className="skeleton-box skeleton-text-2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container slide-up" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '80px' }}>

            {/* ── HERO CAROUSEL ── */}
            {events.length > 0 && !searchText && visibilityFilter === 'all' && !selectedClub && (
                <div className="hero-carousel">
                    {events.slice(0, 3).map((ev, idx) => (
                        <div
                            key={ev.id}
                            className={`hero-slide ${idx === (heroIndex % Math.max(1, Math.min(events.length, 3))) ? 'active' : ''}`}
                            onClick={() => setSelectedEventId(ev.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <img src={ev.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070'} alt={ev.name} />
                            <div className="hero-slide-content">
                                <div className="hero-slide-container">
                                    <span style={{ background: 'var(--accent)', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px', display: 'inline-block' }}>Destacado</span>
                                    <h2 style={{ fontSize: '42px', color: 'white', margin: '0 0 12px', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{ev.name}</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '18px', maxWidth: '600px', margin: '0 0 24px', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                        {ev.date ? new Date(ev.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Próximamente'}
                                    </p>
                                    <button className="btn btn-shimmer" style={{ background: 'var(--text)', color: 'var(--bg)', padding: '14px 32px', fontSize: '16px' }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedEventId(ev.id); }}>
                                        Comprar Entradas
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '24px', letterSpacing: '-0.5px' }}>
                    Descubre eventos
                </h1>

                {/* ── Predictive search ── */}
                <div className="search-container" ref={searchRef} style={{ position: 'relative' }}>
                    <span className="search-icon">🔍</span>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Buscar artistas, clubs o temáticas..."
                        value={inputValue}
                        onChange={handleSearchInput}
                        onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitSearch(inputValue);
                            if (e.key === 'Escape') setShowSuggestions(false);
                        }}
                    />
                    {/* Clear button */}
                    {inputValue && (
                        <button
                            onClick={() => { setInputValue(''); setSearchText(''); setShowSuggestions(false); }}
                            style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                            aria-label="Limpiar búsqueda"
                        >✕</button>
                    )}

                    {/* Predictive dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 200,
                            background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(192,132,252,0.2)', borderRadius: 14,
                            overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                        }}>
                            {suggestions.map(ev => (
                                <div
                                    key={ev.id}
                                    onClick={() => { setSelectedEventId(ev.id); setShowSuggestions(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 14px', cursor: 'pointer',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,132,252,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                                        background: ev.image_url ? `url(${ev.image_url}) center/cover` : 'linear-gradient(135deg,#9333ea,#d946ef)',
                                    }} />
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{ev.name}</p>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {ev.date ? new Date(ev.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                                            {ev.location ? ` · 📍 ${ev.location}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pill filters */}
                <div className="pill-container">
                    <button className={`pill ${visibilityFilter === 'all' && !selectedClub && !isFreeFilter ? 'active' : ''}`}
                        onClick={() => { setVisibilityFilter('all'); setSelectedClub(''); setIsFreeFilter(false); setOrderBy('-date'); setInputValue(''); setSearchText(''); }}>
                        🔥 Todos
                    </button>
                    <button className={`pill ${visibilityFilter === 'public' ? 'active' : ''}`} onClick={() => setVisibilityFilter('public')}>🌍 Públicos</button>
                    <button className={`pill ${visibilityFilter === 'private' ? 'active' : ''}`} onClick={() => setVisibilityFilter('private')}>🔒 Exclusivos</button>
                    <button className={`pill ${isFreeFilter ? 'active' : ''}`} onClick={() => setIsFreeFilter(!isFreeFilter)}>💸 Gratis</button>
                    <button className={`pill ${orderBy === 'date' ? 'active' : ''}`} onClick={() => setOrderBy('date')}>⏳ Próximos</button>
                    {clubs.slice(0, 3).map(g => (
                        <button key={g.id} className={`pill ${selectedClub === g.id.toString() ? 'active' : ''}`}
                            onClick={() => setSelectedClub(g.id.toString())}>📂 {g.name}</button>
                    ))}
                </div>
            </div>

            {events.length === 0 ? (
                <div className="card glassmorphism" style={{ textAlign: 'center', padding: '60px 20px', border: '1px solid rgba(192,132,252,0.2)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔮</div>
                    <h3 style={{ margin: '0 0 12px', fontWeight: '800', fontSize: '24px' }}>No encontramos coincidencias</h3>
                    <p style={{ margin: '0 auto 32px', color: 'var(--muted)', maxWidth: '400px' }}>
                        Descubre los eventos más populares de esta semana.
                    </p>
                    <button className="btn btn-lg btn-shimmer"
                        style={{ background: 'var(--accent-gradient)', color: 'white', border: 'none', boxShadow: 'var(--shadow-glow)' }}
                        onClick={() => { setInputValue(''); setSearchText(''); setVisibilityFilter('all'); setSelectedClub(''); setIsFreeFilter(false); loadEvents(); }}>
                        Ver Eventos Top
                    </button>
                </div>
            ) : (
                <div className="grid">
                    {events.map(ev => (
                        <EventCard
                            key={ev.id}
                            event={ev}
                            onSelect={setSelectedEventId}
                            isFavorite={!!favorites[ev.id]}
                            onToggleFavorite={toggleFavorite}
                            onShare={handleShare}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
