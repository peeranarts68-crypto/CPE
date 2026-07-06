'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';

// ── Wheel colours (alternating dark/light/red) ──
const COLORS = ['#ff3333','#1a1a1a','#ffffff','#800000','#e60000','#2d2d2d','#f2f2f2','#4d0000'];
const FRICTION = 0.985;

// ── Confetti ──────────────────────────────────────────────
const CONFETTI_COLORS = ['#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#4caf50','#ffeb3b','#ffc107','#ff9800'];

class ConfettiPiece {
  constructor(w, h) {
    this.reset(w, h);
    this.y = Math.random() * h - h;
  }
  reset(w, h) {
    this.x = Math.random() * w;
    this.y = -20;
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
    ctx.beginPath();
    ctx.lineWidth = this.r;
    ctx.strokeStyle = this.color;
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
  const [juniorData, setJuniorData]   = useState(null); // { has_drawn, senior_name, hints }

  // ── draw wheel ──────────────────────────────────────────
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
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, a, a + arc);
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#0b0f19';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(a + arc / 2);
      ctx.textAlign = 'right';
      const col = COLORS[i % COLORS.length];
      ctx.fillStyle = (col === '#ffffff' || col === '#f2f2f2') ? '#0d0d0d' : '#ffffff';
      ctx.font = `bold ${items.length > 15 ? '14px' : '20px'} 'Outfit', 'IBM Plex Sans Thai', sans-serif`;
      ctx.shadowColor = (col === '#ffffff' || col === '#f2f2f2') ? 'transparent' : 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(item, radius - 30, 8);
      ctx.restore();
    });

    // center cap
    ctx.beginPath(); ctx.arc(center, center, 45, 0, 2 * Math.PI); ctx.fillStyle = '#1a1a1a'; ctx.fill();
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(center, center, 10, 0, 2 * Math.PI); ctx.fillStyle = '#ff3333'; ctx.fill();
  }, []);

  // ── audio click ─────────────────────────────────────────
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

  // ── load hints from API ─────────────────────────────────
  const loadHints = useCallback(async () => {
    try {
      const res = await fetch('/api/get-hints');
      const data = await res.json();
      if (Array.isArray(data)) setDbHints(data);
    } catch (_) {}
  }, []);

  // ── check junior's drawn hints ──────────────────────────
  const checkJuniorHints = useCallback(async () => {
    const juniorId = localStorage.getItem('cpe_username');
    if (!juniorId) return;
    try {
      const res = await fetch(`/api/get-junior-hints?junior_id=${encodeURIComponent(juniorId)}`);
      const data = await res.json();
      if (data.success) {
        if (data.has_drawn) {
          setJuniorData(data);
          setHasSpun(true);
          localStorage.setItem('cpe_has_spun', 'true');
          // stop standard poll
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          // start junior poll
          if (!jrPollRef.current) jrPollRef.current = setInterval(checkJuniorHints, 3000);
        } else {
          setJuniorData(null);
          setHasSpun(false);
          localStorage.removeItem('cpe_has_spun');
          // stop junior poll
          if (jrPollRef.current) { clearInterval(jrPollRef.current); jrPollRef.current = null; }
          // restart standard poll
          loadHints();
          if (!pollRef.current) {
            pollRef.current = setInterval(() => { if (!spinningRef.current) loadHints(); }, 5000);
          }
        }
      }
    } catch (_) {}
  }, [loadHints]);

  // ── spin animation ──────────────────────────────────────
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
      spinningRef.current = false;
      velRef.current = 0;
      announceWinner(items);
    }
  }, [drawWheel]);

  // ── announce winner ─────────────────────────────────────
  const announceWinner = useCallback(async (items) => {
    if (!items.length) return;
    const arc = (2 * Math.PI) / items.length;
    const rel = (1.5 * Math.PI - angleRef.current) % (2 * Math.PI);
    const norm = rel < 0 ? rel + 2 * Math.PI : rel;
    const idx = Math.floor(norm / arc);

    setDbHints(prev => {
      const winner = prev[idx];
      if (!winner) return prev;
      localStorage.setItem('cpe_has_spun', 'true');
      setHasSpun(true);
      setModalWinner(winner.alias || winner.hint_text);
      setModalOpen(true);
      setHistory(h => [{ text: winner.alias || winner.hint_text, time: new Date().toLocaleTimeString('th-TH') }, ...h]);
      startConfetti();

      // save draw state
      const juniorId = localStorage.getItem('cpe_username') || 'น้องรหัส';
      let nick = 'น้องรหัส';
      try {
        const userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null');
        if (userObj) {
          nick = userObj.nickname || userObj.first_name || 'น้องรหัส';
        }
      } catch (_) {}

      fetch('/api/draw-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: winner._id, drawn_by: juniorId, drawn_by_name: nick }),
      }).then(async (res) => {
        if (res.status === 409) {
          // hint ถูกคนอื่น draw ไปก่อนหน้าแล้ว (race condition)
          // reset สถานะและโหลดวงล้อใหม่
          localStorage.removeItem('cpe_has_spun');
          setHasSpun(false);
          setModalOpen(false);
          stopConfetti();
          alert('คำใบ้นี้ถูกสุ่มไปแล้วโดยน้องคนอื่น กรุณาหมุนใหม่อีกครั้ง!');
          await loadHints();
        } else {
          checkJuniorHints();
        }
      }).catch(() => {});

      return prev;
    });
  }, [checkJuniorHints, loadHints]);

  // ── spin wheel ──────────────────────────────────────────
  const spinWheel = useCallback(() => {
    if (spinningRef.current) return;
    if (hasSpun || localStorage.getItem('cpe_has_spun') === 'true') return;
    setDbHints(prev => {
      if (prev.length === 0) { alert('ไม่มีคำใบ้เหลือในระบบฐานข้อมูลแล้ว'); return prev; }
      spinningRef.current = true;
      velRef.current = Math.random() * 0.35 + 0.35;
      animate(prev.map(h => h.alias || h.hint_text));
      return prev;
    });
  }, [hasSpun, animate]);

  // ── confetti ────────────────────────────────────────────
  const startConfetti = () => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
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

  // ── close modal ─────────────────────────────────────────
  const closeModal = () => {
    setModalOpen(false);
    stopConfetti();
    checkJuniorHints();
  };

  // ── init ────────────────────────────────────────────────
  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    if (!username) {
      window.location.replace('/login');
      return;
    }
    if (username && username.startsWith('68')) {
      window.location.replace('/senior');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has('reset')) {
      localStorage.removeItem('cpe_has_spun');
      window.history.replaceState({}, '', '/random');
    }

    const spun = localStorage.getItem('cpe_has_spun') === 'true';
    setHasSpun(spun);

    checkJuniorHints();

    if (!spun) {
      loadHints();
      pollRef.current = setInterval(() => { if (!spinningRef.current) loadHints(); }, 5000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (jrPollRef.current) clearInterval(jrPollRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopConfetti();
    };
  }, [loadHints, checkJuniorHints]);

  // re-draw wheel when dbHints changes
  useEffect(() => {
    const items = dbHints.length ? dbHints.map(h => h.alias || h.hint_text) : ['(ว่าง)'];
    drawWheel(items);
  }, [dbHints, drawWheel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <Sidebar />

      {/* Navbar */}
      <nav style={{ width: '100%', padding: '20px 5% 20px 80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(11,15,25,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 990 }}>
        <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg,#fff 0%,var(--accent-color) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>CPE Hint Portal</Link>
        <Link href="/" style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.3s ease' }}>กลับหน้าหลัก</Link>
      </nav>

      {/* Header */}
      <header style={{ margin: '40px 0 20px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg,#fff 0%,var(--accent-color) 50%,var(--accent-purple) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 10 }}>วงล้อสุ่มสายรหัส CPE</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>หมุนวงล้อเพื่อสุ่มจับคู่สายรหัส!</p>
      </header>

      {/* Main area — either wheel or junior hints */}
      {juniorData?.has_drawn ? (
        <div className="hints-display-panel">
          <h2 className="senior-line-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8, marginTop: -3 }}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            คำใบ้สายรหัสของคุณ
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 8, marginTop: -3 }}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </h2>
          {juniorData.hints.map(h => (
            <div key={h.hint_number} className={`hint-box ${h.is_released ? 'unlocked' : 'locked'}`}>
              <div className="hint-box-icon">
                {h.is_released ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                )}
              </div>
              <div className="hint-box-content">
                <span className="hint-box-label">คำใบ้ที่ {h.hint_number} {h.is_released ? '(เปิดเผยแล้ว)' : '(ถูกล็อค)'}</span>
                <div className="hint-box-text">{h.hint_text}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="container" id="wheelSection">
          {/* Wheel */}
          <main className="wheel-area">
            <div className="wheel-container">
              <div className="pointer" />
              <canvas ref={canvasRef} id="wheelCanvas" width={800} height={800} style={{ width: '100%', height: '100%', borderRadius: '50%', boxShadow: '0 0 40px rgba(0,210,255,0.15), inset 0 0 20px rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
              <button
                className="spin-btn-center"
                onClick={spinWheel}
                style={hasSpun ? { background: '#1f2937', color: '#4b5563', borderColor: '#111827', cursor: 'not-allowed', boxShadow: 'none' } : {}}
              >
                {hasSpun ? 'สุ่มแล้ว' : 'SPIN'}
              </button>
            </div>
          </main>

          {/* Status & History */}
          <aside className="controls-area">
            <h2 className="controls-title">สถานะคำใบ้คงเหลือ</h2>
            <div className="form-group">
              <label>คำใบ้ในระบบที่ยังไม่ถูกสุ่ม (เหลือ <span id="hintCount">{dbHints.length}</span> รายการ)</label>
              <div style={{ maxHeight: 250, overflowY: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {dbHints.length === 0
                  ? <div style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>หมดแล้ว!</div>
                  : dbHints.map((h, i) => <div key={h._id || i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {h.alias || h.hint_text}</div>)
                }
              </div>
            </div>
            <div style={{ marginTop: 25, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 15 }}>ประวัติการสุ่มสายรหัส</div>
              <ul style={{ listStyle: 'none', maxHeight: 150, overflowY: 'auto' }}>
                {history.map((item, i) => (
                  <li key={i} style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.01)', borderRadius: 8, marginBottom: 8, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', borderLeft: '3px solid var(--accent-purple)' }}>
                    <span>{item.text}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{item.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* Winner Modal */}
      {modalOpen && (
        <div className="modal active" id="winnerModal">
          <div className="modal-content">
            <span className="modal-badge">ผลลัพธ์การสุ่ม</span>
            <div className="winner-name">{modalWinner}</div>
            <button className="close-modal-btn" onClick={closeModal}>ตกลง</button>
          </div>
        </div>
      )}

      {/* Confetti canvas */}
      <canvas ref={confettiRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999 }} />

      <footer>
        Powerd By Computer Engineering 67 & 68
      </footer>

      <style>{`
        .container { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; max-width: 1200px; width: 90%; margin-bottom: 60px; align-items: start; }
        @media (max-width: 950px) { .container { grid-template-columns: 1fr; } }
        .wheel-area { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .wheel-container { position: relative; width: 420px; height: 420px; margin-bottom: 30px; }
        .pointer { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); width: 30px; height: 40px; background: linear-gradient(to bottom, #ff3333, #990000); clip-path: polygon(50% 100%, 0 0, 100% 0); z-index: 10; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); }
        .spin-btn-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg,#ffffff 0%,#e0e0e0 100%); border: 5px solid #1a2333; color: #0b0f19; font-size: 1.1rem; font-weight: 800; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,0.6),0 0 15px rgba(255,255,255,0.2); transition: all 0.2s ease; z-index: 15; display: flex; justify-content: center; align-items: center; user-select: none; }
        .spin-btn-center:hover { transform: translate(-50%,-50%) scale(1.08); }
        .spin-btn-center:active { transform: translate(-50%,-50%) scale(0.95); }
        .controls-area { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: left; }
        .controls-title { font-size: 1.5rem; margin-bottom: 20px; color: var(--accent-color); border-left: 4px solid var(--accent-purple); padding-left: 15px; font-weight: 700; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px; font-weight: 600; }
        .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(11,15,25,0.9); display: flex; justify-content: center; align-items: center; z-index: 1000; opacity: 0; pointer-events: none; transition: opacity 0.4s ease; }
        .modal.active { opacity: 1; pointer-events: auto; }
        .modal-content { background: linear-gradient(135deg,#161c2e 0%,#0d1220 100%); border: 2px solid var(--accent-color); border-radius: 28px; padding: 40px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 0 50px rgba(0,210,255,0.3); transform: scale(0.8); transition: transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275); }
        .modal.active .modal-content { transform: scale(1); }
        .modal-badge { display: inline-block; padding: 6px 18px; background: rgba(157,78,221,0.2); color: #d896ff; border-radius: 20px; font-size: 0.9rem; font-weight: 700; margin-bottom: 20px; }
        .winner-name { font-size: 3rem; font-weight: 800; color: #fff; margin-bottom: 25px; }
        .close-modal-btn { padding: 12px 30px; background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-purple) 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: transform 0.2s ease; }
        .close-modal-btn:hover { transform: scale(1.05); }
        .hints-display-panel { background: rgba(26,26,26,0.75); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 40px; box-shadow: 0 30px 60px rgba(0,0,0,0.6); text-align: left; max-width: 600px; width: 90%; margin: 20px auto 60px; }
        .senior-line-title { font-size: 2rem; font-weight: 800; margin-bottom: 25px; background: linear-gradient(135deg,#fff 0%,var(--accent-color) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; }
        .hint-box { padding: 20px; border-radius: 18px; margin-bottom: 18px; display: flex; align-items: center; gap: 15px; }
        .hint-box.locked { background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.15); color: var(--text-secondary); }
        .hint-box.unlocked { background: rgba(255,51,51,0.04); border: 1px solid rgba(255,51,51,0.2); color: var(--text-primary); }
        .hint-box-icon { font-size: 1.5rem; flex-shrink: 0; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .hint-box.locked .hint-box-icon { background: rgba(255,255,255,0.05); }
        .hint-box.unlocked .hint-box-icon { background: rgba(255,51,51,0.15); }
        .hint-box-content { flex-grow: 1; }
        .hint-box-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: block; }
        .hint-box.locked .hint-box-label { color: var(--text-secondary); }
        .hint-box.unlocked .hint-box-label { color: var(--accent-color); }
        .hint-box-text { font-size: 1.05rem; font-weight: 500; line-height: 1.5; }
        footer { margin-top: auto; padding: 30px; width: 100%; color: var(--text-secondary); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.05); }
        @media (max-width: 500px) { .wheel-container { width: 300px; height: 300px; } }
      `}</style>
    </div>
  );
}
