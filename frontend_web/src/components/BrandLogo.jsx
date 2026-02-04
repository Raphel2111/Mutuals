import React from 'react';

export default function BrandLogo() {
  return (
    <div aria-label="La Terreta logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img
        src="/logo.png"
        alt="La Terreta"
        style={{
          height: '40px',
          width: 'auto',
          objectFit: 'contain'
        }}
      />
      <span style={{
        fontWeight: 800,
        fontSize: '22px',
        color: '#1e293b',
        letterSpacing: '-0.5px'
      }}>
        La Terreta
      </span>
    </div>
  );
}
