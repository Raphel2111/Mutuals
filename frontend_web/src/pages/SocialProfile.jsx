import React, { useState, useEffect } from 'react';
import axios from '../api';
import ThemePicker from '../components/ThemePicker';
import './SocialProfile.css';

const BADGE_META = {
    vip: { emoji: '⭐', label: 'Socio VIP', color: '#f59e0b' },
    founder: { emoji: '🏅', label: 'Fundador', color: '#d946ef' },
    loyal: { emoji: '💎', label: 'Asistente Fiel', color: '#3b82f6' },
    member: { emoji: '🔵', label: 'Miembro', color: '#64748b' },
};

const RING_COLOR = {
    high: '#22c55e',
    mid: '#f59e0b',
    low: '#475569',
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
}

// ─── Hero Avatar with animated neon ring ─────────────────────────────────────
function HeroAvatar({ avatarUrl, fullName, activityLevel }) {
    const color = RING_COLOR[activityLevel] || RING_COLOR.low;
    return (
        <div className="sp-avatar-wrap" style={{ '--ring-color': color }}>
            <img
                src={avatarUrl}
                alt={fullName}
                className="sp-avatar"
                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&size=200`; }}
            />
            <div className="sp-avatar-ring" />
        </div>
    );
}

// ─── Bento Badge Grid ─────────────────────────────────────────────────────────
function BadgeBento({ badges }) {
    if (!badges || badges.length === 0) {
        return <p className="sp-empty">Sin insignias aún.</p>;
    }
    return (
        <div className="sp-badge-grid">
            {badges.map((b, i) => {
                const meta = BADGE_META[b.badge] || BADGE_META.member;
                return (
                    <div key={i} className="sp-badge-card" style={{ '--badge-color': meta.color }}>
                        <span className="sp-badge-emoji">{meta.emoji}</span>
                        <div className="sp-badge-info">
                            <p className="sp-badge-label">{meta.label}</p>
                            <p className="sp-badge-club">{b.club_name}</p>
                        </div>
                        <span className="sp-badge-count">{b.events_attended} ev.</span>
                        <div className="sp-badge-shimmer" />
                    </div>
                );
            })}
        </div>
    );
}

// ─── "Visto en..." Timeline ──────────────────────────────────────────────────
function EventTimeline({ events, show }) {
    if (!show) {
        return (
            <div className="sp-privacy-notice">
                🔒 Este usuario mantiene su historial privado.
            </div>
        );
    }
    if (!events || events.length === 0) {
        return <p className="sp-empty">Sin eventos registrados aún.</p>;
    }
    return (
        <div className="sp-timeline">
            {events.map((ev, i) => (
                <div key={i} className="sp-timeline-item">
                    <div className="sp-timeline-dot" />
                    <div className="sp-timeline-body">
                        <p className="sp-timeline-name">{ev.name}</p>
                        <p className="sp-timeline-meta">
                            <span className="sp-timeline-date">{formatDate(ev.date)}</span>
                            {ev.location && <span> · 📍 {ev.location}</span>}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Interest Chips ───────────────────────────────────────────────────────────
function InterestChips({ interests, mutualIds, onClick }) {
    if (!interests || interests.length === 0) return null;
    return (
        <div className="sp-chips">
            {interests.map(tag => {
                const isMutual = mutualIds?.includes(tag.id);
                return (
                    <span
                        key={tag.id}
                        className={`sp-chip ${isMutual ? 'mutual' : ''}`}
                        onClick={() => onClick?.(tag.name)}
                        title={isMutual ? '¡Ambos tenéis este interés!' : `Ver gente interesada en #${tag.name}`}
                    >
                        #{tag.name}
                        {isMutual && <span className="mutual-dot">✨</span>}
                    </span>
                );
            })}
        </div>
    );
}

// ─── Connections Badge ────────────────────────────────────────────────────────
function ConnectionsBadge({ count, mutualEvents }) {
    return (
        <div className="sp-connections">
            <span className="sp-connections-icon">🤝</span>
            <div>
                <p className="sp-connections-count">{count}</p>
                <p className="sp-connections-label">
                    Conexiones reales
                    {mutualEvents > 0 && <span className="mutual-events"> · {mutualEvents} en común</span>}
                </p>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SocialProfile({ userId, currentUserId, onBack, onInterestClick }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [privacyLoading, setPrivacyLoading] = useState(false);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        axios.get(`users/${userId}/public_profile/`)
            .then(res => setProfile(res.data))
            .catch(() => setProfile(null))
            .finally(() => setLoading(false));
    }, [userId]);

    const togglePrivacy = async () => {
        setPrivacyLoading(true);
        try {
            const res = await axios.post(`users/${userId}/toggle_event_history/`);
            setProfile(prev => ({ ...prev, show_event_history: res.data.show_event_history }));
        } finally {
            setPrivacyLoading(false);
        }
    };

    const isOwnProfile = currentUserId && userId && String(currentUserId) === String(userId);

    if (loading) {
        return (
            <div className="sp-page">
                <div className="sp-skeleton-hero" />
                <div className="sp-skeleton-row" />
                <div className="sp-skeleton-row sp-skeleton-short" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="sp-page sp-not-found">
                <span>😶</span>
                <p>Perfil no encontrado.</p>
            </div>
        );
    }

    return (
        <div className="sp-page">
            {onBack && (
                <button className="sp-back" onClick={onBack}>← Volver</button>
            )}

            {/* ── Hero ── */}
            <div className="sp-hero">
                <HeroAvatar
                    avatarUrl={profile.avatar_url}
                    fullName={profile.full_name}
                    activityLevel={profile.activity_level}
                />
                <div className="sp-hero-info">
                    <h1 className="sp-name">{profile.full_name}</h1>
                    <p className="sp-username">@{profile.username}
                        {profile.slug && <span className="sp-slug"> · /u/{profile.slug}</span>}
                    </p>
                    {profile.bio && <p className="sp-bio">{profile.bio}</p>}
                    <ConnectionsBadge count={profile.connections_count} mutualEvents={profile.mutual_events_count} />
                </div>
            </div>

            {/* ── Interests ── */}
            {profile.interests?.length > 0 && (
                <section className="sp-section">
                    <h2 className="sp-section-title">Intereses</h2>
                    <InterestChips
                        interests={profile.interests}
                        mutualIds={profile.mutual_interests}
                        onClick={onInterestClick}
                    />
                </section>
            )}

            {/* ── Badges ── */}
            <section className="sp-section">
                <h2 className="sp-section-title">🏆 Insignias de Club</h2>
                <BadgeBento badges={profile.badges} />
            </section>

            {/* ── Visto en ── */}
            <section className="sp-section">
                <div className="sp-section-header">
                    <h2 className="sp-section-title">📍 Visto en...</h2>
                    {isOwnProfile && (
                        <button
                            className={`sp-privacy-toggle ${profile.show_event_history ? 'on' : 'off'}`}
                            onClick={togglePrivacy}
                            disabled={privacyLoading}
                            title="Mostrar/ocultar historial de eventos en perfil público"
                        >
                            {profile.show_event_history ? '👁 Público' : '🔒 Privado'}
                        </button>
                    )}
                </div>
                <EventTimeline events={profile.last_events} show={profile.show_event_history} />
            </section>

            {/* ── Theme & Settings ── */}
            {isOwnProfile && (
                <section className="sp-section" style={{ marginTop: '32px' }}>
                    <h2 className="sp-section-title">⚙️ Preferencias</h2>
                    <ThemePicker />
                </section>
            )}
        </div>
    );
}
