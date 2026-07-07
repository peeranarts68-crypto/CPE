'use client';
import React, { useState, useEffect } from 'react';
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
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5z"/>
          <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/>
        </svg>
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
            ยินดีต้อนรับน้องๆเพื่อสุ่มสายรหัส
          </h2>
          <p className="text-text-muted leading-[1.8] mb-5 text-[1.05rem]">
            ทำการสุ่มสายรหัสในวันที่ 8 กรกฏาคม 2569 เวลา 13.00
            ณ ห้องโถงกิจการนักศึกษาคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม
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
              นับถอยหลังวันสุ่มสายรหัส
            </div>
            <CountdownTimer />
          </div>

          {/* Lucky Wheel card */}
          <div className="flex flex-col items-start gap-2.5 mt-5 p-5 rounded-2xl
            bg-white/[.02] border border-white/[.03]
            transition-all duration-300 hover:-translate-y-[5px] hover:border-[rgba(255,51,51,0.3)] hover:bg-white/[.04]">
            <span className="inline-block px-3 py-1 text-[0.85rem] font-semibold rounded-full mb-1
              bg-[rgba(157,78,221,0.15)] text-[#d896ff]">กิจกรรม</span>
            <h3 className="text-base font-bold text-white mb-1">วงล้อสุ่มสายรหัส (CPE Lucky Wheel)</h3>
            <p className="text-text-muted text-sm leading-relaxed m-0">
              เข้าร่วมการสุ่มสายรหัสด้วยวงล้อ คำใบ้ครั้งที่2-3 จะขึ้นอยู่กับการกดปล่อยคำใบ้จากรุ่นพี่
            </p>
            <Link href="/random" className="action-btn mt-1 w-[100%] text-center">เปิดวงล้อสุ่มสายรหัส</Link>
          </div>
        </main>

      <footer className="page-footer">
        Powerd By Computer Engineering 67 &amp; 68
      </footer>
    </div>
  );
}
