'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Sidebar from './components/Sidebar';

// ── Countdown ──────────────────────────────────────────────
const TARGET_DATE = new Date('2026-07-08T13:30:00+07:00');

function pad(n) { return String(n).padStart(2, '0'); }

function getTimeLeft() {
  const diff = TARGET_DATE - new Date();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function CountdownTimer() {
  const [time, setTime] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTime(getTimeLeft());
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) {
    return (
      <div className="countdown-timer" id="countdown">
        {['วัน', 'ชั่วโมง', 'นาที', 'วินาที'].map((unit, i) => (
          <React.Fragment key={unit}>
            <div className="countdown-box">
              <span className="countdown-num">00</span>
              <span className="countdown-unit">{unit}</span>
            </div>
            {i < 3 && <span className="countdown-sep">:</span>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (!time) {
    return (
      <div className="countdown-finished">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}><path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M4 18h.01"/><path d="M18.8 8.4c.5-1 1.2-1.9 2-2.7c1-1 .7-2.3-.6-2.9C19 2.3 17.6 2 16.2 2.2c-.9.1-1.6.7-2.1 1.4L5.8 11.3l6.9 6.9L21 9.9c-.8-.6-1.5-1-2.2-1.5Z"/><path d="M10 2h.01"/><path d="M14 6h.01"/><path d="M18 10h.01"/><path d="M10.1 7.1h.01"/><path d="M13 10h.01"/><path d="M17 13h.01"/><path d="M10 22h.01"/><path d="M14 18h.01"/></svg>
        กิจกรรมเริ่มแล้ว!
      </div>
    );
  }

  const boxes = [
    { val: pad(time.days),    unit: 'วัน' },
    { val: pad(time.hours),   unit: 'ชั่วโมง' },
    { val: pad(time.minutes), unit: 'นาที' },
    { val: pad(time.seconds), unit: 'วินาที' },
  ];

  return (
    <div className="countdown-timer" id="countdown">
      {boxes.map(({ val, unit }, i) => (
        <React.Fragment key={unit}>
          <div className="countdown-box">
            <span className="countdown-num">{val}</span>
            <span className="countdown-unit">{unit}</span>
          </div>
          {i < 3 && <span className="countdown-sep">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Auth / Status Card ─────────────────────────────────────
function StatusCard() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    let userObj = null;
    try { userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null'); } catch (_) {}
    if (username) setUser({ username, ...userObj });
    setLoaded(true);
  }, []);

  function handleLogout() {
    localStorage.removeItem('cpe_username');
    localStorage.removeItem('cpe_user');
    localStorage.removeItem('cpe_has_spun');
    setUser(null);
  }

  if (!loaded) return null;

  if (user) {
    const nick = user.nickname || user.username;
    const name = user.first_name || '-';
    const role = user.role || 'cpe69';
    const roleLabel = role === 'cpe68' ? 'พี่ CPE 68' : 'น้อง CPE 69';
    const targetPath = role === 'cpe68' ? '/senior' : '/random';
    const btnLabel = role === 'cpe68' ? 'ไปที่หน้าจัดการคำใบ้พี่รหัส' : 'ไปที่วงล้อสุ่มสายรหัส';
    return (
      <>
        <h2 className="login-title">ข้อมูลผู้ใช้งาน</h2>
        <div style={{ marginBottom: 20, fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['รหัสนักศึกษา', user.username], ['ชื่อจริง', name], ['ชื่อเล่น', nick]].map(([label, val]) => (
            <div key={label}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{val}</span>
            </div>
          ))}
          <div><span className="hint-tag">{roleLabel}</span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href={targetPath} className="action-btn" style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>{btnLabel}</Link>
          <button onClick={handleLogout} className="action-btn" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'none', width: '100%', cursor: 'pointer' }}>ออกจากระบบ</button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="login-title">สุ่มสายรหัส CPE</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.95rem', lineHeight: 1.6 }}>
        กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อเข้าร่วมกิจกรรมสุ่มสายรหัสและเปิดดูคำใบ้จากพี่รหัสของคุณ
      </p>
      <Link href="/login" className="action-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>เข้าสู่ระบบ / สมัครสมาชิก</Link>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
      <Sidebar />

      {/* Banner */}
      <header className="hero-banner">
        <div style={{ position: 'relative', zIndex: 10, padding: '20px 8%', maxWidth: 800, textAlign: 'right' }} />
      </header>

      {/* Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: 30,
        maxWidth: 1200,
        width: '90%',
        margin: '40px auto',
        alignItems: 'start',
      }} className="content-grid">
        {/* Left: Info */}
        <main className="main-section">
          <h2>ยินดีต้อนรับน้องๆเพื่อสุ่มสายรหัส</h2>
          <p>ทำการสุ่มสายรหัสในวันที่ 15 กรกฏาคม 2569 เวลา 13.00 ณ ตึก Computer Engineering</p>

          {/* Countdown */}
          <div className="countdown-wrapper">
            <div className="countdown-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8, marginTop: -2 }}><path d="M5 2h14"/><path d="M5 22h14"/><path d="M19 2v4c0 3.8-3.1 7-7 7s-7-3.2-7-7V2"/><path d="M5 22v-4c0-3.8 3.1-7 7-7s7 3.2 7 7v4"/></svg>
              นับถอยหลังวันสุ่มสายรหัส
            </div>
            <CountdownTimer />
          </div>

          {/* Lucky Wheel card */}
          <div className="hint-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <span className="hint-tag" style={{ background: 'rgba(157,78,221,0.15)', color: '#d896ff' }}>ฟีเจอร์ใหม่</span>
            <h3>วงล้อสุ่มสายรหัส (CPE Lucky Wheel)</h3>
            <p style={{ margin: 0 }}>ร่วมสนุกสุ่มจับคู่สายรหัสด้วยวงล้อนำโชคจำลองแบบ Canvas ที่มีเอฟเฟกต์การสุ่มและเสียงประกอบสมจริง!</p>
            <Link href="/random" className="action-btn">เปิดวงล้อสุ่มสายรหัส</Link>
          </div>
        </main>

        {/* Right: Auth/Status */}
        <aside className="login-section">
          <StatusCard />
        </aside>
      </div>

      <footer>
        Powerd By Computer Engineering 66&68
      </footer>

      <style>{`
        .hero-banner {
          width: 100%;
          height: 350px;
          background-image: linear-gradient(to bottom, rgba(13,13,13,0.3), rgba(13,13,13,0.95)), url('/img/banner_cpe.jpg');
          background-size: cover;
          background-position: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-end;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-bottom: 2px solid rgba(255,51,51,0.3);
        }
        @media (max-width: 768px) {
          .hero-banner {
            height: 180px;
          }
        }

        .content-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 30px; }
        @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }

        .main-section, .login-section {
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 24px;
          padding: 30px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          text-align: left;
        }
        .main-section h2 {
          font-size: 1.8rem; margin-bottom: 15px; color: var(--accent-color);
          border-left: 4px solid var(--accent-purple); padding-left: 15px;
        }
        .main-section p { color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; font-size: 1.05rem; }
        .hint-card {
          background: rgba(255,255,255,0.02); border-radius: 16px; padding: 20px;
          margin-top: 20px; border: 1px solid rgba(255,255,255,0.03);
          transition: transform 0.3s ease, border-color 0.3s ease;
        }
        .hint-card:hover { transform: translateY(-5px); border-color: rgba(255,51,51,0.3); background: rgba(255,255,255,0.04); }
        .hint-card h3 { margin-bottom: 8px; }
        .hint-tag {
          display: inline-block; padding: 4px 12px; background: rgba(255,51,51,0.15);
          color: var(--accent-color); border-radius: 20px; font-size: 0.85rem; font-weight: 600; margin-bottom: 10px;
        }
        .login-title {
          font-size: 1.6rem; margin-bottom: 20px; color: var(--accent-color);
          border-left: 4px solid var(--accent-purple); padding-left: 15px; font-weight: 700;
        }
        .countdown-wrapper { margin: 22px 0 8px 0; }
        .countdown-label {
          font-size: 0.78rem; font-weight: 700; letter-spacing: 3px;
          text-transform: uppercase; color: var(--accent-color); margin-bottom: 14px; opacity: 0.85;
        }
        .countdown-timer { display: flex; gap: 10px; align-items: stretch; }
        .countdown-box {
          flex: 1; background: rgba(255,51,51,0.06); border: 1px solid rgba(255,51,51,0.25);
          border-radius: 14px; padding: 14px 6px 10px; display: flex; flex-direction: column;
          align-items: center; gap: 4px; position: relative; overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(8px);
        }
        .countdown-box::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,51,51,0.6), transparent);
          animation: shimmer 2.5s ease-in-out infinite;
        }
        .countdown-num {
          font-family: 'Outfit', monospace; font-size: 2.2rem; font-weight: 800;
          color: #fff; line-height: 1; letter-spacing: -1px;
          text-shadow: 0 0 18px rgba(255,51,51,0.5), 0 0 40px rgba(255,51,51,0.2);
        }
        .countdown-unit { font-size: 0.65rem; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,51,51,0.7); }
        .countdown-sep {
          font-size: 1.8rem; font-weight: 800; color: rgba(255,51,51,0.4);
          align-self: center; padding-bottom: 18px; animation: blink 1s step-end infinite;
        }
        .countdown-finished { font-size: 1.4rem; font-weight: 700; color: var(--accent-color); text-align: center; padding: 16px; letter-spacing: 2px; animation: pulse-glow 1.5s infinite alternate; }
        footer { margin-top: auto; padding: 30px; width: 100%; color: var(--text-secondary); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; }
      `}</style>
    </div>
  );
}
