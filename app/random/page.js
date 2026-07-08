'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';

// ── Wheel colours ──
const COLORS = ['#ff3333','#1a1a1a','#ffffff','#800000','#e60000','#2d2d2d','#f2f2f2','#4d0000'];
const FRICTION = 0.985;

// ── Confetti ──────────────────────────────────────────────
const CONFETTI_COLORS = ['#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#4caf50','#ffeb3b','#ffc107','#ff9800'];

class ConfettiPiece {
  constructor(w, h) { this.reset(w, h); this.y = Math.random() * h - h; }
  reset(w, h) {
    this.x = Math.random() * w; this.y = -20;
    this.r = Math.random() * 6 + 4;
    this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    this.tilt = Math.random() * 10 - 5;
    this.tiltAngleChan = Math.random() * 0.05 + 0.01;
    this.tiltAngle = 0;
  }
  update(h, w) {
    this.tiltAngle += this.tiltAngleChan;
    this.y += (Math.cos(this.tiltAngle) + 3 + this.r / 2) / 2;
    this.tilt = Math.sin(this.tiltAngle - this.r / 2) * 5;
    if (this.y > h) this.reset(w, h);
  }
  draw(ctx) {
    ctx.beginPath(); ctx.lineWidth = this.r; ctx.strokeStyle = this.color;
    ctx.moveTo(this.x + this.tilt + this.r / 2, this.y);
    ctx.lineTo(this.x + this.tilt, this.y + this.tilt + this.r / 2);
    ctx.stroke();
  }
}

