'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from './components/Sidebar';

// ── Countdown ──────────────────────────────────────────────
const TARGET_DATE = new Date('2026-07-15T16:30:00+07:00');

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

  const placeholder = ['วัน', 'ชั่วโมง', 'นาที', 'วินาที'];

  if (!mounted) {
    return (
      <div id="countdown" className="flex gap-2.5 items-stretch">
        {placeholder.map((unit, i) => (
          <React.Fragment key={unit}>
            <div className="countdown-shimmer relative flex-1 bg-[rgba(255,51,51,0.06)] border border-[rgba(255,51,51,0.25)]
              rounded-[14px] px-1.5 py-3.5 flex flex-col items-center gap-1 overflow-hidden
              shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[8px]">
              <span className="font-['Outfit'] text-[2.2rem] font-extrabold text-white leading-none tracking-tight countdown-num-glow">00</span>
              <span className="text-[0.65rem] font-semibold tracking-widest uppercase text-[rgba(255,51,51,0.7)]">{unit}</span>
            </div>
            {i < 3 && (
              <span className="self-center pb-4 text-[1.8rem] font-extrabold text-[rgba(255,51,51,0.4)] animate-[blink_1s_step-end_infinite]">:</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (!time) {
    return (
      <div className="text-[1.4rem] font-bold text-accent text-center p-4 tracking-[2px] animate-[pulse-glow_1.5s_infinite_alternate]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="inline-block align-middle mr-2 -mt-0.5 text-accent">
          <circle cx="12" cy="12" r="10"/>
          <path d="m15 9-6 6"/>
          <path d="m9 9 6 6"/>
        </svg>
        กิจกรรมสิ้นสุดแล้ว!
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
    <div id="countdown" className="flex gap-2.5 items-stretch">
      {boxes.map(({ val, unit }, i) => (
        <React.Fragment key={unit}>
          <div className="countdown-shimmer relative flex-1 bg-[rgba(255,51,51,0.06)] border border-[rgba(255,51,51,0.25)]
            rounded-[14px] px-1.5 py-3.5 flex flex-col items-center gap-1 overflow-hidden min-w-0
            shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[8px]">
            <span className="font-['Outfit'] text-[2.2rem] font-extrabold text-white leading-none tracking-tight countdown-num-glow">{val}</span>
            <span className="text-[0.65rem] font-semibold tracking-widest uppercase text-[rgba(255,51,51,0.7)]">{unit}</span>
          </div>
          {i < 3 && (
            <span className="self-center pb-4 text-[1.8rem] font-extrabold text-[rgba(255,51,51,0.4)] animate-[blink_1s_step-end_infinite]">:</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────
export default function HomePage() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    let userObj = null;
    try { userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null'); } catch (_) {}
    if (username) setUser({ username, ...userObj });
    setLoaded(true);
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen">
      <Sidebar />

      {/* Banner */}
      <header className="w-full relative flex flex-col justify-center items-end -mt-16
        h-[350px] max-sm:h-[220px]
        shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-b-2 border-[rgba(255,51,51,0.3)]"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(13,13,13,0.15) 0%, rgba(13,13,13,0.55) 100%), url('/img/banner_cpe.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Content — single centred card */}
      <main className="glass-card p-8 sm:p-6 text-left max-w-[800px] w-[90%] my-10">
          <h2 className="text-[1.8rem] font-bold text-accent mb-4 border-l-4 border-accent-deep pl-4">
            ยินดีต้อนรับสู่กิจกรรมสายรหัส 68 • 69
          </h2>
          <p className="text-text-muted leading-[1.8] mb-5 text-[1.05rem]">
            ทำการเฉลยสายรหัสในวันที่ 15 กรกฏาคม 2569 เวลา 16.30
            ณ อาคารสาขาวิศวกรรมคอมพิวเตอร์ (ตึก 6)
          </p>

          {/* Countdown */}
          <div className="my-5">
            <div className="flex items-center gap-2 mb-3.5 text-[0.78rem] font-bold tracking-[3px] uppercase text-accent opacity-85">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 2h14" />
                <path d="M5 22h14" />
                <path d="M19 2v4c0 3.83-3 7-7 7s-7-3.17-7-7V2" />
                <path d="M12 13c-4 0-7 3.17-7 7v2h14v-2c0-3.83-3-7-7-7z" />
              </svg>
              กิจกรรมจะสิ้นสุดในอีก
            </div>
            <CountdownTimer />
          </div>

          {/* My Hint / Senior Portal / Admin Portal card */}
          {loaded && user && (user.role === 'admin' || user.username === '0611610900') ? (
            <div className="flex flex-col items-start gap-2.5 mt-5 p-5 rounded-2xl w-full
              bg-white/[.02] border border-white/[.03]
              transition-all duration-300 hover:-translate-y-[5px] hover:border-[rgba(255,51,51,0.3)] hover:bg-white/[.04]">
              <span className="inline-block px-3 py-1 text-[0.85rem] font-semibold rounded-full mb-1
                bg-[rgba(255,51,51,0.15)] text-accent border border-accent/30">ระบบแอดมิน</span>
              <h3 className="text-base font-bold text-white mb-1">ระบบจัดการคำใบ้ (Admin Panel)</h3>
              <p className="text-text-muted text-sm leading-relaxed m-0">
                เข้าสู่ระบบแดชบอร์ดจัดการคำใบ้เพื่อดูข้อมูลคำใบ้และล้างข้อมูลที่ซ้ำกัน
              </p>
              <Link href="/admin" className="action-btn mt-1 w-[100%] text-center">เข้าสู่ระบบจัดการคำใบ้ (Admin)</Link>
            </div>
          ) : loaded && user && (!user.username?.startsWith('69') && user.role !== 'cpe69') ? (
            <div className="flex flex-col items-start gap-2.5 mt-5 p-5 rounded-2xl w-full
              bg-white/[.02] border border-white/[.03]
              transition-all duration-300 hover:-translate-y-[5px] hover:border-[rgba(255,51,51,0.3)] hover:bg-white/[.04]">
              <span className="inline-block px-3 py-1 text-[0.85rem] font-semibold rounded-full mb-1
                bg-[rgba(157,78,221,0.15)] text-[#d896ff]">ระบบพี่รหัส</span>
              <h3 className="text-base font-bold text-white mb-1">หน้าหลักสำหรับพี่รหัส</h3>
              <p className="text-text-muted text-sm leading-relaxed m-0">
                ปล่อยคำใบ้ที่ 2 และ 3 ให้กับน้องรหัสที่สุ่มได้ที่นี่
              </p>
              <Link href="/senior" className="action-btn mt-1 w-[100%] text-center">เปิดหน้าจัดการสำหรับพี่รหัส</Link>
            </div>
          ) : loaded && user ? (
            <div className="flex flex-col items-start gap-2.5 mt-5 p-5 rounded-2xl w-full
              bg-white/[.02] border border-white/[.03]
              transition-all duration-300 hover:-translate-y-[5px] hover:border-[rgba(255,51,51,0.3)] hover:bg-white/[.04]">
              <span className="inline-block px-3 py-1 text-[0.85rem] font-semibold rounded-full mb-1
                bg-[rgba(157,78,221,0.15)] text-[#d896ff]">กิจกรรม</span>
              <h3 className="text-base font-bold text-white mb-1">ตามหาพี่รหัสของคุณ</h3>
              <p className="text-text-muted text-sm leading-relaxed m-0">
                ตรวจสอบคำใบ้ทั้งหมดของคุณและติดตามการอัปเดตคำใบ้ใหม่ๆ ที่รุ่นพี่ของคุณปล่อยออกมาได้ที่นี่
              </p>
              <Link href="/my-hint" className="action-btn mt-1 w-[100%] text-center">ดูคำใบ้ของคุณ</Link>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2.5 mt-5 p-5 rounded-2xl w-full
              bg-white/[.02] border border-white/[.03]
              transition-all duration-300 hover:-translate-y-[5px] hover:border-[rgba(255,51,51,0.3)] hover:bg-white/[.04]">
              <span className="inline-block px-3 py-1 text-[0.85rem] font-semibold rounded-full mb-1
                bg-[rgba(157,78,221,0.15)] text-[#d896ff]">กิจกรรม</span>
              <h3 className="text-base font-bold text-white mb-1">เข้าสู่ระบบเพื่อดูคำใบ้สายรหัส</h3>
              <p className="text-text-muted text-sm leading-relaxed m-0">
                กรุณาเข้าสู่ระบบเพื่อตรวจสอบคำใบ้สายรหัสที่รุ่นพี่ปล่อยและติดตามตัวตนของพี่รหัสของคุณ
              </p>
              <Link href="/login" className="action-btn mt-1 w-[100%] text-center">เข้าสู่ระบบ</Link>
            </div>
          )}
        </main>

      <footer className="page-footer">
        Powerd By Computer Engineering 67 &amp; 68
      </footer>
    </div>
  );
}
