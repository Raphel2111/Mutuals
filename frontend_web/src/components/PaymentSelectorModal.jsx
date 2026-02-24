import React, { useState, useEffect } from 'react';
import axios from '../api';
import './PaymentSelectorModal.css';

export default function PaymentSelectorModal({ isOpen, onClose, onConfirm, amount, title, description }) {
    const [wallet, setWallet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedMethod, setSelectedMethod] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        axios.get('wallets/my_wallet/')
            .then(res => {
                const walletData = res.data;
                setWallet(walletData);

                // Proactive selection: if wallet has enough balance, select it by default
                const numericAmount = parseFloat(amount || 0);
                const walletBalance = parseFloat(walletData.balance || 0);
                if (walletBalance >= numericAmount) {
                    setSelectedMethod('wallet');
                } else {
                    setSelectedMethod('stripe');
                }
            })
            .catch(err => {
                console.error('Error fetching wallet:', err);
                setSelectedMethod('stripe'); // Fallback
            })
            .finally(() => setLoading(false));
    }, [isOpen, amount]);

    if (!isOpen) return null;

    const numericAmount = parseFloat(amount || 0);
    const walletBalance = wallet ? parseFloat(wallet.balance) : 0;
    const canUseWallet = walletBalance >= numericAmount;

    function handleConfirm() {
        if (selectedMethod) {
            onConfirm(selectedMethod);
        }
    }

    return (
        <div className="payment-modal-overlay">
            <div className="payment-modal-content card glassmorphism">
                <button className="payment-modal-close" onClick={onClose}>&times;</button>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Elige método de pago</h2>
                    {title && <p style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '15px' }}>{title}</p>}
                    {description && <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>{description}</p>}
                    <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary)', marginTop: '16px' }}>
                        €{numericAmount.toFixed(2)}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <p style={{ color: 'var(--muted)' }}>Cargando opciones...</p>
                    </div>
                ) : (
                    <div className="payment-options">
                        {/* WALLET OPTION (Prioritized) */}
                        <div
                            className={`payment-option ${selectedMethod === 'wallet' ? 'selected' : ''} ${!canUseWallet ? 'disabled' : ''} ${canUseWallet ? 'recommended' : ''}`}
                            onClick={() => {
                                if (canUseWallet) setSelectedMethod('wallet');
                            }}
                        >
                            <div className="payment-option-icon">💜</div>
                            <div className="payment-option-details">
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    Saldo Mutuals
                                    {canUseWallet && <span className="recommended-badge">RECOMENDADO</span>}
                                </h4>
                                <p>
                                    Disponible: €{walletBalance.toFixed(2)}
                                    {!canUseWallet && <span style={{ color: 'var(--danger)', display: 'block', fontSize: '11px', marginTop: '2px' }}>Saldo insuficiente</span>}
                                </p>
                            </div>
                            <div className="payment-option-radio">
                                <div className="radio-inner"></div>
                            </div>
                        </div>

                        {/* STRIPE OPTION */}
                        <div
                            className={`payment-option ${selectedMethod === 'stripe' ? 'selected' : ''}`}
                            onClick={() => setSelectedMethod('stripe')}
                        >
                            <div className="payment-option-icon">💳</div>
                            <div className="payment-option-details">
                                <h4>Tarjeta de Crédito / Stripe</h4>
                                <p>Pago seguro externo</p>
                            </div>
                            <div className="payment-option-radio">
                                <div className="radio-inner"></div>
                            </div>
                        </div>

                        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
                            <button
                                className="btn primary btn-shimmer"
                                disabled={!selectedMethod}
                                onClick={handleConfirm}
                                style={{ flex: 1 }}
                            >
                                Proceder a Pagar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
