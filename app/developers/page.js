import Sidebar from '../components/Sidebar';

const DEVELOPERS = [
    {
    img: '/img/leaddev.jpg',
    role: 'Databse&Support Developer',
    name: 'นายณิชกานต์ สุภผล',
    faculty: 'วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    major: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ปีที่ 3 (CPE 67)',
    ig: 'https://www.instagram.com/neko_0739?igsh=NGwweG1ic2RxMDE2',
  },
  {
    img: '/img/devnew1.jpg',
    role: 'Lead Developer',
    name: 'นายพีรนาท สิงห์โต',
    faculty: 'วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    major: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ปีที่ 2 (CPE 68)',
    ig: 'https://www.instagram.com/s.peeranart/',
  },
  {
    img: '/img/dev6.jpg',
    role: 'Supporter',
    name: 'นายภูริณัฐ หินอ่อน',
    faculty: 'วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    major: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ปีที่ 2 (CPE 68)',
    ig: 'https://www.instagram.com/phurinat37?igsh=MTUxbHNoOW81ZjA2bQ==',
  },
  {
    img: '/img/devnew2.jpg',
    role: 'Supporter',
    name: 'นายพิชญางกูร ขำปลอด',
    faculty: 'วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    major: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ปีที่ 2 (CPE 68)',
    ig: 'https://www.instagram.com/_saef.ivu?igsh=MXkwYzdwYnZmMWkyaw=',
  },
  {
    img: '/img/devnew3.jpg',
    role: 'Supporter',
    name: 'นางสาวณัชชา เพ็งน้อย',
    faculty: 'วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    major: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ปีที่ 2 (CPE 68)',
    ig: 'https://www.instagram.com/natcha__vnt?igsh=MW9rN2RiazNpODBxMQ%3D%3D&utm_source=qr',
  },
  {
    img: '/img/dev5.jpg',
    role: 'Graphic Designer',
    name: 'นายจักรกฤษณ์ พลอาชา (อาโป)',
    faculty: 'วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    major: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ปีที่ 2 (CPE 68)',
    ig: 'https://www.instagram.com/jakxx_03',
  },
];

export default function DevelopersPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <Sidebar />

      <header className="header">
        <h1>ทีมผู้พัฒนาเว็บ (WEB DEVELOPER TEAM)</h1>
        <p>นักศึกษาสาขาวิชาวิศวกรรมคอมพิวเตอร์<br />คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏพิบูลสงคราม</p>
      </header>

      <div className="team-container">
        {DEVELOPERS.map(dev => (
          <div key={dev.name} className="dev-card">
            <div className="img-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dev.img} alt={dev.name} />
            </div>
            <span className="dev-role">{dev.role}</span>
            <h3 className="dev-name">{dev.name}</h3>
            <div className="dev-info-box">
              <div className="info-row"><span className="info-label">คณะ:</span><span className="info-val">{dev.faculty}</span></div>
              <div className="info-row"><span className="info-label">สาขาวิชา:</span><span className="info-val">{dev.major}</span></div>
              <div className="info-row"><span className="info-label">ชั้นปี:</span><span className="info-val">{dev.year}</span></div>
            </div>
            <div className="social-container">
              <a href={dev.ig} target="_blank" rel="noopener noreferrer" className="social-btn" title="Instagram">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/instagram-icon.svg" alt="Instagram" className="social-icon" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <footer>Powerd By Computer Engineering 67 & 68</footer>

      <style>{`
        .header { margin: 60px 0 20px; padding: 0 20px; }
        .header h1 { font-size: 2.8rem; font-weight: 800; background: linear-gradient(135deg,#fff 0%,var(--accent-color) 50%,var(--accent-purple) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; letter-spacing: -0.5px; filter: drop-shadow(0 0 20px rgba(255,51,51,0.4)) drop-shadow(0 0 40px rgba(255,51,51,0.2)); animation: titleGlow 3s ease-in-out infinite alternate; }
        @keyframes titleGlow { from { filter: drop-shadow(0 0 15px rgba(255,51,51,0.3)) drop-shadow(0 0 30px rgba(255,51,51,0.1)); } to { filter: drop-shadow(0 0 30px rgba(255,51,51,0.6)) drop-shadow(0 0 60px rgba(255,51,51,0.3)); } }
        .header p { color: var(--text-secondary); font-size: 1.1rem; font-weight: 300; max-width: 600px; margin: 0 auto; }
        .team-container { display: grid; grid-template-columns: repeat(6,1fr); gap: 15px; max-width: 1600px; width: 98%; margin: 40px auto 60px; }
        @media (max-width: 1500px) { .team-container { grid-template-columns: repeat(3,1fr); } }
        @media (max-width: 850px) { .team-container { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 550px) { .team-container { grid-template-columns: 1fr; } }
        .dev-card { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 30px 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.4); transition: all 0.4s cubic-bezier(0.165,0.84,0.44,1); position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; }
        .dev-card::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle,rgba(255,51,51,0.08) 0%,transparent 60%); opacity: 0; transition: opacity 0.4s ease; pointer-events: none; z-index: 1; }
        .dev-card:hover { transform: translateY(-8px) scale(1.02); border-color: rgba(255,51,51,0.3); box-shadow: 0 20px 40px rgba(255,51,51,0.15),0 0 1px rgba(255,51,51,0.5); }
        .dev-card:hover::before { opacity: 1; }
        .img-container { width: 140px; height: 140px; border-radius: 50%; padding: 4px; background: linear-gradient(135deg,rgba(255,255,255,0.1) 0%,rgba(255,51,51,0.4) 100%); margin-bottom: 20px; position: relative; z-index: 2; transition: transform 0.4s ease; box-shadow: 0 8px 25px rgba(0,0,0,0.5); }
        .dev-card:hover .img-container { transform: scale(1.08) rotate(3deg); background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-purple) 100%); box-shadow: 0 0 20px rgba(255,51,51,0.4); }
        .img-container img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #0d0d0d; }
        .dev-role { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-color); background: rgba(255,51,51,0.1); padding: 4px 12px; border-radius: 20px; margin-bottom: 15px; display: inline-block; z-index: 2; }
        .dev-name { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; z-index: 2; letter-spacing: 0.3px; text-shadow: 0 0 12px rgba(255,255,255,0.1); transition: text-shadow 0.3s ease; }
        .dev-card:hover .dev-name { text-shadow: 0 0 18px rgba(255,51,51,0.4); }
        .dev-info-box { width: 100%; background: rgba(255,255,255,0.02); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.03); text-align: left; z-index: 2; margin-top: auto; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.85rem; }
        .info-row:last-child { margin-bottom: 0; }
        .info-label { color: var(--text-secondary); }
        .info-val { color: var(--text-primary); font-weight: 600; text-align: right; }
        .social-container { display: flex; gap: 12px; margin-top: 15px; z-index: 2; }
        .social-btn { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 0.85rem; text-decoration: none; transition: all 0.3s ease; }
        .social-btn:hover { background: linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); border-color: transparent; transform: translateY(-3px) scale(1.1); box-shadow: 0 6px 20px rgba(220,39,67,0.5); }
        .social-icon { width: 26px; height: 26px; object-fit: contain; border-radius: 6px; display: block; }
        footer { margin-top: auto; padding: 30px; width: 100%; color: var(--text-secondary); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
}
