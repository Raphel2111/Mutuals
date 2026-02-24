import React from 'react';

export default function BrandLogo() {
  return (
    <div aria-label="MUTUALS logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Fallback to text if logo image is missing during the transition */}
      <span style={{
        fontWeight: 900,
        fontSize: '24px',
        color: 'var(--text)',
        letterSpacing: '-1px',
        fontFamily: 'var(--font-head)'
      }}>
        MUTUALS
      </span>
      <span style={{
        color: 'var(--accent)',
        fontWeight: 900,
        fontSize: '26px'
      }}>.</span>
    </div>
  );
}
