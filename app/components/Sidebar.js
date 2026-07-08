'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/',           label: 'หน้าแรก' },
  { href: '/random',     label: 'วงล้อสุ่มสายรหัส' },
  { href: '/my-hint',    label: 'ดูคำใบ้ของคุณ' },
  { href: '/senior',     label: 'สำหรับพี่รหัส' },
  { href: '/ig',         label: 'คอนแทคพี่รหัส' },
  { href: '/developers', label: 'ผู้พัฒนา' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [user, setUser]   = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    let userObj = null;
    try { userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null'); } catch (_) {}
    if (username) setUser({ username, ...userObj });
    else setUser(null);
    setLoaded(true);
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function handleLogout() {
    localStorage.removeItem('cpe_username');
    localStorage.removeItem('cpe_user');
    localStorage.removeItem('cpe_has_spun');
    setUser(null);
    window.location.href = '/';
  }

  const displayName = user
    ? (user.role === 'admin'
        ? 'แอดมินระบบ (Admin)'
        : user.username?.startsWith('68')
          ? `พี่ ${user.nickname || user.username}`
          : `น้อง ${user.nickname || user.username}`)
    : null;

  return (
    <>
      {/* ── Top Navbar ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-[1300] w-full flex items-center h-16 px-5 gap-3
          border-b border-white/5"
        style={{ background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-extrabold tracking-wider shrink-0 mr-2
            bg-gradient-to-br from-white to-accent bg-clip-text text-transparent"
        >
          CPE HINT
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-0.5 flex-1">
          {NAV_LINKS.filter(({ href }) => {
            if (href === '/random') {
              return false; // Hide random page since everyone drew
            }
            if (href === '/my-hint') {
              if (!user) return false; // Hide if not logged in
              const isSenior = user.username?.startsWith('68') || user.role === 'cpe68';
              const isAdmin = user.username === '0611610900' || user.role === 'admin';
              if (isSenior && !isAdmin) return false; // Hide for senior (except admin)
            }
            if (href === '/senior') {
              if (!user) return true;
              const isSenior = user.username?.startsWith('68') || user.role === 'cpe68';
              const isAdmin = user.username === '0611610900' || user.role === 'admin';
              return isSenior || isAdmin;
            }
            return true;
          }).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                ${pathname === href
                  ? 'text-accent bg-[rgba(255,51,51,0.12)] border border-[rgba(255,51,51,0.28)]'
                  : 'text-text-muted hover:text-white hover:bg-white/5'
                }`}
            >
              {label}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                ${pathname === '/admin'
                  ? 'text-accent bg-[rgba(255,51,51,0.12)] border border-[rgba(255,51,51,0.28)]'
                  : 'text-accent hover:text-white hover:bg-white/5'
                }`}
            >
              ระบบจัดการคำใบ้ (Admin)
            </Link>
          )}
        </div>

        {/* Flex spacer for mobile */}
        <div className="flex-1 lg:hidden" />

        {/* Auth slot — always visible */}
        {loaded && (
          <div className="shrink-0 flex items-center gap-3.5">
            {user ? (
              <>
                <span className="block text-xs sm:text-sm text-white font-bold max-w-[100px] sm:max-w-[160px] truncate">
                  {displayName}
                </span>
                <button
                  onClick={handleLogout}
                  className="w-9 h-9 sm:w-auto sm:h-auto rounded-lg text-sm font-semibold text-accent
                    border border-[rgba(255,51,51,0.3)] bg-[rgba(255,51,51,0.08)]
                    hover:bg-[rgba(255,51,51,0.18)] transition-all duration-200 cursor-pointer font-sans
                    flex items-center justify-center shrink-0 sm:px-3.5 sm:py-1.5"
                >
                  <span className="hidden sm:inline">ออกจากระบบ</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:hidden">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-lg text-sm font-bold text-white no-underline
                  bg-gradient-to-br from-accent to-accent-deep
                  hover:brightness-110 transition-all duration-200
                  shadow-[0_2px_12px_rgba(255,51,51,0.35)]"
              >
                เข้าสู่ระบบ / สมัครสมาชิก
              </Link>
            )}
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          id="hamburgerBtn"
          aria-label="เมนู"
          onClick={() => setMobileOpen(v => !v)}
          className={`lg:hidden shrink-0 flex flex-col justify-center items-center gap-[5px]
            w-9 h-9 rounded-lg border cursor-pointer transition-all duration-300 group
            ${mobileOpen
              ? 'border-accent/50 bg-accent/10 shadow-[0_0_12px_rgba(255,51,51,0.3)]'
              : 'border-white/10 bg-white/5 hover:border-accent/40 hover:bg-accent/[0.04] hover:shadow-[0_0_10px_rgba(255,51,51,0.25)]'
            }`}
        >
          <span className={`block w-[16px] h-[2px] rounded transition-all duration-300 ${mobileOpen ? 'translate-y-[7px] rotate-45 bg-accent' : 'bg-white group-hover:bg-accent'}`} />
          <span className={`block w-[16px] h-[2px] rounded transition-all duration-300 ${mobileOpen ? 'opacity-0' : 'bg-white group-hover:bg-accent'}`} />
          <span className={`block w-[16px] h-[2px] rounded transition-all duration-300 ${mobileOpen ? '-translate-y-[7px] -rotate-45 bg-accent' : 'bg-white group-hover:bg-accent'}`} />
        </button>
      </nav>

      {/* ── Mobile dropdown menu ── */}
      {/* h-16 spacer so fixed navbar doesn't overlap page content */}
      <div className="h-16 w-full shrink-0" />

      <div
        className={`fixed top-16 left-0 right-0 z-[1200] lg:hidden w-full overflow-hidden
          border-b border-white/5 transition-all duration-300 ease-in-out
          ${mobileOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}
        style={{ background: 'rgba(13,13,13,0.97)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex flex-col gap-1 px-4 py-3">
          {NAV_LINKS.filter(({ href }) => {
            if (href === '/random') {
              return false; // Hide random page since everyone drew
            }
            if (href === '/my-hint') {
              if (!user) return false; // Hide if not logged in
              const isSenior = user.username?.startsWith('68') || user.role === 'cpe68';
              const isAdmin = user.username === '0611610900' || user.role === 'admin';
              if (isSenior && !isAdmin) return false; // Hide for senior (except admin)
            }
            if (href === '/senior') {
              if (!user) return true;
              const isSenior = user.username?.startsWith('68') || user.role === 'cpe68';
              const isAdmin = user.username === '0611610900' || user.role === 'admin';
              return isSenior || isAdmin;
            }
            return true;
          }).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                ${pathname === href
                  ? 'text-accent bg-[rgba(255,51,51,0.1)] border border-[rgba(255,51,51,0.25)]'
                  : 'text-text-muted hover:text-white hover:bg-white/5'
                }`}
            >
              {label}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                ${pathname === '/admin'
                  ? 'text-accent bg-[rgba(255,51,51,0.1)] border border-[rgba(255,51,51,0.25)]'
                  : 'text-accent hover:text-white hover:bg-white/5'
                }`}
            >
              ระบบจัดการคำใบ้ (Admin)
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
