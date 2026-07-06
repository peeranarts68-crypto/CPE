'use client';
import { useState } from 'react';

export default function BackupPage() {
  const [status, setStatus]   = useState('idle'); // idle | loading | done | error
  const [result, setResult]   = useState(null);
  const [seedMsg, setSeedMsg] = useState('');

  // ── ดึงข้อมูลจาก DB ──────────────────────────────────────
  async function handleBackup() {
    setStatus('loading');
    setSeedMsg('');
    setResult(null);
    try {
      const res  = await fetch('/api/backup');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Unknown error');
      setResult(data);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setResult({ error: err.message });
    }
  }

  // ── download JSON ─────────────────────────────────────────
  function handleDownload() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cpe-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── seed เข้า dummy store (runtime) ──────────────────────
  async function handleSeedDummy() {
    if (!result?.hints) return;
    setSeedMsg('กำลัง seed...');
    try {
      const res  = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hints: result.hints, users: result.users || [] }),
      });
      const data = await res.json();
      setSeedMsg(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
    } catch (err) {
      setSeedMsg(`❌ ${err.message}`);
    }
  }

  // ── copy DUMMY_HINTS snippet ──────────────────────────────
  function handleCopySnippet() {
    if (!result?.hints) return;
    const snippet =
      `// วาง array นี้ทับ DUMMY_HINTS ใน lib/dummy-data.js\n` +
      `export const DUMMY_HINTS = ${JSON.stringify(result.hints, null, 2)};\n`;
    navigator.clipboard.writeText(snippet);
    setSeedMsg('✅ คัดลอก DUMMY_HINTS snippet ไปยัง clipboard แล้ว!');
  }

  // ── badge ─────────────────────────────────────────────────
  const hintCount = result?.hints?.length ?? 0;
  const userCount = result?.users?.length ?? 0;
  const source    = result?.source ?? '';

  return (
    <div style={styles.page}>
      {/* header */}
      <header style={styles.header}>
        <div style={styles.pill}>🛠️ DEV TOOL</div>
        <h1 style={styles.title}>DB Backup</h1>
        <p style={styles.subtitle}>
          ดึงข้อมูล hints &amp; users ทั้งหมดออกมา เพื่อใช้เป็น dummy data สำหรับ local testing
        </p>
      </header>

      {/* main card */}
      <div style={styles.card}>
        {/* big backup button */}
        <button
          id="backupBtn"
          style={{ ...styles.bigBtn, ...(status === 'loading' ? styles.bigBtnLoading : {}) }}
          onClick={handleBackup}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <>
              <span style={styles.spinner} />
              กำลังดึงข้อมูล...
            </>
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Backup Data from DB
            </>
          )}
        </button>

        {/* result panel */}
        {status === 'done' && result && (
          <div style={styles.resultPanel}>
            {/* stats */}
            <div style={styles.statsRow}>
              <div style={styles.statBox}>
                <div style={styles.statNum}>{hintCount}</div>
                <div style={styles.statLabel}>hints</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statNum}>{userCount}</div>
                <div style={styles.statLabel}>users</div>
              </div>
              <div style={{ ...styles.statBox, borderColor: source === 'firestore' ? '#10b981' : '#f59e0b' }}>
                <div style={{ ...styles.statNum, fontSize: '1rem', color: source === 'firestore' ? '#10b981' : '#f59e0b' }}>
                  {source === 'firestore' ? '🔥 Firestore' : '🧪 Dummy'}
                </div>
                <div style={styles.statLabel}>source</div>
              </div>
            </div>

            {/* action buttons */}
            <div style={styles.actionRow}>
              <button id="downloadBtn" style={styles.actionBtn} onClick={handleDownload}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download JSON
              </button>
              <button id="copySnippetBtn" style={{ ...styles.actionBtn, ...styles.actionBtnYellow }} onClick={handleCopySnippet}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                Copy DUMMY_HINTS snippet
              </button>
              <button id="seedBtn" style={{ ...styles.actionBtn, ...styles.actionBtnGreen }} onClick={handleSeedDummy}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/>
                </svg>
                Load into Dummy Store (runtime)
              </button>
            </div>

            {seedMsg && (
              <div style={styles.seedMsg}>{seedMsg}</div>
            )}

            {/* JSON preview */}
            <details style={styles.details}>
              <summary style={styles.summary}>ดู JSON preview ({hintCount} hints)</summary>
              <pre style={styles.pre}>{JSON.stringify(result.hints?.slice(0, 5), null, 2)}
{hintCount > 5 ? `\n... และอีก ${hintCount - 5} hints` : ''}</pre>
            </details>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.errorBox}>
            ❌ เกิดข้อผิดพลาด: {result?.error}
            <br />
            <small style={{ opacity: 0.7 }}>ตรวจสอบว่า env ครบ หรือลอง set USE_DUMMY=true แล้วกด Backup ใหม่</small>
          </div>
        )}
      </div>

      {/* how-to */}
      <div style={styles.howto}>
        <h2 style={styles.howtoTitle}>📋 วิธีใช้สำหรับ local testing</h2>
        <ol style={styles.steps}>
          <li><strong>บน host</strong> (ที่เชื่อม DB ได้): เปิด <code>/backup</code> แล้วกดปุ่ม Backup → Download JSON</li>
          <li><strong>บน local</strong>: ก็อป array จาก JSON แล้ว paste ทับ <code>DUMMY_HINTS</code> ใน <code>lib/dummy-data.js</code></li>
          <li>เพิ่ม <code>USE_DUMMY=true</code> ใน <code>.env.local</code> ของเครื่อง local</li>
          <li>รัน <code>npm run dev</code> — ทุก API จะใช้ in-memory dummy store แทน Firestore</li>
        </ol>
        <div style={styles.tip}>
          💡 <strong>หรือ</strong> ถ้าใช้แค่ default dummy data ใน <code>lib/dummy-data.js</code>:<br/>
          login ด้วย <code>6800000001</code> (senior) หรือ <code>6900000001</code> (junior) password: <code>password123</code>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── inline styles ─────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#0b0f19',
    backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,51,51,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(99,102,241,0.06) 0%, transparent 50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    fontFamily: "'Outfit', 'IBM Plex Sans Thai', sans-serif",
    color: '#f1f5f9',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
  },
  pill: {
    display: 'inline-block',
    padding: '4px 14px',
    background: 'rgba(255,51,51,0.15)',
    border: '1px solid rgba(255,51,51,0.3)',
    borderRadius: 20,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#ff6b6b',
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: '2.8rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #fff 0%, #ff3333 50%, #818cf8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 12px',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '1rem',
    maxWidth: 480,
    margin: '0 auto',
    lineHeight: 1.6,
  },
  card: {
    background: 'rgba(15,20,35,0.8)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 40,
    width: '100%',
    maxWidth: 640,
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
  },
  bigBtn: {
    width: '100%',
    padding: '20px 32px',
    background: 'linear-gradient(135deg, #ff3333 0%, #cc0000 100%)',
    border: 'none',
    borderRadius: 16,
    color: '#fff',
    fontSize: '1.15rem',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    boxShadow: '0 8px 24px rgba(255,51,51,0.4)',
    transition: 'all 0.25s ease',
    fontFamily: 'inherit',
  },
  bigBtnLoading: {
    background: 'rgba(255,51,51,0.3)',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
  spinner: {
    width: 22,
    height: 22,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },
  resultPanel: {
    marginTop: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  statsRow: {
    display: 'flex',
    gap: 14,
  },
  statBox: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '16px 12px',
    textAlign: 'center',
  },
  statNum: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: '0.78rem',
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: 1,
    minWidth: 140,
    padding: '10px 16px',
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 10,
    color: '#a5b4fc',
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  actionBtnYellow: {
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.3)',
    color: '#fcd34d',
  },
  actionBtnGreen: {
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#6ee7b7',
  },
  seedMsg: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: '0.9rem',
    color: '#94a3b8',
  },
  details: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '12px 16px',
  },
  summary: {
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: '#64748b',
    fontWeight: 600,
    userSelect: 'none',
  },
  pre: {
    marginTop: 12,
    fontSize: '0.78rem',
    color: '#94a3b8',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: 1.6,
    maxHeight: 280,
    overflowY: 'auto',
  },
  errorBox: {
    marginTop: 20,
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 12,
    padding: '16px 20px',
    color: '#fca5a5',
    fontSize: '0.9rem',
    lineHeight: 1.7,
  },
  howto: {
    marginTop: 36,
    background: 'rgba(15,20,35,0.6)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 640,
  },
  howtoTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: 16,
  },
  steps: {
    color: '#94a3b8',
    lineHeight: 2,
    paddingLeft: 20,
    fontSize: '0.9rem',
  },
  tip: {
    marginTop: 18,
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: '0.88rem',
    color: '#a5b4fc',
    lineHeight: 1.7,
  },
};
