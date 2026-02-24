import React from 'react';
import { useTheme } from '../ThemeContext';

export default function ThemePicker() {
    const { theme, changeTheme, themes } = useTheme();

    // Map theme IDs to nice display labels and preview colors
    const themeInfo = {
        dark: { label: 'Dark', color1: '#0a0a0c', color2: '#a855f7' },
        light: { label: 'Light', color1: '#f8f9fa', color2: '#3b82f6' },
        cyberpunk: { label: 'Cyberpunk', color1: '#000000', color2: '#fce700' },
        minimal: { label: 'Minimal', color1: '#e5e5e5', color2: '#171717' }
    };

    return (
        <div className="theme-picker-container" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '24px',
            padding: '20px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--border-color)',
            backdropFilter: 'blur(10px)'
        }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text)', fontWeight: '600' }}>
                Estilo Visual (Tema)
            </h4>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>
                Personaliza la apariencia de Mutuals según tu entorno o preferencia.
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {themes.map(t => {
                    const info = themeInfo[t];
                    const isActive = theme === t;

                    return (
                        <button
                            key={t}
                            onClick={() => changeTheme(t)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '12px',
                                transition: 'all 0.2s ease',
                                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                opacity: isActive ? 1 : 0.7
                            }}
                        >
                            {/* Color Sphere Preview */}
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${info.color1} 50%, ${info.color2} 50%)`,
                                border: isActive ? `3px solid var(--accent-gradient, ${info.color2})` : '2px solid transparent',
                                boxShadow: isActive ? `0 0 15px ${info.color2}66` : 'none',
                                transition: 'all 0.3s ease'
                            }} />
                            <span style={{
                                fontSize: '13px',
                                fontWeight: isActive ? '700' : '500',
                                color: isActive ? 'var(--text)' : 'var(--muted)'
                            }}>
                                {info.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
