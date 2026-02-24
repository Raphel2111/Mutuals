import React, { useState } from 'react';
import axios from '../api';
import './ReportModal.css';

const REASONS = [
    { value: 'spam', label: '📢 Spam o contenido repetitivo' },
    { value: 'inappropriate', label: '🔞 Contenido inapropiado' },
    { value: 'harassment', label: '😡 Acoso o comportamiento abusivo' },
    { value: 'fake', label: '🎭 Perfil falso o suplantación' },
    { value: 'other', label: '⚠️ Otro motivo' },
];

/**
 * ReportModal — universal report dialog.
 *
 * Props:
 *   modelName  : 'user' | 'eventphoto' | 'club' | 'event'
 *   objectId   : number
 *   targetLabel: string — shown in the title ("Reportar @rafael")
 *   onClose    : () => void
 */
export default function ReportModal({ modelName, objectId, targetLabel, onClose }) {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) { setError('Por favor selecciona un motivo.'); return; }
        setLoading(true); setError('');
        try {
            await axios.post('reports/', {
                model_name: modelName,
                object_id: objectId,
                reason,
                description,
            });
            setSuccess(true);
            setTimeout(onClose, 2500);
        } catch (err) {
            const msg = err.response?.data?.non_field_errors?.[0]
                || err.response?.data?.detail
                || 'Error al enviar el reporte.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rm-overlay" onClick={onClose}>
            <div className="rm-modal" onClick={e => e.stopPropagation()}>
                <button className="rm-close" onClick={onClose}>✕</button>

                {success ? (
                    <div className="rm-success">
                        <span>✅</span>
                        <p>Reporte enviado. Nuestro equipo lo revisará en 24h.</p>
                    </div>
                ) : (
                    <>
                        <h2 className="rm-title">🚨 Reportar</h2>
                        {targetLabel && <p className="rm-target">{targetLabel}</p>}

                        <form onSubmit={handleSubmit}>
                            <div className="rm-reasons">
                                {REASONS.map(r => (
                                    <label
                                        key={r.value}
                                        className={`rm-reason ${reason === r.value ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="reason"
                                            value={r.value}
                                            checked={reason === r.value}
                                            onChange={() => setReason(r.value)}
                                        />
                                        {r.label}
                                    </label>
                                ))}
                            </div>

                            <textarea
                                className="rm-desc"
                                placeholder="Descripción adicional (opcional)"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                                maxLength={500}
                            />

                            {error && <p className="rm-error">{error}</p>}

                            <button
                                type="submit"
                                className="rm-submit"
                                disabled={loading}
                            >
                                {loading ? 'Enviando...' : 'Enviar reporte'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
