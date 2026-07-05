'use client';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';

// ข้อมูล IG ของพี่รหัสทั้ง 38 คน (CPE 68)
// แก้ไข username ด้านล่างได้เลย ไม่ต้องใส่ @ นำหน้า
const IG_LIST = [
  { id: 1, handle: "p.phat_1" },
  { id: 2, handle: "picceskxnyk" },
  { id: 3, handle: "phetnarin06" },
  { id: 4, handle: "cnkpd_ton" },
  { id: 5, handle: "snxtp_6" },
  { id: 6, handle: "maimearailok" },
  { id: 7, handle: "mx_qrxhg" },
  { id: 8, handle: "pprt._.x" },
  { id: 9, handle: "saran_yu06" },
  { id: 10, handle: "ni_chaki" },
  { id: 11, handle: "natcha__vnt" },
  { id: 12, handle: "qiw_qqqqqqqq" },
  { id: 13, handle: "_p4iint" },
  { id: 14, handle: "_phxn.t" },
  { id: 15, handle: "formal_in_37" },
  { id: 16, handle: "trd_shel" },
  { id: 17, handle: "a.achit_" },
  { id: 18, handle: "aame_201" },
  { id: 19, handle: "adirek_74" },
  { id: 20, handle: "phxttanx" },
  { id: 21, handle: "p_ck6e" },
  { id: 22, handle: "supanat1109" },
  { id: 23, handle: "jakkrich2006" },
  { id: 24, handle: "natthanon_ar" },
  { id: 25, handle: "krsnulaksn" },
  { id: 26, handle: "naill9_" },
  { id: 27, handle: "sushixzo" },
  { id: 28, handle: "phoenix_thea" },
  { id: 29, handle: "korn__.06" },
  { id: 30, handle: "mnx_thj.04" },
  { id: 31, handle: "new_wiraphong" },
  { id: 32, handle: "sraawut_47" },
  { id: 33, handle: "phuri.ku" },
  { id: 34, handle: "arigato_ks" },
  { id: 35, handle: "phxysicxl._" },
  { id: 36, handle: "ntx.k_____x" },
  { id: 37, handle: "thiraphat6666" },
  { id: 38, handle: "pxxniiis" },
  { id: 39, handle: "thann_wa_" }
];

export default function IGPage() {
  return (
    <div className="ig-page-container">
      <Sidebar />

      {/* Navbar */}
      <nav className="navbar">
        <Link href="/" className="nav-logo">CPE Hint Portal</Link>
        <Link href="/" className="nav-btn">กลับหน้าหลัก</Link>
      </nav>

      <main className="main-content">
        <header className="header">
          <h1>IG พี่รหัส <span>CPE 68</span></h1>
          <p>รวม IG พี่รหัสที่เข้าร่วมการเล่นสายรหัสทั้งหมด (กดที่การ์ดเพื่อไปยังโปรไฟล์)</p>
        </header>

        <div className="ig-grid">
          {IG_LIST.map((item) => (
            <a 
              key={item.id} 
              href={`https://instagram.com/${item.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ig-card"
            >
              <div className="ig-card-inner">
                <div className="ig-icon-wrapper">
                  <svg 
                    width="28" height="28" viewBox="0 0 24 24" 
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                    className="ig-icon"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </div>
                <div className="ig-info">
                  <span className="ig-handle">@{item.handle}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </main>

      <footer>Powerd By Computer Engineering 66&68</footer>

      <style>{`
        .ig-page-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
          background: var(--bg-color);
          background-image: radial-gradient(circle at 15% 50%, rgba(131, 58, 180, 0.05) 0%, transparent 40%), 
                            radial-gradient(circle at 85% 30%, rgba(253, 29, 29, 0.05) 0%, transparent 40%),
                            radial-gradient(circle at 50% 80%, rgba(252, 176, 69, 0.05) 0%, transparent 40%);
        }

        .navbar {
          width: 100%;
          padding: 20px 5% 20px 80px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(11,15,25,0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          position: sticky;
          top: 0;
          z-index: 990;
        }

        .nav-logo {
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(135deg,#fff 0%,var(--accent-color) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-decoration: none;
        }

        .nav-btn {
          padding: 10px 20px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          color: white;
          text-decoration: none;
          transition: all 0.3s ease;
        }
        
        .nav-btn:hover {
          background: rgba(255,255,255,0.1);
        }

        .main-content {
          width: 100%;
          max-width: 1200px;
          padding: 40px 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .header {
          text-align: center;
          margin-bottom: 50px;
        }

        .header h1 {
          font-size: 3rem;
          font-weight: 800;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #fff 0%, #ddd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .header h1 span {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .header p {
          color: var(--text-secondary);
          font-size: 1.15rem;
          font-weight: 400;
        }

        .ig-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          width: 100%;
        }

        .ig-card {
          text-decoration: none;
          color: inherit;
          display: block;
        }

        .ig-card-inner {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
          overflow: hidden;
        }
        
        /* Hover effect with Instagram gradient */
        .ig-card-inner::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 0;
        }

        .ig-card:hover .ig-card-inner {
          transform: translateY(-5px) scale(1.02);
          border-color: transparent;
          box-shadow: 0 15px 30px rgba(220, 39, 67, 0.15);
        }
        
        .ig-card:hover .ig-card-inner::before {
          opacity: 0.1;
        }

        .ig-icon-wrapper {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: rgba(255,255,255,0.05);
          transition: all 0.3s ease;
        }
        
        .ig-card:hover .ig-icon-wrapper {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
          color: white;
          box-shadow: 0 5px 15px rgba(220, 39, 67, 0.3);
        }

        .ig-icon {
          color: var(--text-secondary);
          transition: color 0.3s ease;
        }
        
        .ig-card:hover .ig-icon {
          color: white;
        }

        .ig-info {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .ig-handle {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          transition: color 0.3s ease;
        }

        footer {
          margin-top: auto;
          padding: 30px;
          width: 100%;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.9rem;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        @media (max-width: 600px) {
          .header h1 {
            font-size: 2.2rem;
          }
          .ig-grid {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
          }
        }
      `}</style>
    </div>
  );
}
