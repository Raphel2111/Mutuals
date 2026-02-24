import React from 'react';

const NAV_ITEMS = [
    {
        key: 'events',
        label: 'Eventos',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                {active && <circle cx="8" cy="15" r="1.5" fill="currentColor" stroke="none" />}
                {active && <circle cx="16" cy="15" r="1.5" fill="currentColor" stroke="none" />}
            </svg>
        ),
    },
    {
        key: 'registrations',
        label: 'Entradas',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                <path d="M13 5v14" strokeDasharray="3 2" />
            </svg>
        ),
    },
    {
        key: 'clubs',
        label: 'Clubs',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        key: 'radar',
        label: 'Radar',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2" fill={active ? 'currentColor' : 'none'} />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                <path d="M7.76 7.76a6 6 0 0 0 0 8.49" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
        ),
    },
    {
        key: 'wallet',
        label: 'Cartera',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
        ),
    },
    {
        key: 'profile',
        label: 'Perfil',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" fill={active ? 'currentColor' : 'none'} />
            </svg>
        ),
    },
];


export default function BottomNavigation({ activeView, onNavigate, authenticated }) {
    if (!authenticated) return null;

    return (
        <nav className="bottom-nav glassmorphism" aria-label="Navegación principal">
            {NAV_ITEMS.map(({ key, label, icon }) => {
                const isActive = activeView === key;
                return (
                    <button
                        key={key}
                        className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => onNavigate(key)}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={label}
                    >
                        <span className="bn-icon-wrap">
                            {icon(isActive)}
                            {isActive && <span className="bn-active-dot" />}
                        </span>
                        <span className="bn-label">{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
