import React, { useState, useEffect } from 'react';
import axios from '../api';
import { toast } from '../components/Toast';

export default function JoinClub({ token, onSuccess, onCancel }) {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('No invitation token found');
            setLoading(false);
            return;
        }

        axios.get(`clubs/invitation-info/${token}/`)
            .then(res => {
                setInfo(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching invitation info:', err);
                setError(err.response?.data?.detail || 'Invitation link is invalid or expired.');
                setLoading(false);
            });
    }, [token]);

    const handleJoin = async () => {
        setJoining(true);
        try {
            await axios.post('clubs/accept_invitation/', { token });
            onSuccess && onSuccess();
        } catch (err) {
            console.error('Error joining club:', err);
            toast.error(err.response?.data?.detail || 'Error al unirse al club.');
        } finally {
            setJoining(false);
        }
    };

    if (loading) return <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}><div className="spinner"></div><p>Validando invitación...</p></div>;

    if (error) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
                <div className="card glassmorphism" style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
                    <h2 style={{ marginBottom: '12px' }}>Invitación Inválida</h2>
                    <p style={{ color: 'var(--muted)', marginBottom: '32px' }}>{error}</p>
                    <button className="btn primary" onClick={onCancel}>Ir al inicio</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '500px', margin: '0 auto', paddingTop: '80px' }}>
            <div className="card glassmorphism" style={{ padding: '40px', textAlign: 'center', border: '1px solid var(--primary)' }}>
                <div className="club-avatar" style={{ margin: '0 auto 24px', width: '80px', height: '80px', fontSize: '32px' }}>
                    🏛️
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Has sido invitado a</h1>
                <h2 style={{ fontSize: '32px', color: 'var(--primary)', marginBottom: '16px' }}>{info.club_name}</h2>

                {info.club_description && (
                    <p className="muted" style={{ marginBottom: '32px', fontSize: '15px', lineHeight: '1.6' }}>
                        {info.club_description}
                    </p>
                )}

                <div style={{ marginBottom: '40px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                        Invitación creada por <b>@{info.created_by}</b>
                    </p>
                    {!info.valid && (
                        <p style={{ color: 'var(--danger)', marginTop: '8px', fontWeight: 'bold' }}>
                            Esta invitación ya no es válida.
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        className="btn primary btn-lg btn-shimmer"
                        onClick={handleJoin}
                        disabled={joining || !info.valid}
                        style={{ height: '56px', fontSize: '16px', fontWeight: '700' }}
                    >
                        {joining ? 'Uniéndote...' : 'Aceptar invitación y Unirse'}
                    </button>
                    <button className="btn secondary" onClick={onCancel} disabled={joining}>
                        Quizás más tarde
                    </button>
                </div>
            </div>
        </div>
    );
}
