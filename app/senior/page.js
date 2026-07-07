'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';

export default function SeniorPage() {
  const [authorized, setAuthorized] = useState(false);
  const [seniorName, setSeniorName] = useState('');
  const [hints, setHints] = useState(['', '', '']);
  const [setupDone, setSetupDone] = useState(false);
  const [mySeniorName, setMySeniorName] = useState(null);
  const [hintStatuses, setHintStatuses] = useState([]);
  const trackRef = useRef(null);

  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    if (!username) { window.location.replace('/login'); return; }
    
    let userObj = null;
    try { userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null'); } catch (_) {}
    
    const isAdmin = username === '0611610900' || userObj?.role === 'admin';
    if (isAdmin) { window.location.replace('/admin'); return; }

    const isJunior = username.startsWith('69') || userObj?.role === 'cpe69';
    if (isJunior) { window.location.replace('/random'); return; }

    let loggedInName = '';
    if (userObj) loggedInName = userObj.nickname || userObj.username || '';
    if (!loggedInName) loggedInName = username || '';
    if (loggedInName) {
      setSeniorName(loggedInName);
      setMySeniorName(loggedInName);
      fetchStatus(loggedInName).then((data) => {
        if (Array.isArray(data) && data.length > 0) setSetupDone(true);
        setAuthorized(true);
      }).catch(() => {
        setAuthorized(true);
      });
    } else {
      setAuthorized(true);
    }
  }, []);

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
      if (Array.isArray(data)) { setHintStatuses(data); return data; }
    } catch (_) {}
    return [];
  }

  async function handleSetup(e) {
    e.preventDefault();
    const name = seniorName.trim();
    const [h1, h2, h3] = hints.map(h => h.trim());
    if (!name || !h1 || !h2 || !h3) { alert('กรุณากรอกข้อมูลให้ครบถ้วน!'); return; }
    try {
      const res = await fetch('/api/add-hint', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senior_name: name, hints: [h1, h2, h3] }),
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem('cpe_senior_name', name);
        setMySeniorName(name); setSetupDone(true);
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senior_name: mySeniorName, hint_number: hintNumber, junior_id: juniorId }),
      });
      const result = await res.json();
      if (result.success) { alert(result.message); fetchStatus(mySeniorName); }
      else alert('ล้มเหลว: ' + (result.message || result.error));
    } catch { alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์!'); }
  }

  const firstHint = hintStatuses.find(h => parseInt(h.hint_number) === 1);
  const juniorId = firstHint?.is_drawn ? firstHint.drawn_by : '';

  // Shared badge classes
  const badgeDrawn    = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.85rem] font-semibold bg-[rgba(16,185,129,0.15)] text-success border border-[rgba(16,185,129,0.3)] shadow-[0_0_15px_rgba(16,185,129,0.2)]';
  const badgeWaiting  = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[0.85rem] font-semibold bg-white/5 text-text-muted border border-white/10 badge-waiting';

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[1.2rem] font-semibold text-text-muted">
          กำลังโหลดข้อมูล...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen text-center">
      <Sidebar />

      {/* Header */}
      <header className="mt-10 mb-5 px-5 text-center">
        <h1 className="text-[2.8rem] sm:text-[2rem] font-extrabold bg-gradient-to-br from-white via-accent to-accent-deep
          bg-clip-text text-transparent mb-3 title-glow">
          หน้าสำหรับพี่รหัส (CPE SENIOR PORTAL)
        </h1>
        <p className="text-text-muted text-[1.1rem] font-light">
          สำหรับบันทึกคำใบ้สายรหัสและติดตามตัวตนน้องรหัสที่สุ่มได้
        </p>
      </header>

      {/* Setup Panel */}
      {!setupDone && (
        <div id="setupPanel" className="glass-card p-9 sm:p-6 max-w-[650px] w-[90%] mt-8 mb-16 text-left">
          <h2 className="section-title">ลงทะเบียนคำใบ้สายรหัส</h2>
          <form onSubmit={handleSetup}>
            <div className="mb-5 mt-3">
              <label className="block text-[0.9rem] text-accent mb-2 font-semibold">
                ระบุคำใบ้สายรหัสของคุณ 3 อัน
              </label>
              <p className="text-[0.8rem] text-text-muted mb-3">คำใบ้นี้จะถูกนำไปสุ่มบนวงล้อนำโชคสำหรับน้องรหัส</p>
            </div>

            {[1, 2, 3].map((num, i) => (
              <div key={num} className="mb-5">
                <label htmlFor={`hint${num}`} className="block text-[0.9rem] text-text-muted mb-2 uppercase tracking-[1px] font-semibold">
                  คำใบ้ที่ {num}
                </label>
                <input
                  id={`hint${num}`} type="text" className="form-input-field" required
                  placeholder={num === 1 ? 'คำใบ้ที่หนึ่ง เช่น แว่นหนาเรียนเก่ง' : num === 2 ? 'คำใบ้ที่สอง เช่น ชอบเตะฟุตบอลตอนเย็น' : 'คำใบ้ที่สาม เช่น มีรถมอเตอร์ไซค์สีแดง'}
                  value={hints[i]}
                  onChange={e => { const a = [...hints]; a[i] = e.target.value; setHints(a); }}
                />
              </div>
            ))}

            <button type="submit" className="submit-btn-full mt-2">บันทึกคำใบ้ลงระบบ</button>
          </form>
        </div>
      )}

      {/* Dashboard Panel */}
      {setupDone && (
        <div id="dashboardPanel" className="glass-card p-9 sm:p-6 max-w-[650px] w-[90%] mt-8 mb-16 text-left">
          <h2 className="section-title">สถานะคำใบ้สายรหัสของคุณ</h2>

          <div className="flex flex-col gap-5">
            {hintStatuses.length === 0 ? (
              <div className="text-center text-text-muted text-[0.95rem] py-5">
                ไม่พบข้อมูลคำใบ้ในระบบ (อาจได้รับการรีเซ็ตฐานข้อมูล) กรุณาลงทะเบียนคำใบ้ใหม่อีกครั้ง
              </div>
            ) : hintStatuses.map((h, idx) => {
              const hintNum = parseInt(h.hint_number);
              let statusEl;
              if (hintNum === 1) {
                statusEl = h.is_drawn
                  ? <span className={badgeDrawn}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                      สุ่มได้แล้วโดยน้องรหัส: <strong>{h.drawn_by_name ? `${h.drawn_by_name}(${h.drawn_by})` : h.drawn_by}</strong>
                    </span>
                  : <span className={badgeWaiting}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      ยังไม่ถูกสุ่ม (น้องยังไม่ได้สุ่มวงล้อ)
                    </span>;
              } else {
                if (h.is_drawn) {
                  statusEl = <span className={badgeDrawn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    ปล่อยคำใบ้ให้สายน้องเรียบร้อยแล้ว ({h.drawn_by_name ? `${h.drawn_by_name}(${h.drawn_by})` : h.drawn_by})
                  </span>;
                } else if (juniorId) {
                  statusEl = (
                    <div className="flex flex-col items-start gap-2 w-full">
                      <span className={badgeWaiting}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        ยังไม่ได้ปล่อยคำใบ้
                      </span>
                      <button
                        onClick={() => releaseHint(hintNum, juniorId)}
                        className="mt-2 flex items-center gap-1.5 px-3.5 py-2 text-[0.85rem]
                          bg-gradient-to-br from-success to-[#059669] text-white font-bold
                          border-0 rounded-lg cursor-pointer font-sans transition-all duration-200
                          hover:-translate-y-0.5 hover:shadow-[0_6px_15px_rgba(16,185,129,0.3)]"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5s3.19-1 5.5-2.5c2.31-1.5 5.5-4.5 5.5-4.5H8.5L4.5 16.5z"/>
                          <path d="M12 12c2.5-2.5 4.5-5.5 4.5-5.5L12 2 2 12l4.5 4.5s3-2 5.5-4.5z"/>
                          <path d="M9 15l3-3"/><path d="M15 9l3-3"/>
                          <path d="M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                        </svg>
                        กดปล่อยคำใบ้ให้สายน้อง
                      </button>
                    </div>
                  );
                } else {
                  statusEl = <span className={`${badgeWaiting} opacity-60`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    คำใบ้ถูกล็อค (รอให้มีน้องมาสุ่มสายคุณก่อน)
                  </span>;
                }
              }

              return (
                <div key={h._id || idx}
                  className="bg-white/[.02] border border-white/[.04] rounded-2xl p-5
                    transition-all duration-300 hover:border-[rgba(255,51,51,0.15)] hover:bg-white/[.03]">
                  <div className="text-[1.05rem] font-medium text-white mb-3 leading-[1.5]">
                    คำใบ้ที่ {idx + 1}: <br/>
                    <span className="text-accent font-semibold">{h.hint_text}</span>
                  </div>
                  <div className="flex justify-start">{statusEl}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer className="page-footer">Powerd By Computer Engineering 67 &amp; 68</footer>
    </div>
  );
}
