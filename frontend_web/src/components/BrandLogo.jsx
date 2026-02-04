import React from 'react';

export default function BrandLogo() {
  return (
    <div aria-label="Eventy logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img
        src="/logo.png"
        alt="Eventy"
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
        Eventy
      </span>
    </div>
  );
}
