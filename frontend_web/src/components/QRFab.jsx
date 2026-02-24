import React from 'react';
import './QRFab.css';

/**
 * QRFab — Floating Action Button for quick QR access.
 * Visible only when authenticated. Renders above BottomNavigation.
 *
 * Props:
 *   onPress : () => void  — called on click (navigate to QR view)
 */
export default function QRFab({ onPress }) {
    return (
        <button className="qrfab" onClick={onPress} aria-label="Escanear QR de entrada">
            <span className="qrfab-ring" />
            <span className="qrfab-icon" aria-hidden>
                {/* QR code icon */}
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h2v2h-2z" />
                    <path d="M18 14h3" />
                    <path d="M18 18h3" />
                    <path d="M14 18h2v3h-2" />
                </svg>
            </span>
            <span className="qrfab-label">Mi QR</span>
        </button>
    );
}
