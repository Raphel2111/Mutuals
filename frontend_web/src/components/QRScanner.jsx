import { Html5QrcodeScanner } from 'html5-qrcode';
import React, { useState, useEffect, useRef } from 'react';
import axios from '../api';

export default function QRScanner({ eventId, onBack }) {
    const [scannedCode, setScannedCode] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scanMode, setScanMode] = useState('camera'); // 'camera' or 'manual'
    const scannerRef = useRef(null);

    useEffect(() => {
        if (scanMode === 'camera' && !result) {
            // Initialize Scanner
            // Delay slightly to ensure DOM is ready
            const timer = setTimeout(() => {
                if (scannerRef.current) {
                    try {
                        scannerRef.current.clear(); // Clear existing instance if any
                    } catch (e) { } // ignore
                }

                const scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    /* verbose= */ false
                );

                scanner.render(onScanSuccess, onScanFailure);
                scannerRef.current = scanner;
            }, 500);

            return () => {
                clearTimeout(timer);
                if (scannerRef.current) {
                    try {
                        scannerRef.current.clear();
                    } catch (e) {
                        console.error("Failed to clear scanner", e);
                    }
                }
            };
        }
    }, [scanMode, result]); // Re-init if mode changes or result is cleared

    function onScanSuccess(decodedText, decodedResult) {
        // Handle the scanned code
        if (loading) return;

        // Stop scanning temporarily
        if (scannerRef.current) {
            try {
                scannerRef.current.clear();
            } catch (e) { }
        }

        setScannedCode(decodedText);
        validateQRInternal(decodedText);
    }

    function onScanFailure(error) {
        // handle scan failure, usually better to ignore and keep scanning
        // console.warn(`Code scan error = ${error}`);
    }

    function validateQRInternal(code) {
        if (!code) return;

        setLoading(true);
        setError(null);
        setResult(null);

        // Find registration by entry_code
        axios.get(`registrations/?event=${eventId}`)
            .then(res => {
                const payload = res.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);
                const registration = items.find(r => r.entry_code === code.trim());

                if (!registration) {
                    throw new Error('Código QR no encontrado para este evento');
                }

                // Validate the QR
                const validationPromise = axios.post(`registrations/${registration.id}/validate_qr/`).then(r => ({ ...r, registration }));

                // Add artificial delay for UX (prevent double tap / race conditions visually)
                const delayPromise = new Promise(resolve => setTimeout(resolve, 1500));

                return Promise.all([validationPromise, delayPromise]).then(([res]) => res);
            })
            .then(res => {
                if (res) {
                    // Start from fresh result
                    const resultData = res.data;
                    // Check if we need to attach registration info manually if backend didn't return it full
                    if (!resultData.registration && res.registration) {
                        resultData.registration = res.registration;
                    }
                    setResult(resultData);
                }
            })
            .catch(err => {
                console.error('Error validating QR:', err.response?.data || err.message);
                setError(err.response?.data?.detail || err.message || 'Error al validar QR');
            })
            .finally(() => setLoading(false));
    }

    function validateQRManual(e) {
        e.preventDefault();
        validateQRInternal(scannedCode);
    }

    function resetScan() {
        setResult(null);
        setScannedCode('');
        setError(null);
        // Will re-trigger useEffect to start camera
    }

    return (
        <div className="container">
            <button className="btn secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Volver</button>

            <div className="card">
                <h2 style={{ marginTop: 0 }}>Escanear QR de Asistente</h2>

                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <button
                        className={`btn ${scanMode === 'camera' ? 'primary' : 'secondary'}`}
                        onClick={() => { setScanMode('camera'); setResult(null); }}
                    >
                        📷 Cámara
                    </button>
                    <button
                        className={`btn ${scanMode === 'manual' ? 'primary' : 'secondary'}`}
                        onClick={() => { setScanMode('manual'); setResult(null); }}
                    >
                        ⌨️ Manual
                    </button>
                </div>

                {scanMode === 'camera' && !result && (
                    <div style={{ textAlign: 'center' }}>
                        <div id="reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}></div>
                        <p className="muted" style={{ marginTop: 10 }}>Apunta la cámara al código QR</p>
                    </div>
                )}

                {scanMode === 'manual' && !result && (
                    <form onSubmit={validateQRManual} style={{ marginTop: 20 }}>
                        <div className="form-row">
                            <label>Código QR</label>
                            <input
                                type="text"
                                value={scannedCode}
                                onChange={e => setScannedCode(e.target.value)}
                                placeholder="Escanea o pega el código aquí"
                                autoFocus
                                disabled={loading}
                            />
                        </div>
                        <button type="submit" className="btn" disabled={loading}>
                            {loading ? 'Validando...' : 'Validar QR'}
                        </button>
                    </form>
                )}

                {error && (
                    <div style={{
                        marginTop: 20,
                        padding: 12,
                        background: '#fee',
                        border: '1px solid var(--danger)',
                        borderRadius: 8,
                        color: 'var(--danger)'
                    }}>
                        <strong>❌ Error:</strong> {error}
                        <button className="btn small secondary" onClick={resetScan} style={{ marginLeft: 10 }}>Intentar de nuevo</button>
                    </div>
                )}

                {result && (
                    <div style={{
                        marginTop: 20,
                        padding: 20,
                        background: result.already_used ? '#fff3cd' : '#dcfce7',
                        border: result.already_used ? '1px solid #ffc107' : '1px solid #166534',
                        borderRadius: 8,
                        textAlign: 'center'
                    }}>
                        <h2 style={{ marginTop: 0, color: result.already_used ? '#b45309' : '#15803d' }}>
                            {result.already_used ? '⚠️ QR YA USADO' : '✅ QR VÁLIDO'}
                        </h2>

                        <div style={{ fontSize: '1.2em', margin: '10px 0' }}>
                            <strong>{result.registration?.attendee_first_name
                                ? `${result.registration.attendee_first_name} ${result.registration.attendee_last_name}`
                                : (result.registration?.user?.username || 'Usuario')}</strong>
                        </div>

                        <div style={{ margin: '10px 0', fontFamily: 'monospace', fontSize: '1.1em' }}>
                            Código: {result.registration?.entry_code}
                        </div>

                        {result.registration?.alias && (
                            <div style={{ margin: '5px 0', fontStyle: 'italic' }}>
                                Alias: {result.registration.alias}
                            </div>
                        )}

                        <div style={{ marginTop: 20 }}>
                            {result.already_used ?
                                <p>Este código fue validado previamente.</p> :
                                <p style={{ fontWeight: 'bold' }}>¡Acceso Autorizado!</p>
                            }
                        </div>

                        <button className="btn primary" onClick={resetScan} style={{ marginTop: 15, width: '100%', fontSize: '1.2em' }}>
                            Escanear Siguiente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
