import React from 'react';

export default function BottomNavigation({ activeView, onNavigate, authenticated }) {
    return (
        <div className="bottom-nav">
            <button
                className={`bottom-nav-item ${activeView === 'events' ? 'active' : ''}`}
                onClick={() => onNavigate('events')}
            >
                <div className="icon">📅</div>
                <div className="label">Eventos</div>
            </button>

            <button
                className={`bottom-nav-item ${activeView === 'registrations' ? 'active' : ''}`}
                onClick={() => onNavigate('registrations')}
            >
                <div className="icon">🎟️</div>
                <div className="label">Entradas</div>
            </button>

            <button
                className={`bottom-nav-item ${activeView === 'groups' ? 'active' : ''}`}
                onClick={() => onNavigate('groups')}
            >
                <div className="icon">👥</div>
                <div className="label">Grupos</div>
            </button>

            <button
                className={`bottom-nav-item ${activeView === 'profile' ? 'active' : ''}`}
                onClick={() => onNavigate('profile')}
            >
                <div className="icon">👤</div>
                <div className="label">Perfil</div>
            </button>
        </div>
    );
}
