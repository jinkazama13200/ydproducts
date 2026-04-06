import React, { useState, useEffect } from 'react';

export default function AppSimple() {
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('webCfg', JSON.stringify({ token }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    console.log('✅ Saved token:', token);
  };

  return (
    <div style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>
      <h1>🧪 Test Token Save</h1>
      <div style={{ marginTop: 20 }}>
        <label>Token: </label>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Enter token"
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', width: 300 }}
        />
      </div>
      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          💾 Save
        </button>
      </div>
      {saved && (
        <div style={{
          marginTop: 20,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(16, 185, 129, 0.9)',
          color: 'white',
          fontWeight: 600
        }}>
          ✅ Settings saved!
        </div>
      )}
    </div>
  );
}
