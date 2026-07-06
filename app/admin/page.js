'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deduping, setDeduping] = useState(false);
  const [dedupeMsg, setDedupeMsg] = useState('');

  const handleDedupe = async () => {
    if (!window.confirm('ต้องการลบข้อมูลคำใบ้ที่ซ้ำกันทั้งหมดหรือไม่? ระบบจะเก็บเฉพาะอันล่าสุดของแต่ละคำใบ้')) return;
    setDeduping(true);
    setDedupeMsg('');
    try {
      const res = await fetch('/api/dedupe-hints', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDedupeMsg(`✅ ลบข้อมูลซ้ำสำเร็จ! ลบไป ${data.deleted} รายการ`);
        // Reload hints
        const res2 = await fetch('/api/admin-hints');
        const freshData = await res2.json();
        setHints(freshData);
      } else {
        setDedupeMsg('❌ เกิดข้อผิดพลาด: ' + (data.error || 'unknown'));
      }
    } catch (e) {
      setDedupeMsg('❌ เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setDeduping(false);
    }
  };

  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    // Only allow this specific user to view the page
    if (username !== '0611610900') {
      router.replace('/');
      return;
    }

    async function fetchHints() {
      try {
        const res = await fetch('/api/admin-hints');
        if (!res.ok) {
          throw new Error('Failed to fetch hints');
        }
        const data = await res.json();
        setHints(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchHints();
  }, [router]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">กำลังโหลดข้อมูล...</div>
        <style>{`
          .admin-page {
            font-family: 'Outfit', 'IBM Plex Sans Thai', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading { font-size: 1.2rem; font-weight: 600; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Background orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      
      <Link href="/" className="back-btn">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        หน้าแรก
      </Link>

      <div className="admin-container">
        <div className="admin-header">
          <h1 className="admin-title">Admin Dashboard</h1>
          <h2 className="admin-subtitle">สถานะคำใบ้ของพี่รหัสทั้งหมด ({hints.length} คน)</h2>
          <div className="dedupe-section">
            <button className="dedupe-btn" onClick={handleDedupe} disabled={deduping}>
              {deduping ? '⏳ กำลังลบ...' : '🧹 ลบข้อมูลซ้ำ (Deduplicate)'}
            </button>
            {dedupeMsg && <div className="dedupe-msg">{dedupeMsg}</div>}
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="hints-list">
          {hints.length === 0 ? (
            <div className="no-hints">ไม่มีข้อมูลคำใบ้</div>
          ) : (
            <table className="hints-table">
              <thead>
                <tr>
                  <th>พี่รหัส (Senior)</th>
                  <th>คำใบ้ที่ 1</th>
                  <th>ลบ 1</th>
                  <th>คำใบ้ที่ 2</th>
                  <th>ลบ 2</th>
                  <th>คำใบ้ที่ 3</th>
                  <th>ลบ 3</th>
                </tr>
              </thead>
              <tbody>
                {hints.map((group) => {
                  const deleteHint = async (hintId) => {
                    if (!window.confirm('คุณแน่ใจหรือว่าต้องการลบคำใบ้นี้?')) return;
                    try {
                      const res = await fetch('/api/admin-hints/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hintId }),
                      });
                      if (!res.ok) throw new Error('Delete failed');
                      // Refresh hints list after delete
                      setHints(prev => prev.map(g => {
                        if (g.senior_name !== group.senior_name) return g;
                        return { ...g, hints: g.hints.filter(h => h._id !== hintId) };
                      }));
                    } catch (e) {
                      console.error(e);
                      alert('ไม่สามารถลบคำใบ้ได้');
                    }
                  };

                  const getHintStatus = (num) => {
                    const h = group.hints.find(x => x.hint_number === num);
                    if (!h) return <div className="status-badge missing">ยังไม่สร้าง</div>;
                    
                    const hintText = <div className="hint-text-display">"{h.hint_text}"</div>;
                    
                    if (h.is_drawn) {
                      return (
                        <div className="status-container">
                          <div className="status-badge drawn">
                            <span className="icon">✅</span> ปล่อยแล้ว
                            <div className="junior-name">({h.drawn_by_name || h.drawn_by || 'น้องรหัส'})</div>
                          </div>
                          {hintText}
                        </div>
                      );
                    }
                    return (
                      <div className="status-container">
                        <div className="status-badge undrawn"><span className="icon">⏳</span> ยังไม่ปล่อย</div>
                        {hintText}
                      </div>
                    );
                  };

                  const getDeleteButton = (num) => {
                    const h = group.hints.find(x => x.hint_number === num);
                    if (!h) return null;
                    return (
                      <button className="delete-btn" onClick={() => deleteHint(h._id)} title="ลบคำใบ้">
                        🗑️
                      </button>
                    );
                  };

                  return (
                    <tr key={group.senior_name}>
                      <td className="senior-name">{group.senior_name}</td>
                      <td>{getHintStatus(1)}</td>
                      <td>{getDeleteButton(1)}</td>
                      <td>{getHintStatus(2)}</td>
                      <td>{getDeleteButton(2)}</td>
                      <td>{getHintStatus(3)}</td>
                      <td>{getDeleteButton(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .admin-page {
          font-family: 'Outfit', 'IBM Plex Sans Thai', sans-serif;
          background-color: var(--bg-color);
          color: var(--text-primary);
          min-height: 100vh;
          padding: 80px 20px 40px;
          position: relative;
          overflow-x: hidden;
        }
        .admin-page::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,51,51,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,51,51,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
        }
        .bg-orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.15; pointer-events: none; }
        .bg-orb-1 { width: 500px; height: 500px; background: radial-gradient(circle, #ff3333, transparent); top: -100px; left: -100px; }
        .bg-orb-2 { width: 400px; height: 400px; background: radial-gradient(circle, #990000, transparent); bottom: -100px; right: -100px; }
        
        .back-btn {
          position: fixed; top: 24px; left: 24px; z-index: 100;
          display: flex; align-items: center; gap: 8px;
          padding: 10px 18px;
          background: rgba(26,26,26,0.85);
          border: 1px solid rgba(255,51,51,0.25);
          border-radius: 50px;
          color: var(--text-secondary);
          font-size: 0.85rem; font-weight: 600; text-decoration: none;
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }
        .back-btn:hover { color: var(--text-primary); border-color: var(--accent-color); box-shadow: 0 0 20px rgba(255,51,51,0.25); transform: translateX(-3px); }
        .back-btn svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

        .admin-container {
          position: relative;
          z-index: 10;
          max-width: 1000px;
          margin: 0 auto;
          background: var(--card-bg);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 28px;
          padding: 40px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,51,51,0.05);
        }
        
        .admin-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .admin-title {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, var(--accent-color) 50%, var(--accent-purple) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }
        
        .admin-subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
          font-weight: 400;
        }

        .hints-list {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.2);
        }

        .hints-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 600px;
        }
        
        .hints-table th, .hints-table td {
          padding: 16px;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        
        .hints-table th {
          background: rgba(255,51,51,0.05);
          color: var(--accent-color);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.85rem;
          letter-spacing: 1px;
        }
        
        .hints-table tr:last-child td {
          border-bottom: none;
        }

        .hints-table tr:hover {
          background: rgba(255,255,255,0.03);
        }
        
        .senior-name {
          font-weight: 600;
          color: #fff;
        }
        
        .status-badge {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          text-align: center;
          min-width: 100px;
          position: relative;
        }
        .delete-btn {
          position: absolute;
          top: 2px;
          right: 2px;
          background: transparent;
          border: none;
          color: var(--accent-color);
          font-size: 0.9rem;
          cursor: pointer;
        }
        .status-badge .icon { margin-right: 4px; }
        .status-badge.missing { background: rgba(255,255,255,0.05); color: #888; }
        .status-badge.drawn { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-badge.undrawn { background: rgba(255, 165, 0, 0.15); color: #ffb84d; border: 1px solid rgba(255, 165, 0, 0.3); }
        
        .junior-name {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.6);
          margin-top: 4px;
          font-weight: 400;
        }

        .status-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hint-text-display {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.05);
          padding: 8px;
          border-radius: 8px;
          border-left: 3px solid var(--accent-color);
          font-style: italic;
          word-break: break-word;
          max-width: 250px;
        }

        .no-hints {
          text-align: center;
          padding: 50px 20px;
          color: var(--text-secondary);
          font-size: 1.1rem;
        }
        
        .error-msg {
          color: var(--accent-color);
          background: rgba(255,51,51,0.1);
          padding: 16px;
          border-radius: 12px;
          text-align: center;
          margin-bottom: 24px;
          border: 1px solid rgba(255,51,51,0.2);
        }

        .dedupe-section {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .dedupe-btn {
          padding: 10px 24px;
          background: rgba(255, 165, 0, 0.12);
          border: 1px solid rgba(255, 165, 0, 0.4);
          border-radius: 50px;
          color: #ffb84d;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          font-family: 'Outfit', 'IBM Plex Sans Thai', sans-serif;
        }
        .dedupe-btn:hover:not(:disabled) {
          background: rgba(255, 165, 0, 0.25);
          box-shadow: 0 0 16px rgba(255, 165, 0, 0.25);
          transform: translateY(-1px);
        }
        .dedupe-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dedupe-msg {
          font-size: 0.9rem;
          padding: 8px 16px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .admin-container { padding: 24px; border-radius: 20px; }
          .admin-title { font-size: 2rem; }
          .hints-table th, .hints-table td { padding: 12px; font-size: 0.9rem; }
        }
      `}</style>
    </div>
  );
}
