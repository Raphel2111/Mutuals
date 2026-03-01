import React, { useState } from 'react';
import api from '../api';

function ProfileCompletionModal({ user, onComplete }) {
    const [firstName, setFirstName] = useState(user.first_name || '');
    const [lastName, setLastName] = useState(user.last_name || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim()) {
            setError('Por favor completa ambos campos.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.patch(`users/${user.id}/`,
                { first_name: firstName, last_name: lastName }
            );

            if (onComplete) onComplete(response.data);

        } catch (err) {
            console.error(err);
            setError('Error al actualizar el perfil.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card, var(--glass-bg))', padding: '30px', borderRadius: '10px',
                maxWidth: '400px', width: '90%', textAlign: 'center'
            }}>
                <h2 style={{ marginBottom: '10px' }}>Completa tu Perfil</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Para poder inscribirte en eventos, necesitamos saber tu nombre y apellidos.
                </p>

                {error && <div style={{ color: 'var(--danger, #ef4444)', marginBottom: '10px' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <input
                            type="text"
                            placeholder="Nombre"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            placeholder="Apellidos"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn primary"
                        style={{ width: '100%', padding: '12px' }}
                    >
                        {loading ? 'Guardando...' : 'Guardar y Continuar'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ProfileCompletionModal;
