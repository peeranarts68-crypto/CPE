'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';

export default function SeniorPage() {
  const [seniorName, setSeniorName] = useState('');
  const [hints, setHints] = useState(['', '', '']);
  const [setupDone, setSetupDone] = useState(false);
  const [mySeniorName, setMySeniorName] = useState(null);
  const [hintStatuses, setHintStatuses] = useState([]);
  const [submitMsg, setSubmitMsg] = useState('');
  const trackRef = useRef(null);

  // Check if senior already set up
  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    if (username && username.startsWith('69')) {
      window.location.replace('/random');
      return;
    }

    let loggedInName = '';
    try {
      const userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null');
      if (userObj) {
        loggedInName = userObj.nickname || userObj.username || '';
      }
    } catch (_) {}

    if (!loggedInName) {
      loggedInName = username || '';
    }

    if (loggedInName) {
      setSeniorName(loggedInName);
      setMySeniorName(loggedInName);
      fetchStatus(loggedInName).then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSetupDone(true);
        }
      });
    }
  }, []);

  // Start polling when setup is done
  useEffect(() => {
    if (!setupDone || !mySeniorName) return;
    fetchStatus(mySeniorName);
    trackRef.current = setInterval(() => fetchStatus(mySeniorName), 3000);
    return () => { if (trackRef.current) clearInterval(trackRef.current); };
  }, [setupDone, mySeniorName]);

  async function fetchStatus(name) {
    try {
      const res = await fetch(`/api/get-hints?senior_name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHintStatuses(data);
        return data;
      }
    } catch (_) {}
    return [];
  }

  async function handleSetup(e) {
    e.preventDefault();
    const name = seniorName.trim();
    const [h1, h2, h3] = hints.map(h => h.trim());
    if (!name || !h1 || !h2 || !h3) { alert('กรุณากรอกข้อมูลให้ครบถ้วน!'); return; }
    setSubmitMsg('');
    try {
      const res = await fetch('/api/add-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senior_name: name, hints: [h1, h2, h3] }),
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem('cpe_senior_name', name);
        setMySeniorName(name);
        setSetupDone(true);
      } else {
        alert('เกิดข้อผิดพลาด: ' + (result.message || result.error));
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์!');
    }
  }

  async function releaseHint(hintNumber, juniorId) {
    if (!mySeniorName || !juniorId) return;
    if (!confirm(`คุณแน่ใจใช่หรือไม่ว่าต้องการเปิดเผยคำใบ้ที่ ${hintNumber} ให้กับน้องรหัสของคุณ?`)) return;
    try {
      const res = await fetch('/api/release-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senior_name: mySeniorName, hint_number: hintNumber, junior_id: juniorId }),
      });
      const result = await res.json();
      if (result.success) { alert(result.message); fetchStatus(mySeniorName); }
      else alert('ล้มเหลว: ' + (result.message || result.error));
    } catch { alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์!'); }
  }

  async function resetSetup() {
    if (!confirm('คุณแน่ใจใช่หรือไม่ว่าต้องการลบคำใบ้และรีเซ็ตสถานะการสุ่มทั้งหมดของกลุ่มคุณ?')) return;
    if (mySeniorName) {
      try {
        await fetch('/api/reset-hints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senior_name: mySeniorName }),
        });
      } catch (err) {
        console.error('Failed to reset hints database:', err);
      }
    }
    localStorage.removeItem('cpe_senior_name');
    setMySeniorName(null);
    setSetupDone(false);
    setHintStatuses([]);
    if (trackRef.current) clearInterval(trackRef.current);
  }

  // Derive juniorId from the first drawn hint
  const firstHint = hintStatuses.find(h => parseInt(h.hint_number) === 1);
  const juniorId = firstHint?.is_drawn ? firstHint.drawn_by : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', textAlign: 'center', background: 'var(--bg-color)', backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255,51,51,0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(153,0,0,0.05) 0%, transparent 40%)' }}>
      <Sidebar />

      <header className="header">
        <h1>หน้าสำหรับพี่รหัส (CPE SENIOR PORTAL)</h1>
        <p>สำหรับบันทึกคำใบ้สายรหัสและติดตามตัวตนน้องรหัสที่สุ่มได้</p>
      </header>

      {/* Setup Panel */}
      {!setupDone && (
        <div className="panel" id="setupPanel">
          <h2 className="panel-title">ลงทะเบียนคำใบ้สายรหัส</h2>
          <form onSubmit={handleSetup}>
            <div className="form-group">
              <label htmlFor="seniorName">ชื่อพี่รหัส (ล็อคตามบัญชีที่เข้าสู่ระบบ)</label>
              <input 
                id="seniorName" 
                type="text" 
                className="form-input" 
                value={seniorName} 
                readOnly 
                disabled 
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} 
                required 
              />
            </div>

            <div className="form-group" style={{ marginTop: 30 }}>
              <label style={{ color: 'var(--accent-color)' }}>ระบุคำใบ้สายรหัสของคุณ 3 อัน</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>คำใบ้นี้จะถูกนำไปสุ่มบนวงล้อนำโชคสำหรับน้องรหัส</p>
            </div>

            {[1, 2, 3].map((num, i) => (
              <div className="form-group" key={num}>
                <label htmlFor={`hint${num}`}>คำใบ้ที่ {num}</label>
                <input id={`hint${num}`} type="text" className="form-input" placeholder={`คำใบ้ที่${num === 1 ? 'หนึ่ง เช่น แว่นหนาเรียนเก่ง' : num === 2 ? 'สอง เช่น ชอบเตะฟุตบอลตอนเย็น' : 'สาม เช่น มีรถมอเตอร์ไซค์สีแดง'}`} value={hints[i]} onChange={e => { const a = [...hints]; a[i] = e.target.value; setHints(a); }} required />
              </div>
            ))}

            <button type="submit" className="submit-btn">บันทึกคำใบ้ลงระบบ</button>
          </form>
        </div>
      )}

      {/* Dashboard Panel */}
      {setupDone && (
        <div className="panel" id="dashboardPanel">
          <h2 className="panel-title">สถานะคำใบ้ของ: {mySeniorName}</h2>

          <div className="hint-status-list">
            {hintStatuses.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.95rem', padding: 20 }}>
                ไม่พบข้อมูลคำใบ้ในระบบ (อาจได้รับการรีเซ็ตฐานข้อมูล) กรุณาลงทะเบียนคำใบ้ใหม่อีกครั้ง
              </div>
            ) : hintStatuses.map((h, idx) => {
              const hintNum = parseInt(h.hint_number);
              let statusEl;
              if (hintNum === 1) {
                statusEl = h.is_drawn
                  ? <span className="badge badge-drawn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981', marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>สุ่มได้แล้วโดยน้องรหัส: <strong>{h.drawn_by_name ? `${h.drawn_by_name}(${h.drawn_by})` : h.drawn_by}</strong></span>
                  : <span className="badge badge-waiting"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b', marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>ยังไม่ถูกสุ่ม (น้องยังไม่ได้สุ่มวงล้อ)</span>;
              } else {
                if (h.is_drawn) {
                  statusEl = <span className="badge badge-drawn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981', marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>ปล่อยคำใบ้ให้สายน้องเรียบร้อยแล้ว ({h.drawn_by_name ? `${h.drawn_by_name}(${h.drawn_by})` : h.drawn_by})</span>;
                } else if (juniorId) {
                  statusEl = (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, width: '100%' }}>
                      <span className="badge badge-waiting"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9ca3af', marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>ยังไม่ได้ปล่อยคำใบ้</span>
                      <button onClick={() => releaseHint(hintNum, juniorId)} style={{ marginTop: 10, fontSize: '0.85rem', padding: '8px 14px', background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', boxShadow: '0 4px 10px rgba(16,185,129,0.2)', cursor: 'pointer', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}><path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5s3.19-1 5.5-2.5c2.31-1.5 5.5-4.5 5.5-4.5H8.5L4.5 16.5z"/><path d="M12 12c2.5-2.5 4.5-5.5 4.5-5.5L12 2 2 12l4.5 4.5s3-2 5.5-4.5z"/><path d="M9 15l3-3"/><path d="M15 9l3-3"/><path d="M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
                        กดปล่อยคำใบ้ให้สายน้อง
                      </button>
                    </div>
                  );
                } else {
                  statusEl = <span className="badge badge-waiting" style={{ opacity: 0.6 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9ca3af', marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>คำใบ้ถูกล็อค (รอให้มีน้องมาสุ่มสายคุณก่อน)</span>;
                }
              }

              return (
                <div key={h._id || idx} className="hint-status-card">
                  <div className="hint-text-display">คำใบ้ที่ {idx + 1}: <br /><span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{h.hint_text}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>{statusEl}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 30, textAlign: 'center' }}>
            <button onClick={resetSetup} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem', transition: 'color 0.2s' }}>
              ลงทะเบียนคำใบ้ใหม่ / เปลี่ยนชื่อผู้ใช้งาน
            </button>
          </div>
        </div>
      )}

      <footer>&copy; 2026 Department of Computer Engineering. All Rights Reserved.</footer>

      <style>{`
        .header { margin: 60px 0 20px; padding: 0 20px; }
        .header h1 { font-size: 2.8rem; font-weight: 800; background: linear-gradient(135deg,#fff 0%,var(--accent-color) 50%,var(--accent-purple) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; }
        .header p { color: var(--text-secondary); font-size: 1.1rem; font-weight: 300; }
        .panel { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 35px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); max-width: 650px; width: 90%; margin: 30px auto 60px; text-align: left; }
        .panel-title { font-size: 1.6rem; color: var(--accent-color); margin-bottom: 25px; border-left: 4px solid var(--accent-purple); padding-left: 15px; font-weight: 700; }
        .form-group { margin-bottom: 22px; }
        .form-group label { display: block; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .form-input { width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: var(--text-primary); font-family: inherit; font-size: 1rem; transition: all 0.3s ease; }
        .form-input:focus { outline: none; border-color: var(--accent-color); background: rgba(255,255,255,0.05); box-shadow: 0 0 15px rgba(255,51,51,0.2); }
        .submit-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-purple) 100%); border: none; border-radius: 12px; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(255,51,51,0.3); margin-top: 10px; font-family: inherit; }
        .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,51,51,0.5); }
        .hint-status-list { display: flex; flex-direction: column; gap: 20px; }
        .hint-status-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 16px; padding: 20px; transition: all 0.3s ease; }
        .hint-status-card:hover { border-color: rgba(255,51,51,0.15); background: rgba(255,255,255,0.03); }
        .hint-text-display { font-size: 1.05rem; font-weight: 500; color: var(--text-primary); margin-bottom: 12px; line-height: 1.5; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
        .badge-waiting { background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1); animation: pulse-border 2s infinite alternate; }
        @keyframes pulse-border { 0% { border-color: rgba(255,255,255,0.1); } 100% { border-color: rgba(255,51,51,0.3); } }
        .badge-drawn { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); box-shadow: 0 0 15px rgba(16,185,129,0.2); }
        footer { margin-top: auto; padding: 30px; width: 100%; color: var(--text-secondary); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
}
