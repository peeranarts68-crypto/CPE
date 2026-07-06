'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState('login');

  // Login state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginMsg, setLoginMsg] = useState({ text: '', type: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regUser, setRegUser]   = useState('');
  const [regPass, setRegPass]   = useState('');
  const [regFirst, setRegFirst] = useState('');
  const [regNick, setRegNick]   = useState('');
  const [regMsg, setRegMsg]     = useState({ text: '', type: '' });
  const [regLoading, setRegLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    const userStr = localStorage.getItem('cpe_user');
    if (username) {
      let target = username.startsWith('68') ? '/senior' : '/random';
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role === 'admin') target = '/admin';
        } catch (e) {}
      } else if (username === '0611610900') {
        target = '/admin';
      }
      router.replace(target);
    }
  }, [router]);

  // Only digits in student ID fields
  const numOnly = v => v.replace(/\D/g, '').slice(0, 10);

  async function handleLogin(e) {
    e.preventDefault();
    const u = loginUser.trim();
    const p = loginPass;
    if (!/^\d{10}$/.test(u)) { setLoginMsg({ text: 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก', type: 'error' }); return; }
    if (!p) { setLoginMsg({ text: 'กรุณากรอกรหัสผ่าน', type: 'error' }); return; }
    setLoginLoading(true);
    setLoginMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('cpe_username', data.user?.username || u);
        localStorage.setItem('cpe_user', JSON.stringify(data.user || {}));
        localStorage.removeItem('cpe_has_spun');
        setLoginMsg({ text: `✓ ยินดีต้อนรับ ${data.user?.nickname || u}! กำลังพาไปหน้าหลัก...`, type: 'success' });
        let targetPath = u.startsWith('68') ? '/senior' : '/random';
        if (data.user?.role === 'admin') targetPath = '/admin';
        setTimeout(() => router.push(targetPath), 1000);
      } else {
        setLoginMsg({ text: data.message || 'เข้าสู่ระบบไม่สำเร็จ', type: 'error' });
        setLoginLoading(false);
      }
    } catch {
      setLoginMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
      setLoginLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const u = regUser.trim();
    const p = regPass;
    const f = regFirst.trim();
    const n = regNick.trim();
    if (!/^\d{10}$/.test(u)) { setRegMsg({ text: 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก', type: 'error' }); return; }
    if (p.length < 4)        { setRegMsg({ text: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', type: 'error' }); return; }
    if (!f || !n)            { setRegMsg({ text: 'กรุณากรอกชื่อจริงและชื่อเล่น', type: 'error' }); return; }
    setRegLoading(true);
    setRegMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, first_name: f, nickname: n }) });
      const data = await res.json();
      if (data.success) {
        setRegMsg({ text: '✓ สมัครสมาชิกสำเร็จ! กำลังพาไปหน้าเข้าสู่ระบบ...', type: 'success' });
        setTimeout(() => {
          setRegUser(''); setRegPass(''); setRegFirst(''); setRegNick('');
          setTab('login');
          setLoginUser(u);
        }, 1500);
      } else {
        setRegMsg({ text: data.message || 'การสมัครสมาชิกล้มเหลว', type: 'error' });
      }
      setRegLoading(false);
    } catch {
      setRegMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
      setRegLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Back button */}
      <Link href="/" className="back-btn" id="backBtn">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        หน้าแรก
      </Link>

      <div className="auth-wrapper">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-text">CPE HINT</div>
          <div className="auth-logo-sub">68 × 69 · Portal</div>
        </div>

        {/* Card */}
        <div className="auth-card">
          {/* Tab switcher */}
          <div className="tab-switcher" role="tablist">
            <button className={`tab-btn${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setLoginMsg({ text: '', type: '' }); setRegMsg({ text: '', type: '' }); }} id="tab-login" role="tab" aria-selected={tab === 'login'}>เข้าสู่ระบบ</button>
            <button className={`tab-btn${tab === 'register' ? ' active' : ''}`} onClick={() => { setTab('register'); setLoginMsg({ text: '', type: '' }); setRegMsg({ text: '', type: '' }); }} id="tab-register" role="tab" aria-selected={tab === 'register'}>สมัครสมาชิก</button>
          </div>

          {/* Login panel */}
          {tab === 'login' && (
            <div className="form-panel active" id="panel-login" role="tabpanel">
              <form onSubmit={handleLogin} noValidate>
                <div className="form-group">
                  <label htmlFor="loginUsername">รหัสนักศึกษา (10 หลัก)</label>
                  <input id="loginUsername" type="text" className="form-input" placeholder="6812345678" maxLength={10} inputMode="numeric" autoComplete="username" value={loginUser} onChange={e => setLoginUser(numOnly(e.target.value))} required />
                </div>
                <div className="form-group">
                  <label htmlFor="loginPassword">รหัสผ่าน</label>
                  <input id="loginPassword" type="password" className="form-input" placeholder="••••••••" autoComplete="current-password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                </div>
                <button type="submit" className="submit-btn" id="loginBtn" disabled={loginLoading}>
                  {loginLoading ? <><span className="btn-spinner" />กำลังดำเนินการ...</> : 'LOGIN'}
                </button>
                {loginMsg.text && <div className={`msg-area ${loginMsg.type}`} role="alert">{loginMsg.text}</div>}
              </form>
              <div className="switch-link">
                ยังไม่มีบัญชี? <button onClick={() => setTab('register')}>สมัครสมาชิกที่นี่</button>
              </div>
            </div>
          )}

          {/* Register panel */}
          {tab === 'register' && (
            <div className="form-panel active" id="panel-register" role="tabpanel">
              <form onSubmit={handleRegister} noValidate>
                <div className="form-group">
                  <label htmlFor="regUsername">รหัสนักศึกษา (10 หลัก)</label>
                  <input id="regUsername" type="text" className="form-input" placeholder="6812345678" maxLength={10} inputMode="numeric" autoComplete="username" value={regUser} onChange={e => setRegUser(numOnly(e.target.value))} required />
                </div>
                <div className="form-group">
                  <label htmlFor="regPassword">รหัสผ่าน</label>
                  <input id="regPassword" type="password" className="form-input" placeholder="••••••••" autoComplete="new-password" value={regPass} onChange={e => setRegPass(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="regFirstName">ชื่อจริง</label>
                  <input id="regFirstName" type="text" className="form-input" placeholder="เช่น สมชาย" autoComplete="given-name" value={regFirst} onChange={e => setRegFirst(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="regNickname">ชื่อเล่น</label>
                  <input id="regNickname" type="text" className="form-input" placeholder="เช่น ชาย" value={regNick} onChange={e => setRegNick(e.target.value)} required />
                </div>
                <button type="submit" className="submit-btn" id="registerBtn" disabled={regLoading}>
                  {regLoading ? <><span className="btn-spinner" />กำลังดำเนินการ...</> : 'REGISTER'}
                </button>
                {regMsg.text && <div className={`msg-area ${regMsg.type}`} role="alert">{regMsg.text}</div>}
              </form>
              <div className="switch-link">
                มีบัญชีแล้ว? <button onClick={() => setTab('login')}>เข้าสู่ระบบที่นี่</button>
              </div>
            </div>
          )}
        </div>

        <div className="auth-footer">Powerd By Computer Engineering 67 & 68</div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-x: hidden;
          position: relative;
        }
        .back-btn {
          position: fixed; top: 24px; left: 24px; z-index: 100;
          display: flex; align-items: center; gap: 8px;
          padding: 10px 18px;
          background: rgba(26,26,26,0.85);
          border: 1px solid rgba(255,51,51,0.25);
          border-radius: 50px;
          color: var(--text-secondary);
          font-size: 0.85rem; font-weight: 600; letter-spacing: 0.5px;
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }
        .back-btn:hover { color: var(--text-primary); border-color: var(--accent-color); box-shadow: 0 0 20px rgba(255,51,51,0.25); transform: translateX(-3px); }
        .back-btn svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .auth-wrapper { position: relative; z-index: 10; width: 100%; max-width: 440px; padding: 20px; }
        .auth-logo { text-align: center; margin-bottom: 32px; }
        .auth-logo-text { font-size: 2.4rem; font-weight: 800; letter-spacing: -1px; background: linear-gradient(135deg, #ffffff 0%, var(--accent-color) 50%, var(--accent-purple) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: pulse-glow 3s infinite alternate; }
        .auth-logo-sub { font-size: 0.8rem; color: var(--text-secondary); letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
        .auth-card { background: var(--card-bg); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.07); border-radius: 28px; padding: 36px 32px; box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,51,51,0.05), inset 0 1px 0 rgba(255,255,255,0.06); }
        .tab-switcher { display: flex; background: rgba(255,255,255,0.04); border-radius: 14px; padding: 4px; margin-bottom: 28px; border: 1px solid rgba(255,255,255,0.06); }
        .tab-btn { flex: 1; padding: 10px; background: transparent; border: none; border-radius: 10px; color: var(--text-secondary); font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; letter-spacing: 0.5px; }
        .tab-btn.active { background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-purple) 100%); color: #ffffff; box-shadow: 0 4px 15px rgba(255,51,51,0.35); }
        .tab-btn:not(.active):hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
        .form-panel { animation: fadeSlideIn 0.35s ease; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600; }
        .form-input { width: 100%; padding: 13px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; color: var(--text-primary); font-family: inherit; font-size: 1rem; transition: all 0.3s ease; }
        .form-input::placeholder { color: rgba(255,255,255,0.2); }
        .form-input:focus { outline: none; border-color: var(--accent-color); background: rgba(255,255,255,0.06); box-shadow: 0 0 20px rgba(255,51,51,0.18); }
        .submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-purple) 100%); border: none; border-radius: 12px; color: white; font-family: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; letter-spacing: 1.5px; transition: all 0.3s ease; box-shadow: 0 4px 20px rgba(255,51,51,0.35); margin-top: 4px; }
        .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,51,51,0.5); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .msg-area { margin-top: 14px; min-height: 22px; font-size: 0.875rem; text-align: center; font-weight: 500; }
        .msg-area.success { color: #4ade80; }
        .msg-area.error { color: var(--accent-color); }
        .switch-link { text-align: center; margin-top: 16px; font-size: 0.83rem; color: var(--text-secondary); }
        .switch-link button { background: none; border: none; color: var(--accent-color); font-family: inherit; font-size: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .switch-link button:hover { color: #ff6666; }
        .auth-footer { text-align: center; margin-top: 28px; font-size: 0.75rem; color: rgba(255,255,255,0.2); letter-spacing: 0.5px; }
        @media (max-width: 480px) { .auth-card { padding: 28px 20px; border-radius: 22px; } .auth-logo-text { font-size: 2rem; } }
      `}</style>
    </div>
  );
}