export default function RandomPage() {
  const canvasRef    = useRef(null);
  const confettiRef  = useRef(null);
  const angleRef     = useRef(0);
  const velRef       = useRef(0);
  const spinningRef  = useRef(false);
  const lastSegRef   = useRef(-1);
  const audioCtxRef  = useRef(null);
  const rafRef       = useRef(null);
  const confRafRef   = useRef(null);
  const confPiecesRef = useRef([]);
  const confActiveRef = useRef(false);
  const pollRef      = useRef(null);
  const jrPollRef    = useRef(null);

  const [dbHints, setDbHints]   = useState([]);
  const [history, setHistory]   = useState([]);
  const [hasSpun, setHasSpun]   = useState(false);
  const [modalWinner, setModalWinner] = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [juniorData, setJuniorData]   = useState(null);
  const [authorized, setAuthorized]   = useState(false);
  const [isSenior, setIsSenior]         = useState(false);
  const [loadingHints, setLoadingHints] = useState(true);

  const TARGET_DATE = useRef(new Date('2026-07-08T17:20:00+07:00')).current;
  const [timeLocked, setTimeLocked] = useState(true);

  useEffect(() => {
    const checkTime = () => {
      setTimeLocked(new Date() < TARGET_DATE);
    };
    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [TARGET_DATE]);

  const drawWheel = useCallback((items) => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 20;
    ctx.clearRect(0, 0, size, size);



    const arc = (2 * Math.PI) / items.length;
    items.forEach((item, i) => {
      const a = angleRef.current + i * arc;
      ctx.beginPath(); ctx.moveTo(center, center);
      ctx.arc(center, center, radius, a, a + arc);
      ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
      ctx.strokeStyle = '#0b0f19'; ctx.lineWidth = 4; ctx.stroke();
      if (item !== '(ว่าง)') {
        ctx.save(); ctx.translate(center, center); ctx.rotate(a + arc / 2);
        ctx.textAlign = 'right';
        const col = COLORS[i % COLORS.length];
        ctx.fillStyle = (col === '#ffffff' || col === '#f2f2f2') ? '#0d0d0d' : '#ffffff';
        ctx.font = `bold ${items.length > 15 ? '14px' : '20px'} 'Outfit', 'IBM Plex Sans Thai', sans-serif`;
        ctx.shadowColor = (col === '#ffffff' || col === '#f2f2f2') ? 'transparent' : 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(item, radius - 30, 8);
        ctx.restore();
      }
    });
    ctx.beginPath(); ctx.arc(center, center, 45, 0, 2 * Math.PI); ctx.fillStyle = '#1a1a1a'; ctx.fill();
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(center, center, 10, 0, 2 * Math.PI); ctx.fillStyle = '#ff3333'; ctx.fill();
  }, []);

  const playClick = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(); osc.stop(ctx.currentTime + 0.08);
    } catch (_) {}
  };

  const loadHints = useCallback(async () => {
    try {
      const res = await fetch(`/api/get-hints?t=${Date.now()}`);
      const data = await res.json();
      if (Array.isArray(data)) setDbHints(data);
    } catch (_) {} finally {
      setLoadingHints(false);
    }
  }, []);

  const checkJuniorHints = useCallback(async () => {
    const juniorId = localStorage.getItem('cpe_username');
    if (!juniorId) return;
    try {
      const res = await fetch(`/api/get-junior-hints?junior_id=${encodeURIComponent(juniorId)}&t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        if (data.has_drawn) {
          setJuniorData(data); setHasSpun(true);
          localStorage.setItem('cpe_has_spun', 'true');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (!jrPollRef.current) jrPollRef.current = setInterval(checkJuniorHints, 3000);
        } else {
          setJuniorData(null); setHasSpun(false);
          localStorage.removeItem('cpe_has_spun');
          if (jrPollRef.current) { clearInterval(jrPollRef.current); jrPollRef.current = null; }
          loadHints();
          if (!pollRef.current) {
            pollRef.current = setInterval(() => { if (!spinningRef.current) loadHints(); }, 5000);
          }
        }
      }
    } catch (_) {}
  }, [loadHints]);

  const animate = useCallback((items) => {
    if (velRef.current > 0.001) {
      angleRef.current += velRef.current;
      velRef.current *= FRICTION;
      const arc = (2 * Math.PI) / items.length;
      const rel = (1.5 * Math.PI - angleRef.current) % (2 * Math.PI);
      const norm = rel < 0 ? rel + 2 * Math.PI : rel;
      const seg = Math.floor(norm / arc);
      if (seg !== lastSegRef.current) { playClick(); lastSegRef.current = seg; }
      drawWheel(items);
      rafRef.current = requestAnimationFrame(() => animate(items));
    } else {
      spinningRef.current = false; velRef.current = 0;
      announceWinner(items);
    }
  }, [drawWheel]);

  const announceWinner = useCallback(async (items) => {
    if (!items.length) return;
    const arc = (2 * Math.PI) / items.length;
    const rel = (1.5 * Math.PI - angleRef.current) % (2 * Math.PI);
    const norm = rel < 0 ? rel + 2 * Math.PI : rel;
    const idx = Math.floor(norm / arc);
    
    const winner = dbHints[idx];
    if (!winner) return;

    localStorage.setItem('cpe_has_spun', 'true');
    setHasSpun(true);
    setModalWinner(winner.alias || winner.hint_text);
    setModalOpen(true);
    setHistory(h => [{ text: winner.alias || winner.hint_text, time: new Date().toLocaleTimeString('th-TH') }, ...h]);
    startConfetti();

    const juniorId = localStorage.getItem('cpe_username') || 'น้องรหัส';
    let nick = 'น้องรหัส';
    try {
      const userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null');
      if (userObj) nick = userObj.nickname || userObj.first_name || 'น้องรหัส';
    } catch (_) {}

    try {
      const res = await fetch('/api/draw-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: winner._id, drawn_by: juniorId, drawn_by_name: nick }),
      });
      if (res.status === 409) {
        localStorage.removeItem('cpe_has_spun');
        setHasSpun(false);
        setModalOpen(false);
        stopConfetti();
        try {
          const freshRes = await fetch(`/api/get-hints?t=${Date.now()}`);
          const freshData = await freshRes.json();
          if (Array.isArray(freshData) && freshData.length > 0) {
            setDbHints(freshData);
            setTimeout(() => {
              spinningRef.current = true;
              velRef.current = Math.random() * 0.35 + 0.35;
              animate(freshData.map(h => h.alias || h.hint_text));
            }, 100);
          } else {
            setDbHints([]);
            alert('ไม่มีคำใบ้เหลือในระบบฐานข้อมูลแล้ว');
          }
        } catch (_) {}
      } else {
        checkJuniorHints();
      }
    } catch (_) {}
  }, [checkJuniorHints, loadHints, dbHints]);

  const spinWheel = useCallback(() => {
    if (spinningRef.current) return;

    // Rigid check to prevent HTML modifier bypasses
    const username = localStorage.getItem('cpe_username') || '';
    let userObj = null;
    try { userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null'); } catch (_) {}
    const senior = username.startsWith('68') || userObj?.role === 'cpe68';
    if (senior) {
      alert('เฉพาะน้องรหัส (CPE 69) เท่านั้นที่สามารถหมุนวงล้อได้!');
      return;
    }

    if (timeLocked) { alert('ยังไม่ถึงเวลาเริ่มกิจกรรมจับสุ่มสายรหัส (กรุณารอเวลาตามหน้าแรก)'); return; }
    if (hasSpun || localStorage.getItem('cpe_has_spun') === 'true') {
      alert('คุณได้หมุนสุ่มจับคู่สายรหัสไปเรียบร้อยแล้ว!');
      return;
    }

    if (dbHints.length === 0) {
      alert('ไม่มีคำใบ้เหลือในระบบฐานข้อมูลแล้ว');
      return;
    }

    spinningRef.current = true;
    velRef.current = Math.random() * 0.35 + 0.35;
    animate(dbHints.map(h => h.alias || h.hint_text));
  }, [hasSpun, animate, timeLocked, dbHints]);

  const startConfetti = () => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    confActiveRef.current = true;
    confPiecesRef.current = Array.from({ length: 150 }, () => new ConfettiPiece(canvas.width, canvas.height));
    const loop = () => {
      if (!confActiveRef.current) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confPiecesRef.current.forEach(p => { p.update(canvas.height, canvas.width); p.draw(ctx); });
      confRafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const stopConfetti = () => {
    confActiveRef.current = false;
    if (confRafRef.current) cancelAnimationFrame(confRafRef.current);
    const canvas = confettiRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const closeModal = () => { setModalOpen(false); stopConfetti(); checkJuniorHints(); };

  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    if (!username) { window.location.replace('/login'); return; }
    
    let userObj = null;
    try { userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null'); } catch (_) {}
    
    const senior = username.startsWith('68') || userObj?.role === 'cpe68' || userObj?.role === 'admin' || username === '0611610900';
    
    if (senior) {
      window.location.replace('/senior');
    } else {
      window.location.replace('/my-hint');
    }
  }, []);

  useEffect(() => {
    const items = dbHints.length ? dbHints.map(h => h.alias || h.hint_text) : ['', '', '', ''];
    drawWheel(items);
  }, [dbHints, drawWheel]);

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
          วงล้อสุ่มสายรหัส CPE
        </h1>
        <p className="text-text-muted text-[1.1rem]">หมุนวงล้อเพื่อสุ่มจับคู่สายรหัส!</p>
      </header>

      {/* Main area */}
      {juniorData?.has_drawn ? (
        /* ── Hints display panel ── */
        <div className="glass-card p-10 sm:p-6 text-left max-w-[600px] w-[90%] mt-5 mb-16">
          <h2 className="text-[2rem] sm:text-[1.5rem] font-extrabold mb-6 bg-gradient-to-br from-white to-accent
            bg-clip-text text-transparent text-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="inline-block align-middle mr-2 -mt-0.5">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
            คำใบ้สายรหัสของคุณ
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="inline-block align-middle ml-2 -mt-0.5">
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
        /* ── Wheel + controls grid ── */
        <div className="grid grid-cols-[1.2fr_1fr] gap-10 max-w-[1200px] w-[90%] mb-16 items-start
          max-[950px]:grid-cols-1 max-[950px]:gap-6">

          {/* Wheel */}
          <main className="glass-card p-10 sm:p-6 flex flex-col items-center justify-center">
            {loadingHints ? (
              <div className="flex flex-col items-center justify-center h-[350px] w-full">
                <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                <div className="text-[1.1rem] font-semibold text-text-muted">
                  กำลังโหลดข้อมูลวงล้อ...
                </div>
              </div>
            ) : (
              <div className="relative mb-8"
                style={{ width: 'min(420px, 85vw)', height: 'min(420px, 85vw)' }}>
                {/* Pointer */}
                <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 z-10 w-[30px] h-[40px]
                  bg-gradient-to-b from-accent to-accent-deep"
                  style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
                />
                <canvas
                  ref={canvasRef} id="wheelCanvas"
                  width={800} height={800}
                  className="w-full h-full rounded-full pointer-events-none"
                  style={{ boxShadow: '0 0 40px rgba(255,51,51,0.22), inset 0 0 20px rgba(255,255,255,0.05)' }}
                />
                <button
                  onClick={spinWheel}
                  disabled={hasSpun || timeLocked || isSenior || dbHints.length === 0}
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[15]
                    w-20 h-20 rounded-full font-extrabold text-[0.9rem] cursor-pointer
                    flex flex-col justify-center items-center select-none transition-all duration-200 text-center leading-tight
                    ${(hasSpun || timeLocked || isSenior || dbHints.length === 0)
                      ? 'bg-[#1f2937] text-[#4b5563] border-[5px] border-[#111827] cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-br from-white to-[#e0e0e0] text-[#0b0f19] border-[5px] border-[#1a2333] hover:scale-[1.08] active:scale-95'
                    }`}
                  style={(hasSpun || timeLocked || isSenior || dbHints.length === 0) ? {} : { boxShadow: '0 6px 20px rgba(0,0,0,0.6), 0 0 15px rgba(255,255,255,0.2)' }}
                >
                  {hasSpun ? (
                    'หมุนไปแล้ว'
                  ) : dbHints.length === 0 ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m4.9 4.9 14.2 14.2"/>
                      </svg>
                      <span className="text-[0.7rem] font-bold text-[#ef4444]">
                        หมดแล้ว
                      </span>
                    </>
                  ) : (isSenior || timeLocked) ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 text-[#4b5563]">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <span className="text-[0.7rem] font-bold">
                        {isSenior ? 'เฉพาะน้อง' : 'รอเวลา'}
                      </span>
                    </>
                  ) : (
                    'SPIN'
                  )}
                </button>
              </div>
            )}
          </main>

          {/* Controls */}
          <aside className="glass-card p-8 sm:p-6 text-left">
            <h2 className="section-title">สถานะคำใบ้คงเหลือ</h2>
            <div className="mb-5">
              <label className="block text-[0.9rem] text-text-muted mb-2.5 font-semibold">
                คำใบ้ในระบบที่ยังไม่ถูกสุ่ม (เหลือ <span id="hintCount">{dbHints.length}</span> รายการ)
              </label>
              <div className="max-h-[250px] overflow-y-auto bg-white/[.02] border border-white/10
                rounded-xl p-3 text-[0.9rem] leading-relaxed text-text-muted">
                {dbHints.length === 0
                  ? <div className="text-center text-red-500 font-semibold">หมดแล้ว!</div>
                  : dbHints.map((h, i) => (
                    <div key={h._id || i}
                      className="py-1 border-b border-white/[.02] overflow-hidden text-ellipsis whitespace-nowrap">
                      {h.alias || h.hint_text}
                    </div>
                  ))}
              </div>
            </div>
            <div className="mt-6 border-t border-white/5 pt-5">
              <div className="text-[1.1rem] font-semibold text-text-muted mb-4">ประวัติการสุ่มสายรหัส</div>
              <ul className="list-none max-h-[150px] overflow-y-auto">
                {history.map((item, i) => (
                  <li key={i} className="py-2.5 px-4 bg-white/[.01] rounded-lg mb-2 text-[0.95rem]
                    flex justify-between border-l-[3px] border-accent-deep">
                    <span>{item.text}</span>
                    <span className="text-text-muted text-[0.8rem]">{item.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* Winner Modal */}
      {modalOpen && (
        <div id="winnerModal" className="fixed inset-0 flex justify-center items-center z-[1000]"
          style={{ background: 'rgba(11,15,25,0.9)' }}>
          <div className="border-2 border-accent rounded-[28px] p-10 sm:p-6 max-w-[500px] w-[90%] text-center
            transition-transform duration-[400ms] scale-100"
            style={{
              background: 'linear-gradient(135deg,#161c2e 0%,#0d1220 100%)',
              boxShadow: '0 0 50px rgba(0,210,255,0.3)',
            }}>
            <span className="inline-block px-4 py-1.5 bg-[rgba(157,78,221,0.2)] text-[#d896ff]
              rounded-full text-[0.9rem] font-bold mb-5">
              ผลลัพธ์การสุ่ม
            </span>
            <div className="text-[3rem] sm:text-[2rem] font-extrabold text-white mb-6">{modalWinner}</div>
            <button onClick={closeModal}
              className="px-8 py-3 bg-gradient-to-br from-accent to-accent-deep text-white border-0
                rounded-xl font-bold cursor-pointer transition-transform duration-200 hover:scale-105">
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Confetti canvas */}
      <canvas ref={confettiRef} className="fixed inset-0 w-screen h-screen pointer-events-none z-[999]" />

      <footer className="page-footer">Powerd By Computer Engineering 67 &amp; 68</footer>
    </div>
  );
}
