import React from 'react';

export default function BrandLogo() {
  return (
    <div aria-label="La Terreta logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#g)" />
        <path d="M8 14c0-3.314 2.686-6 6-6 1.657 0 3 1.343 3 3h3c0-3.866-3.134-7-7-7S6 7.134 6 11s3.134 7 7 7c1.657 0 3 1.343 3 3h3c0-3.866-3.134-7-7-7-2.209 0-4-1.791-4-4z" fill="#fff" opacity="0.9" />
      </svg>
      <span style={{ fontWeight: 800, fontSize: 18, background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        La Terreta
      </span>
    </div>
  );
}
