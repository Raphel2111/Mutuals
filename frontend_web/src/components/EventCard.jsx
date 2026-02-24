import React, { useRef, useState } from 'react';
import './EventCard.css';

const STATUS_BADGES = [
    { key: 'low_stock', emoji: '🎟️', label: 'Últimas entradas', color: '#f59e0b' },
    { key: 'trending', emoji: '🔥', label: 'Tendencia', color: '#ef4444' },
    { key: 'club_only', emoji: '🏅', label: 'Solo Club', color: '#d946ef' },
    { key: 'free', emoji: '💸', label: 'Gratis', color: '#22c55e' },
];

function formatDate(dateStr) {
    if (!dateStr) return 'TBA';
    return new Date(dateStr).toLocaleDateString('es-ES', {
        weekday: 'short', day: 'numeric', month: 'short',
    }) + ' · ' + new Date(dateStr).toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit',
    });
}

export default function EventCard({ event: ev, onSelect, isFavorite, onToggleFavorite, onShare }) {
    const cardRef = useRef(null);
    const [transform, setTransform] = useState('');

    // ─── 3D tilt on mouse move (desktop only) ────────────────────────────────
    const handleMouseMove = (e) => {
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rotX = ((e.clientY - cy) / (rect.height / 2)) * -8; // max ±8deg
        const rotY = ((e.clientX - cx) / (rect.width / 2)) * 8;
        setTransform(`perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`);
    };

    const handleMouseLeave = () => setTransform('');

    // ─── Resolve which status badges to show ─────────────────────────────────
    const badges = [];
    if (!ev.is_public || ev.visibility === 'private') badges.push('club_only');
    if (!ev.price || parseFloat(ev.price) === 0) badges.push('free');
    // Simulated for demo (would come from real API fields):
    if (ev.id % 3 === 0) badges.push('trending');
    if (ev.id % 5 === 1) badges.push('low_stock');

    const imgUrl = ev.image_url
        || `https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format`;

    return (
        <article
            ref={cardRef}
            className="ec-card"
            style={{ transform }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => onSelect(ev.id)}
        >
            {/* ── Full-bleed background image ── */}
            <div
                className="ec-image"
                style={{ backgroundImage: `url(${imgUrl})` }}
            />

            {/* ── Dark gradient overlay ── */}
            <div className="ec-overlay" />

            {/* ── Status badges — top-left ── */}
            {badges.length > 0 && (
                <div className="ec-badges">
                    {badges.slice(0, 2).map(key => {
                        const meta = STATUS_BADGES.find(b => b.key === key);
                        if (!meta) return null;
                        return (
                            <span key={key} className="ec-badge" style={{ '--badge-color': meta.color }}>
                                {meta.emoji} {meta.label}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* ── Favourite button — top-right ── */}
            <button
                className={`ec-fav ${isFavorite ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(ev.id); }}
                aria-label="Guardar favorito"
            >
                {isFavorite ? '❤️' : '🤍'}
            </button>

            {/* ── Text content — bottom overlay ── */}
            <div className="ec-content">
                <p className="ec-date">{formatDate(ev.date)}</p>
                <h3 className="ec-name">{ev.name}</h3>

                {ev.location && (
                    <p className="ec-location">📍 {ev.location}</p>
                )}

                <div className="ec-footer">
                    <span className="ec-price">
                        {ev.price ? `€${parseFloat(ev.price).toFixed(2)}` : 'Gratis'}
                    </span>

                    <button
                        className="ec-share"
                        onClick={(e) => { e.stopPropagation(); onShare(e, ev); }}
                        aria-label="Compartir"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                    </button>
                </div>

                <button className="ec-cta btn-shimmer">
                    Ver evento →
                </button>
            </div>
        </article>
    );
}
