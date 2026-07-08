'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';

export default function MyHintPage() {
  const [authorized, setAuthorized] = useState(false);
  const [juniorId, setJuniorId] = useState('');
  const [juniorData, setJuniorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const loadHints = useCallback(async (id = juniorId) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/get-junior-hints?junior_id=${encodeURIComponent(id)}&t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setJuniorData(data);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [juniorId]);

  // Auth checking and polling
  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    if (!username) {
      window.location.replace('/login');
      return;
    }

    let userObj = null;
    try {
      userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null');
    } catch (_) {}

    const isAdmin = username === '0611610900' || userObj?.role === 'admin';
    if (isAdmin) {
      window.location.replace('/admin');
      return;
    }

    const senior = username.startsWith('68') || userObj?.role === 'cpe68';
    if (senior) {
      window.location.replace('/senior');
      return;
    }

    setJuniorId(username);
    setAuthorized(true);
    
    // Initial load
    loadHints(username);

    // Poll for new released hints every 60 seconds (1 minute)
    pollRef.current = setInterval(() => {
      // Background reload (silent load without triggering the full spinner)
      fetch(`/api/get-junior-hints?junior_id=${encodeURIComponent(username)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setJuniorData(data);
          }
        })
        .catch(() => {});
    }, 60000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [loadHints]);

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
      <header className="mt-10 mb-5 px-4">
        <h1 className="text-[2.5rem] sm:text-[1.8rem] font-extrabold bg-gradient-to-br from-white via-accent to-accent-deep
          bg-clip-text text-transparent mb-2.5">
          คำใบ้สายรหัสของคุณ
        </h1>
        <p className="text-text-muted text-[1.1rem]">ติดตามคำใบ้และตัวตนของพี่รหัสของคุณได้ที่นี่</p>
      </header>

      {/* Main Area */}
      <main className="w-full flex flex-col items-center px-4">
        {loading && !juniorData ? (
          <div className="flex flex-col items-center justify-center h-[200px] w-full">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-[1.1rem] font-semibold text-text-muted">
              กำลังโหลดคำใบ้ของคุณ...
            </div>
          </div>
        ) : juniorData?.has_drawn ? (
          /* ── Hints display panel ── */
          <div className="glass-card p-10 sm:p-6 text-left max-w-[600px] w-full mt-5 mb-16">
            <h2 className="text-[2rem] sm:text-[1.5rem] font-extrabold mb-6 bg-gradient-to-br from-white to-accent
              bg-clip-text text-transparent text-center flex items-center justify-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              คำใบ้สายรหัสทั้งหมดของคุณ
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
            </h2>



            {juniorData.seniors && juniorData.seniors.length > 0 ? (
              juniorData.seniors.map((senior, sIdx) => (
                <div key={senior.senior_index || sIdx} className={sIdx > 0 ? "mt-8 pt-6 border-t border-white/10" : ""}>
                  <div className="flex items-center gap-2 mb-4 bg-white/[0.03] border border-white/5 px-4 py-2 rounded-xl">
                    <span className="text-[1.1rem] font-bold text-accent">พี่รหัส {String(senior.senior_index || (sIdx + 1)).padStart(2, '0')}</span>
                  </div>
                  {senior.hints.map(h => (
                    <div key={h.hint_number}
                      className={`p-5 rounded-[18px] mb-4 flex items-center gap-4
                        ${h.is_released
                          ? 'bg-[rgba(255,51,51,0.04)] border border-[rgba(255,51,51,0.2)] text-white'
                          : 'bg-white/[.02] border border-dashed border-white/15 text-text-muted'}`}>
                      <div className={`flex-shrink-0 w-[45px] h-[45px] rounded-full flex items-center justify-center
                        ${h.is_released ? 'bg-[rgba(255,51,51,0.15)]' : 'bg-white/5'}`}>
                        {h.is_released
                          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        }
                      </div>
                      <div className="flex-grow">
                        <span className={`block text-[0.75rem] font-bold uppercase tracking-[1px] mb-1
                          ${h.is_released ? 'text-accent' : 'text-text-muted'}`}>
                          คำใบ้ที่ {h.hint_number} {h.is_released ? '(เปิดเผยแล้ว)' : '(ถูกล็อค)'}
                        </span>
                        <div className="text-[1.05rem] font-medium leading-[1.5]">{h.hint_text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              juniorData.hints?.map(h => (
                <div key={h.hint_number}
                  className={`p-5 rounded-[18px] mb-4 flex items-center gap-4
                    ${h.is_released
                      ? 'bg-[rgba(255,51,51,0.04)] border border-[rgba(255,51,51,0.2)] text-white'
                      : 'bg-white/[.02] border border-dashed border-white/15 text-text-muted'}`}>
                  <div className={`flex-shrink-0 w-[45px] h-[45px] rounded-full flex items-center justify-center
                    ${h.is_released ? 'bg-[rgba(255,51,51,0.15)]' : 'bg-white/5'}`}>
                    {h.is_released
                      ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    }
                  </div>
                  <div className="flex-grow">
                    <span className={`block text-[0.75rem] font-bold uppercase tracking-[1px] mb-1
                      ${h.is_released ? 'text-accent' : 'text-text-muted'}`}>
                      คำใบ้ที่ {h.hint_number} {h.is_released ? '(เปิดเผยแล้ว)' : '(ถูกล็อค)'}
                    </span>
                    <div className="text-[1.05rem] font-medium leading-[1.5]">{h.hint_text}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ── No draws display panel ── */
          <div className="glass-card p-10 sm:p-6 text-center max-w-[600px] w-full mt-5 mb-16">
            <div className="text-[3rem] mb-4 text-accent">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-accent">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
            </div>
            <h2 className="text-[1.5rem] font-bold text-white mb-2">ไม่พบข้อมูลการสุ่มสายรหัส</h2>
            <p className="text-text-muted text-[0.95rem] leading-relaxed mb-6">
              ระบบไม่พบประวัติการจับสุ่มคำใบ้สายรหัสของคุณในฐานข้อมูล กรุณาติดต่อรุ่นพี่หรือแอดมินผู้ดูแลระบบเพื่อทำการแก้ไข
            </p>

          </div>
        )}
      </main>

      <footer className="page-footer">
        © 2026 Computer Engineering. All rights reserved.
      </footer>
    </div>
  );
}
