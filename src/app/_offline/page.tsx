'use client';

export default function OfflinePage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Inter, sans-serif',
        background: 'linear-gradient(135deg, #6B46C1 0%, #553C9A 100%)',
        color: 'white',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>♫</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
        You're offline
      </h1>
      <p style={{ fontSize: '1rem', opacity: 0.8, maxWidth: '360px', lineHeight: 1.6 }}>
        No internet connection detected. Check your connection and try again — your data is safely saved in the cloud.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '2rem',
          padding: '0.75rem 2rem',
          borderRadius: '9999px',
          border: '2px solid rgba(255,255,255,0.6)',
          background: 'transparent',
          color: 'white',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
