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
  const [debugBypass, setDebugBypass] = useState(false);


  // Register state
  const [regUser, setRegUser]   = useState('');
  const [regPass, setRegPass]   = useState('');
  const [regFirst, setRegFirst] = useState('');
  const [regNick, setRegNick]   = useState('');
  const [regMsg, setRegMsg]     = useState({ text: '', type: '' });
  const [regLoading, setRegLoading] = useState(false);

  const [checkingAuth, setCheckingAuth] = useState(true);

  // Redirect if already logged in
  useEffect(() => {
    const username = localStorage.getItem('cpe_username');
    const userStr = localStorage.getItem('cpe_user');
    if (username) {
      let target = username.startsWith('68') ? '/senior' : '/my-hint';
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role === 'admin') target = '/admin';
        } catch (e) {}
      } else if (username === '0611610900') {
        target = '/admin';
      }
      router.replace(target);
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  const numOnly = v => v.replace(/\D/g, '').slice(0, 10);

  function clearMsgs() {
    setLoginMsg({ text: '', type: '' });
    setRegMsg({ text: '', type: '' });
  }

  async function handleLogin(e) {
    e.preventDefault();
    const u = loginUser.trim();
    const p = loginPass;
    if (u !== '0611610900' && !/^(68|69)12247\d{3}$/.test(u)) { setLoginMsg({ text: 'รหัสนักศึกษาไม่ถูกต้อง (ต้องขึ้นต้นด้วย 6812247 หรือ 6912247 และมีความยาว 10 หลัก)', type: 'error' }); return; }
    if (!debugBypass && !p) { setLoginMsg({ text: 'กรุณากรอกรหัสผ่าน', type: 'error' }); return; }
    setLoginLoading(true);
    setLoginMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u,
          password: p,
          debugBypass: debugBypass && process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('cpe_username', data.user?.username || u);
        localStorage.setItem('cpe_user', JSON.stringify(data.user || {}));
        localStorage.removeItem('cpe_has_spun');
        let targetPath = u.startsWith('68') ? '/senior' : '/my-hint';
        if (data.user?.role === 'admin') targetPath = '/admin';
        setTimeout(() => router.push(targetPath), 300);
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
    if (!/^(68|69)12247\d{3}$/.test(u)) { setRegMsg({ text: 'รหัสนักศึกษาไม่ถูกต้อง (ต้องขึ้นต้นด้วย 6812247 หรือ 6912247 และมีความยาว 10 หลัก)', type: 'error' }); return; }
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[1.2rem] font-semibold text-text-muted">
          กำลังโหลดข้อมูล...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-x-hidden relative">

      {/* Back button */}
      <Link href="/" id="backBtn" className="back-pill">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        หน้าแรก
      </Link>

      <div className="relative z-10 w-full max-w-[440px] px-5 py-5">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-[2.4rem] font-extrabold tracking-tight bg-gradient-to-br from-white via-accent to-accent-deep
            bg-clip-text text-transparent animate-[pulse-glow_3s_infinite_alternate]">
            CPE HINT
          </div>
          <div className="text-[0.8rem] text-text-muted tracking-[3px] uppercase mt-1">
            68 × 69 · Portal
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-9 sm:p-7"
          style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,51,51,0.05), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

          {/* Tab switcher */}
          <div className="flex bg-white/[.04] rounded-xl p-1 mb-7 border border-white/[.06]" role="tablist">
            {[{ key: 'login', label: 'เข้าสู่ระบบ', id: 'tab-login' }, { key: 'register', label: 'สมัครสมาชิก', id: 'tab-register' }].map(({ key, label, id }) => (
              <button
                key={key}
                id={id}
                role="tab"
                aria-selected={tab === key}
                onClick={() => { setTab(key); clearMsgs(); }}
                className={`flex-1 py-2.5 rounded-[10px] font-sans text-[0.9rem] font-semibold cursor-pointer
                  tracking-[0.5px] transition-all duration-300 border-0
                  ${tab === key
                    ? 'bg-gradient-to-br from-accent to-accent-deep text-white shadow-[0_4px_15px_rgba(255,51,51,0.35)]'
                    : 'bg-transparent text-text-muted hover:text-white hover:bg-white/5'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Login panel */}
          {tab === 'login' && (
            <div id="panel-login" role="tabpanel" className="animate-[fadeSlideIn_0.35s_ease]">
              <form onSubmit={handleLogin} noValidate>
                <div className="mb-[18px]">
                  <label htmlFor="loginUsername" className="block text-[0.78rem] text-text-muted mb-2 uppercase tracking-[1.2px] font-semibold">
                    รหัสนักศึกษา (10 หลัก)
                  </label>
                  <input
                    id="loginUsername" type="text" className="form-input-field"
                    placeholder="6812345678" maxLength={10} inputMode="numeric"
                    autoComplete="username" value={loginUser}
                    onChange={e => setLoginUser(numOnly(e.target.value))} required
                  />
                </div>
                {!debugBypass && (
                  <div className="mb-[18px] animate-[fadeSlideIn_0.2s_ease]">
                    <label htmlFor="loginPassword" className="block text-[0.78rem] text-text-muted mb-2 uppercase tracking-[1.2px] font-semibold">
                      รหัสผ่าน
                    </label>
                    <input
                      id="loginPassword" type="password" className="form-input-field"
                      placeholder="••••••••" autoComplete="current-password"
                      value={loginPass} onChange={e => setLoginPass(e.target.value)} required={!debugBypass}
                    />
                  </div>
                )}
                {process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' && (
                  <div className="mb-[18px] flex items-center justify-between bg-white/[0.02] border border-dashed border-accent/20 rounded-xl p-3 animate-[fadeSlideIn_0.35s_ease]">
                    <span className="text-[0.8rem] text-accent font-semibold uppercase tracking-[0.5px]">
                      โหมดผู้พัฒนา (ข้ามรหัสผ่าน)
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={debugBypass}
                        onChange={e => {
                          setDebugBypass(e.target.checked);
                          if (e.target.checked) {
                            setLoginPass('');
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-white after:border-transparent after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>
                )}
                <button type="submit" id="loginBtn" className="submit-btn-full" disabled={loginLoading}>
                  {loginLoading
                    ? <><span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin align-middle mr-2" />กำลังดำเนินการ...</>
                    : 'LOGIN'}
                </button>
                {loginMsg.text && (
                  <div role="alert" className={`mt-3.5 min-h-[22px] text-[0.875rem] text-center font-medium
                    ${loginMsg.type === 'success' ? 'text-[#4ade80]' : 'text-accent'}`}>
                    {loginMsg.text}
                  </div>
                )}
              </form>
              <div className="text-center mt-4 text-[0.83rem] text-text-muted">
                ยังไม่มีบัญชี?{' '}
                <button onClick={() => setTab('register')}
                  className="bg-transparent border-0 text-accent font-semibold cursor-pointer
                    underline underline-offset-[3px] text-[inherit] font-sans hover:text-[#ff6666]">
                  สมัครสมาชิกที่นี่
                </button>
              </div>
            </div>
          )}

          {/* Register panel */}
          {tab === 'register' && (
            <div id="panel-register" role="tabpanel" className="animate-[fadeSlideIn_0.35s_ease] text-center py-6">
              <div className="text-[2.2rem] mb-4 text-accent">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-accent">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3 className="text-[1.25rem] font-bold text-white mb-2">ปิดการลงทะเบียนแล้ว</h3>
              <p className="text-text-muted text-[0.9rem] leading-relaxed mb-6">
                ระบบลงทะเบียนปิดทำการแล้วเนื่องจากการจับสุ่มสายรหัสเสร็จสิ้นแล้ว
              </p>
              <button onClick={() => setTab('login')} className="submit-btn-full">
                ย้อนกลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-7 text-[0.75rem] text-white/45 tracking-[0.5px]">
          Powerd By Computer Engineering 67 &amp; 68
        </div>
      </div>
    </div>
  );
}
