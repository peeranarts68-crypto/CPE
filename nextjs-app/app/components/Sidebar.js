'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/',           label: 'หน้าแรก (Home)' },
  { href: '/random',     label: 'วงล้อสุ่มสายรหัส (Lucky Wheel)' },
  { href: '/senior',     label: 'สำหรับพี่รหัส (For Seniors)' },
  { href: '/developers', label: 'ผู้พัฒนาเว็บ (Web Developers)' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auth states inside the sidebar
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Load user status
  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    let userObj = null;
    try {
      userObj = JSON.parse(localStorage.getItem('cpe_user') || 'null');
    } catch (_) {}
    if (username) {
      setUser({ username, ...userObj });
    } else {
      setUser(null);
    }
    setLoaded(true);
  }, [pathname, open]); // Reload when pathname changes or menu opens

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggle = () => setOpen(v => !v);

  function handleLogout() {
    localStorage.removeItem('cpe_username');
    localStorage.removeItem('cpe_user');
    localStorage.removeItem('cpe_has_spun');
    setUser(null);
    window.location.href = '/'; // Go to home page & refresh
  }

  return (
    <>
      {/* Hamburger button */}
      <button
        className={`hamburger-btn${open ? ' active' : ''}`}
        onClick={toggle}
        aria-label="Menu"
        id="hamburgerBtn"
      >
        <span />
        <span />
        <span />
      </button>

      {/* Overlay */}
      <div
        className={`sidebar-overlay${open ? ' active' : ''}`}
        onClick={toggle}
      />

      {/* Drawer */}
      <div className={`sidebar-menu${open ? ' active' : ''}`} id="sidebarMenu">
        <div className="sidebar-header">
          <Link href="/" className="sidebar-logo">CPE HINT</Link>
        </div>

        <ul className="sidebar-links">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`sidebar-link${pathname === href ? ' active-link' : ''}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Dynamic Auth Slot */}
        {loaded && (
          <div style={{ marginTop: 25, padding: '0 10px' }}>
            {user ? (
              <>
                <div style={{ padding: 15, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 15 }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>เข้าสู่ระบบโดย</p>
                  <p style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                    {user.username.startsWith('68') 
                      ? `พี่ ${user.nickname || user.username} (CPE 68)` 
                      : `น้อง ${user.nickname || user.username} (CPE 69)`}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.username}</p>
                </div>
                <button onClick={handleLogout} className="login-btn" style={{ background: 'rgba(255,51,51,0.15)', color: 'var(--accent-color)', border: '1px solid rgba(255,51,51,0.3)', fontSize: '0.9rem', padding: 10, cursor: 'pointer', width: '100%', borderRadius: 12, fontFamily: 'inherit', fontWeight: 700 }}>ออกจากระบบ</button>
              </>
            ) : (
              <Link href="/login" className="login-btn" style={{ textAlign: 'center', textDecoration: 'none', display: 'block', lineHeight: 1.2, padding: '12px 0', background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-purple) 100%)', borderRadius: 12, fontWeight: 700, color: '#fff' }}>
                เข้าสู่ระบบ / สมัครสมาชิก
              </Link>
            )}
          </div>
        )}

        <div className="sidebar-footer">
          &copy; 2026 Department of Computer Engineering
        </div>
      </div>
    </>
  );
}
