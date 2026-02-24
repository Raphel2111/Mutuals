import React, { useState, useEffect, useRef } from 'react';
import axios from '../api';
import ClubMembershipModal from '../components/ClubMembershipModal';
import ClubDetail from './ClubDetail';
import './ClubList.css';

const FILTERS = [
    { key: 'all', label: '🔥 Todos' },
    { key: 'free', label: '💸 Gratis' },
    { key: 'paid', label: '💎 Premium' },
    { key: 'mine', label: '✅ Mis clubs' },
    { key: 'open', label: '🌍 Abiertos' },
    { key: 'private', label: '🔒 Privados' },
];

export default function ClubList() {
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [joinModal, setJoinModal] = useState(null);
    const [selectedClub, setSelectedClub] = useState(null);
    const searchRef = useRef(null);

    const loadClubs = async () => {
        try {
            const res = await axios.get('clubs/');
            setClubs(res.data.results || res.data);
        } catch (err) {
            setError('No pudimos cargar los clubes en este momento.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadClubs(); }, []);

    // ── If club detail selected, render it ──
    if (selectedClub) {
        return <ClubDetail clubId={selectedClub} onBack={() => setSelectedClub(null)} />;
    }


    // Local filter + search (no extra API calls)
    const visible = clubs.filter(c => {
        const matchText = !query ||
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            (c.description || '').toLowerCase().includes(query.toLowerCase());

        const matchFilter = (() => {
            if (filter === 'all') return true;
            if (filter === 'free') return !parseFloat(c.monthly_price) && !parseFloat(c.annual_price);
            if (filter === 'paid') return parseFloat(c.monthly_price) > 0 || parseFloat(c.annual_price) > 0;
            if (filter === 'mine') return !!c.my_membership_status; // Show approved, pending, and pending_payment
            if (filter === 'open') return !c.is_private;
            if (filter === 'private') return !!c.is_private;
            return true;
        })();

        return matchText && matchFilter;
    });

    if (loading) {
        return (
            <div className="cl-page">
                <div className="cl-header">
                    <h1 className="cl-title">Clubs</h1>
                    <div className="skeleton-box" style={{ height: 46, borderRadius: 12, marginBottom: 16 }} />
                    <div className="cl-pills">
                        {[100, 85, 90, 75, 80].map((w, i) => (
                            <div key={i} className="skeleton-box" style={{ width: w, height: 36, borderRadius: 18 }} />
                        ))}
                    </div>
                </div>
                <div className="club-grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton-card">
                            <div className="skeleton-box skeleton-img" style={{ height: 110 }} />
                            <div style={{ padding: 16 }}>
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
        <div className="cl-page">
            {/* Header */}
            <div className="cl-header">
                <h1 className="cl-title">Clubs</h1>
                <p className="cl-sub">Comunidades exclusivas, conexiones reales.</p>

                {/* Search */}
                <div className="cl-search-wrap" ref={searchRef}>
                    <span className="cl-search-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <input
                        className="cl-search"
                        type="text"
                        placeholder="Buscar clubs o comunidades…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="cl-search-clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">✕</button>
                    )}
                </div>

                {/* Filter pills */}
                <div className="cl-pills">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            className={`pill ${filter === f.key ? 'active' : ''}`}
                            onClick={() => setFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            {/* Results */}
            {visible.length === 0 ? (
                <div className="cl-empty">
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🔭</div>
                    <h3>Sin resultados</h3>
                    <p>Prueba otra búsqueda o cambia el filtro.</p>
                    <button className="btn btn-shimmer" style={{ width: 'auto', marginTop: 16, background: 'var(--accent-gradient)', color: 'white', border: 'none', boxShadow: 'var(--shadow-glow)' }}
                        onClick={() => { setQuery(''); setFilter('all'); }}>
                        Ver todos los clubs
                    </button>
                </div>
            ) : (
                <>
                    <p className="cl-count">{visible.length} club{visible.length !== 1 ? 's' : ''}</p>
                    <div className="club-grid">
                        {visible.map(club => (
                            <ClubCard
                                key={club.id}
                                club={club}
                                onJoin={() => setJoinModal(club)}
                                onOpen={() => setSelectedClub(club.id)}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Membership Modal */}
            {joinModal && (
                <ClubMembershipModal
                    club={joinModal}
                    onClose={() => setJoinModal(null)}
                    onJoined={() => { loadClubs(); setJoinModal(null); }}
                />
            )}
        </div>
    );
}

// ── Club Card ────────────────────────────────────────────────────────────────
function ClubCard({ club, onJoin, onOpen }) {
    const isPaid = parseFloat(club.monthly_price) > 0 || parseFloat(club.annual_price) > 0;
    const priceLabel = isPaid
        ? `€${parseFloat(club.monthly_price || club.annual_price).toFixed(0)}/mes`
        : 'Gratis';

    return (
        <div className="club-card glassmorphism" onClick={onOpen} style={{ cursor: 'pointer' }}>
            {/* Accent stripe */}
            <div className="club-stripe" style={{
                background: isPaid
                    ? 'linear-gradient(90deg, #d946ef, #9333ea)'
                    : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
            }} />

            {/* Avatar / initials */}
            <div className="club-avatar">
                {club.image_url
                    ? <img src={club.image_url} alt={club.name} className="club-avatar-img" />
                    : <div className="club-avatar-initials">{club.name.slice(0, 2).toUpperCase()}</div>
                }
            </div>

            {/* Badges */}
            <div className="club-badges">
                {club.is_private && <span className="club-badge badge-private">🔒 Privado</span>}
                {isPaid && <span className="club-badge badge-paid">💎 {priceLabel}</span>}

                {/* Status Badges */}
                {club.my_membership_status === 'approved' && <span className="club-badge badge-member">✅ Miembro</span>}
                {club.my_membership_status === 'pending' && <span className="club-badge badge-member" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>⏳ Pendiente</span>}
                {club.my_membership_status === 'approved_pending_payment' && <span className="club-badge badge-member" style={{ background: 'rgba(217, 70, 239, 0.15)', color: '#d946ef', border: '1px solid rgba(217, 70, 239, 0.3)' }}>💳 Falta Pago</span>}
            </div>

            <div className="club-content">
                <h3 className="club-title">{club.name}</h3>
                <p className="club-desc">{club.description || 'Sin descripción disponible.'}</p>

                <div className="club-meta">
                    <span className="member-count">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        {club.members_count ?? '—'} miembros
                    </span>
                    {club.my_badge && club.my_membership_status === 'approved' && (
                        <span className="badge-highlight">🏅 {club.my_badge.toUpperCase()}</span>
                    )}
                </div>

                {club.my_membership_status === 'approved' ? (
                    <button className="btn btn-shimmer full-width" onClick={(e) => { e.stopPropagation(); onOpen && onOpen(); }}
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none' }}>
                        Entrar al club →
                    </button>
                ) : club.my_membership_status === 'approved_pending_payment' ? (
                    <button className="btn btn-shimmer full-width" onClick={(e) => { e.stopPropagation(); onJoin && onJoin(); }}
                        style={{ background: 'linear-gradient(135deg, #d946ef, #9333ea)', color: 'white', border: 'none' }}>
                        Pagar Suscripción
                    </button>
                ) : club.my_membership_status === 'pending' ? (
                    <button className="btn full-width" disabled style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'not-allowed' }}>
                        En revisión...
                    </button>
                ) : (
                    <button className="btn btn-shimmer full-width" onClick={(e) => { e.stopPropagation(); onJoin && onJoin(); }}
                        style={{ background: 'linear-gradient(135deg, #d946ef, #9333ea)', color: 'white', border: 'none' }}>
                        {club.is_private ? '🔒 Solicitar acceso' : '+ Unirse'}
                    </button>
                )}
            </div>
        </div>
    );
}
