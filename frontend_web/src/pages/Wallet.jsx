import React, { useEffect, useState } from 'react';
import axios from '../api';

export default function Wallet() {
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddFunds, setShowAddFunds] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadWallet();

        // Manejar retornos de Stripe Connect / Checkout
        const params = new URLSearchParams(window.location.search);
        if (params.get('wallet_success')) {
            alert('¡Recarga iniciada con éxito! Tu saldo se actualizará en breve una vez que Stripe procese el pago.');
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('wallet_cancel')) {
            alert('El proceso de recarga ha sido cancelado.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    function loadWallet() {
        setLoading(true);
        axios.get('wallets/my_wallet/')
            .then(res => {
                setWallet(res.data);
                // Cargar transacciones
                return axios.get(`wallets/${res.data.id}/transactions/`);
            })
            .then(res => {
                setTransactions(res.data);
            })
            .catch(err => {
                console.error('Error loading wallet:', err);
                alert('Error al cargar la billetera: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setLoading(false));
    }

    function handleAddFunds(e) {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) {
            alert('Por favor ingresa un monto válido');
            return;
        }

        setProcessing(true);
        axios.post(`wallets/${wallet.id}/add_funds/`, {
            amount: parseFloat(amount),
            description: description || 'Depósito de fondos'
        })
            .then(res => {
                if (res.data.checkout_url) {
                    window.location.href = res.data.checkout_url;
                } else {
                    alert('Error inesperado: Stripe checkout URL no recibida.');
                    setProcessing(false);
                }
            })
            .catch(err => {
                console.error('Error adding funds:', err);
                alert('Error al conectar con la pasarela de pago: ' + (err.response?.data?.detail || err.message));
                setProcessing(false);
            });
    }

    if (loading) {
        return (
            <div className="container">
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--muted)' }}>Cargando billetera...</p>
                </div>
            </div>
        );
    }

    if (!wallet) {
        return (
            <div className="container">
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--muted)' }}>No se pudo cargar la billetera</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>💰 Mi Billetera</h1>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                    Gestiona tu saldo y visualiza tus transacciones
                </p>
            </div>

            {/* Balance Card */}
            <div className="card" style={{
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '32px'
            }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', opacity: 0.9 }}>Saldo disponible</p>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '42px', fontWeight: '700' }}>
                    ${parseFloat(wallet.balance).toFixed(2)} {wallet.currency}
                </h2>
                <button
                    className="btn"
                    onClick={() => setShowAddFunds(!showAddFunds)}
                    style={{
                        backgroundColor: 'white',
                        color: '#667eea',
                        fontWeight: '600',
                        border: 'none'
                    }}
                >
                    ➕ Agregar Fondos
                </button>
            </div>

            {/* Formulario para agregar fondos */}
            {showAddFunds && (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px', fontWeight: '600' }}>Agregar Fondos</h3>
                    <form onSubmit={handleAddFunds}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                                Monto ({wallet.currency})
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Ej: 50.00"
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    fontSize: '14px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px'
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                                Descripción (opcional)
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ej: Recarga mensual"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    fontSize: '14px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="submit" className="btn" disabled={processing} style={{ flex: 1 }}>
                                {processing ? 'Procesando...' : 'Confirmar Depósito'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddFunds(false)}
                                className="btn"
                                style={{ backgroundColor: '#6b7280', borderColor: '#4b5563' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Historial de transacciones */}
            <div className="card">
                <h3 style={{ marginTop: 0, fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                    📋 Historial de Transacciones
                </h3>
                {transactions.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
                        No hay transacciones registradas
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {transactions.map(tx => (
                            <div
                                key={tx.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0'
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '18px' }}>
                                            {tx.transaction_type === 'deposit' ? '💵' :
                                                tx.transaction_type === 'payment' ? '🎟️' :
                                                    tx.transaction_type === 'refund' ? '↩️' : '💸'}
                                        </span>
                                        <span style={{ fontWeight: '600', fontSize: '14px' }}>
                                            {tx.transaction_type === 'deposit' ? 'Depósito' :
                                                tx.transaction_type === 'payment' ? 'Pago' :
                                                    tx.transaction_type === 'refund' ? 'Reembolso' : 'Retiro'}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                        {tx.description}
                                    </p>
                                    {tx.event_name && (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#2563eb' }}>
                                            🎫 {tx.event_name}
                                        </p>
                                    )}
                                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                                        {new Date(tx.created_at).toLocaleString('es-ES')}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '16px',
                                        fontWeight: '700',
                                        color: parseFloat(tx.amount) >= 0 ? '#059669' : '#dc2626'
                                    }}>
                                        {parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(2)} {wallet.currency}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                                        Saldo: ${parseFloat(tx.balance_after).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
