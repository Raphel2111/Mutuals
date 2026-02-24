import React, { useState } from 'react';
import axios from '../api';
import './ClubMembershipModal.css';
import PaymentSelectorModal from './PaymentSelectorModal';

const REASONS_MAP = {
    monthly: { label: 'Mensual', period: '/mes', savingsPct: null },
    annual: { label: 'Anual', period: '/año', savingsPct: 20 },
};

export default function ClubMembershipModal({ club, onClose, onJoined, initialStatus = null }) {
    const [selectedPlan, setSelectedPlan] = useState('monthly');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [message, setMessage] = useState('');
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);

    const isPaid = (parseFloat(club.monthly_price) > 0 || parseFloat(club.annual_price) > 0);
    // If private AND paid, user MUST be approved first before seeing payment options
    const needsApprovalFirst = club.is_private && isPaid && initialStatus !== 'approved_pending_payment';

    const priceDisplay = (plan) => {
        const p = plan === 'monthly' ? club.monthly_price : club.annual_price;
        return p ? `€${parseFloat(p).toFixed(2)}` : 'Gratis';
    };

    const benefits = club.membership_benefits
        ? club.membership_benefits.split('\n').filter(Boolean)
        : ['Acceso a eventos exclusivos del club', 'Badge de miembro', 'Red de networking del club'];

    const handleConfirm = async () => {
        setLoading(true); setError(''); setSuccess('');
        try {
            if (isPaid && !needsApprovalFirst) {
                // Time to actually pay
                setShowPaymentSelector(true);
            } else {
                // Either free, or needs approval first
                const res = await axios.post(`clubs/${club.id}/join/`, { message });
                const st = res.data.status;
                if (st === 'approved_pending_payment') {
                    // It was public but paid, so now we show payment selector directly without refreshing
                    setSuccess('');
                    setShowPaymentSelector(true);
                } else if (st === 'approved') {
                    setSuccess('¡Te has unido al club! 🎉');
                    setTimeout(() => { onJoined?.(); onClose(); }, 1400);
                } else {
                    setSuccess('¡Solicitud enviada! ✓ Los admins la revisarán pronto a través de notificaciones.');
                    setTimeout(() => { onJoined?.(); onClose(); }, 2000);
                }
            }
        } catch (err) {
            const detail = err.response?.data?.detail || err.response?.data?.error;
            setError(detail || 'No se pudo procesar la solicitud.');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentMethodSelected = async (method) => {
        setShowPaymentSelector(false);
        setLoading(true); setError(''); setSuccess('');
        try {
            if (method === 'stripe') {
                const res = await axios.post('stripe/membership/checkout/', {
                    club_id: club.id, plan: selectedPlan,
                });
                if (res.data.checkout_url) {
                    window.location.href = res.data.checkout_url;
                    return;
                }
            } else if (method === 'wallet') {
                const res = await axios.post('wallets/pay_membership/', {
                    club_id: club.id, plan: selectedPlan,
                });
                setSuccess('¡Pago con Cartera exitoso! Te has unido al club. 🎉');
                setTimeout(() => { onJoined?.(); onClose(); }, 2000);
            }
        } catch (err) {
            const detail = err.response?.data?.detail || err.response?.data?.error;
            setError(detail || 'Error procesando el pago con ' + method);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cmm-overlay" onClick={onClose}>
            <div className="cmm-modal" onClick={e => e.stopPropagation()}>
                <button className="cmm-close" onClick={onClose}>✕</button>

                {/* Club header */}
                <div className="cmm-header">
                    {club.image_url
                        ? <img src={club.image_url} alt={club.name} className="cmm-club-img" />
                        : <div className="cmm-club-initials">{club.name.slice(0, 2).toUpperCase()}</div>
                    }
                    <div>
                        <h2 className="cmm-title">Únete a {club.name}</h2>
                        <p className="cmm-sub">{club.description?.slice(0, 80) || 'Club exclusivo'}</p>
                    </div>
                </div>

                {/* Benefits */}
                <ul className="cmm-benefits">
                    {benefits.map((b, i) => (
                        <li key={i}><span className="cmm-check">✓</span> {b}</li>
                    ))}
                </ul>

                {/* Success/Error feedback */}
                {success && <div className="cmm-success">{success}</div>}
                {error && <p className="cmm-error">{error}</p>}

                {!success && (
                    <>
                        {/* Message textarea for private clubs (free or paid) */}
                        {club.is_private && (!isPaid || needsApprovalFirst) && (
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: 6 }}>
                                    Carta de presentación (opcional)
                                </label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Cuéntales quién eres y por qué quieres unirte…"
                                    rows={3}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 10, color: '#e2e8f0',
                                        padding: '10px 12px', fontSize: '0.85rem',
                                        resize: 'none', fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                        )}

                        {isPaid && !needsApprovalFirst ? (
                            <>
                                <div className="cmm-plans">
                                    {['monthly', 'annual'].map(plan => (
                                        <button key={plan}
                                            className={`cmm-plan ${selectedPlan === plan ? 'active' : ''}`}
                                            onClick={() => setSelectedPlan(plan)}
                                        >
                                            <span className="cmm-plan-label">{REASONS_MAP[plan].label}</span>
                                            <span className="cmm-plan-price">{priceDisplay(plan)}<small>{REASONS_MAP[plan].period}</small></span>
                                            {REASONS_MAP[plan].savingsPct && (
                                                <span className="cmm-badge-save">-{REASONS_MAP[plan].savingsPct}%</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="cmm-note">Pago seguro con Stripe o con Saldo Mutuals</p>
                                <button className="cmm-cta btn-shimmer" onClick={handleConfirm} disabled={loading}>
                                    {loading ? 'Redirigiendo…' : `Pagar — ${priceDisplay(selectedPlan)}${REASONS_MAP[selectedPlan].period}`}
                                </button>
                            </>
                        ) : (
                            <button className="cmm-cta btn-shimmer" onClick={handleConfirm} disabled={loading}>
                                {loading ? 'Enviando…' : (club.is_private ? '🔒 Solicitar acceso' : '+ Unirme gratis')}
                            </button>
                        )}
                    </>
                )}
            </div>

            {showPaymentSelector && (
                <PaymentSelectorModal
                    isOpen={true}
                    onClose={() => setShowPaymentSelector(false)}
                    onConfirm={handlePaymentMethodSelected}
                    amount={selectedPlan === 'monthly' ? club.monthly_price : club.annual_price}
                    title={`Membresía ${REASONS_MAP[selectedPlan].label} a ${club.name}`}
                    description="Selecciona de dónde quieres que se debite el coste."
                />
            )}
        </div>
    );
}
