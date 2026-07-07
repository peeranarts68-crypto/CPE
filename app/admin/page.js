'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const [hints, setHints] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
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
    const userStr = localStorage.getItem('cpe_user');
    let role = '';
    if (userStr) {
      try {
        const uObj = JSON.parse(userStr);
        role = uObj.role;
      } catch (_) {}
    }
    if (username !== '0611610900' && role !== 'admin') {
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

  const filteredHints = hints.filter((group) =>
    (group.senior_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <div className="text-[1.2rem] font-semibold text-text-muted">กำลังโหลดข้อมูลแดชบอร์ด...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black flex flex-col items-center">
      {/* Floating Background Orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      {/* Floating back button */}
      <Link href="/" className="fixed top-6 left-6 z-[100] flex items-center gap-2 px-4 py-2.5 
        bg-white/[0.04] border border-white/10 rounded-full text-sm font-semibold text-text-secondary
        hover:text-white hover:border-accent hover:shadow-[0_0_20px_rgba(255,51,51,0.2)] hover:-translate-x-0.5
        backdrop-blur-md transition-all duration-300">
        <svg width="16" height="16" className="stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        หน้าแรก
      </Link>

      <div className="w-full max-w-6xl z-10">
        {/* Header Card */}
        <div className="glass-card p-6 sm:p-10 border-white/[0.05] text-center mb-8 flex flex-col items-center relative overflow-hidden">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight uppercase title-glow
            bg-gradient-to-br from-white via-white to-accent bg-clip-text text-transparent mb-2">
            Admin Dashboard
          </h1>
          <p className="text-text-secondary text-sm sm:text-base font-semibold mb-6">
            จัดการสถานะและคำใบ้ของพี่รหัสทั้งหมด ({hints.length} คน)
          </p>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleDedupe}
              disabled={deduping}
              className="px-6 py-2.5 rounded-full font-bold text-sm tracking-wide transition-all duration-300
                border cursor-pointer flex items-center gap-2
                bg-[rgba(255,165,0,0.06)] border-[rgba(255,165,0,0.3)] text-orange-400 hover:bg-[rgba(255,165,0,0.15)] hover:shadow-[0_0_15px_rgba(255,165,0,0.2)] hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg width="18" height="18" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {deduping ? 'กำลังล้างข้อมูล...' : 'ลบข้อมูลซ้ำ (Deduplicate)'}
            </button>
            {dedupeMsg && (
              <div className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-text-secondary animate-[fadeSlideIn_0.3s_ease-out]">
                {dedupeMsg}
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="w-full max-w-md mx-auto mb-8 relative">
          <input
            type="text"
            placeholder="ค้นหาชื่อพี่รหัส..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input-field pl-11 pr-4 py-3 rounded-full bg-white/[0.03] border-white/10 text-white placeholder-neutral-500 focus:border-accent text-sm"
          />
          <svg width="16" height="16" className="text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-accent text-center text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Cards Grid */}
        {filteredHints.length === 0 ? (
          <div className="glass-card py-16 text-center text-text-secondary text-base font-semibold border-white/[0.05]">
            {searchQuery ? 'ไม่พบข้อมูลพี่รหัสที่ตรงกับการค้นหา' : 'ไม่มีข้อมูลคำใบ้ในระบบ'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHints.map((group) => {
              const deleteHint = async (hintId) => {
                if (!window.confirm('คุณแน่ใจหรือว่าต้องการลบคำใบ้นี้?')) return;
                try {
                  const res = await fetch('/api/admin-hints/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hintId }),
                  });
                  if (!res.ok) throw new Error('Delete failed');
                  setHints((prev) =>
                    prev.map((g) => {
                      if (g.senior_name !== group.senior_name) return g;
                      return { ...g, hints: g.hints.filter((h) => h._id !== hintId) };
                    })
                  );
                } catch (e) {
                  console.error(e);
                  alert('ไม่สามารถลบคำใบ้ได้');
                }
              };

              return (
                <div
                  key={group.senior_name}
                  className="glass-card p-6 border-white/[0.05] hover:border-accent/30 
                    hover:shadow-[0_15px_35px_rgba(0,0,0,0.65),_0_0_30px_rgba(255,51,51,0.03)] 
                    transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Senior Header */}
                    <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-white/[0.06]">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/25 shrink-0">
                        <svg width="18" height="18" className="text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="font-bold text-white text-base sm:text-lg tracking-wide truncate">
                        {group.senior_name}
                      </span>
                    </div>

                    {/* Hint Slots */}
                    <div className="flex flex-col gap-4">
                      {[1, 2, 3].map((num) => {
                        const h = group.hints.find((x) => x.hint_number === num);
                        if (!h) {
                          return (
                            <div
                              key={num}
                              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.015] border border-white/[0.03]"
                            >
                              <svg width="18" height="18" className="text-neutral-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest leading-none mb-1">
                                  คำใบ้ที่ {num}
                                </span>
                                <span className="text-xs text-neutral-500 font-semibold">ยังไม่ได้สร้าง</span>
                              </div>
                            </div>
                          );
                        }

                        const isDrawn = h.is_drawn;
                        return (
                          <div
                            key={num}
                            className="flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-300 relative group/slot
                              bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
                          >
                            {/* Slot Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isDrawn ? (
                                  <>
                                    <svg width="16" height="16" className="text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
                                      คำใบ้ที่ {num} · ปล่อยแล้ว
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <svg width="16" height="16" className="text-orange-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-[10px] text-orange-400 font-extrabold uppercase tracking-widest">
                                      คำใบ้ที่ {num} · ยังไม่ปล่อย
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Delete Button */}
                              <button
                                onClick={() => deleteHint(h._id)}
                                className="opacity-0 group-hover/slot:opacity-100 transition-opacity duration-200
                                  w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/30 text-accent
                                  hover:bg-red-500/20 hover:border-red-500 hover:shadow-[0_0_10px_rgba(255,51,51,0.2)]
                                  flex items-center justify-center cursor-pointer"
                                title="ลบคำใบ้"
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>

                            {/* Hint Text */}
                            <p className="text-xs text-neutral-300 font-sans italic leading-relaxed font-light break-words">
                              "{h.hint_text}"
                            </p>

                            {/* Junior Info */}
                            {isDrawn && (
                              <div className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-white/[0.04] text-[10px] text-neutral-500 font-medium">
                                <svg width="14" height="14" className="text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>ผู้สุ่ม: {h.drawn_by_name || h.drawn_by || 'น้องรหัส'}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
