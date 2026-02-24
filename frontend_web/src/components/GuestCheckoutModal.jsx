import React, { useState } from 'react';
import axios from '../api';

export default function GuestCheckoutModal({ isOpen, onClose, eventId }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post('users/send-magic-link/', {
                email: email,
                create_guest: true
            });
            setSent(true);
        } catch (err) {
            console.error("Magic link error:", err);
            setError(err.response?.data?.error || "Error al enviar el link. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay frictionless-overlay">
            <div className="modal-content glassmorphism guest-modal">
                <button className="modal-close" onClick={onClose}>&times;</button>

                {!sent ? (
                    <>
                        <div className="guest-modal-header">
                            <span className="guest-icon">🎫</span>
                            <h2 className="guest-title">Compra Instantánea</h2>
                            <p className="guest-subtitle">Recibe tu entrada por email en segundos. Sin contraseñas.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="guest-form">
                            <div className="form-group">
                                <label>Tu Email</label>
                                <input
                                    type="email"
                                    placeholder="ejemplo@correo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="guest-input"
                                    autoFocus
                                />
                            </div>

                            {error && <p className="guest-error">{error}</p>}

                            <button
                                type="submit"
                                className="btn btn-full btn-shimmer guest-submit"
                                disabled={loading}
                            >
                                {loading ? 'Enviando...' : 'Obtener mi Entrada 🚀'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="guest-success fade-in">
                        <div className="success-icon">✔️</div>
                        <h3>¡Link Enviado!</h3>
                        <p>Hemos enviado un acceso mágico a <strong>{email}</strong>.</p>
                        <p className="success-hint">Púlsalo para ver tus entradas y entrar al Lobby.</p>
                        <button className="btn btn-full" onClick={onClose}>Cerrar</button>
                    </div>
                )}
            </div>
        </div>
    );
}
