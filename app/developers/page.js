import Sidebar from '../components/Sidebar';
import Link from 'next/link';

const DEVELOPERS = [
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
  {
    img: '/img/support.png',
    role: 'Database & Support Developer',
    name: 'นายณิชกานต์ สุภผล',
    faculty: 'วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    major: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ปีที่ 3 (CPE 67)',
    ig: 'https://www.instagram.com/neko_0739?igsh=NGwweG1ic2RxMDE2',
  },
];

export default function DevelopersPage() {
  return (
    <div className="flex flex-col items-center min-h-screen text-center">
      <Sidebar />

      {/* Header */}
      <header className="mt-10 mb-5 px-6 text-center">
        <h1 className="text-[2.8rem] sm:text-[2rem] font-extrabold mb-3 bg-gradient-to-br from-white via-accent to-accent-deep
          bg-clip-text text-transparent tracking-tight title-glow">
          ทีมผู้พัฒนาเว็บ (WEB DEVELOPER TEAM)
        </h1>
        <p className="text-text-muted text-[1.1rem] font-light max-w-[600px] mx-auto">
          นักศึกษาสาขาวิชาวิศวกรรมคอมพิวเตอร์<br />
          คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏพิบูลสงคราม
        </p>
      </header>

      {/* Dev Cards Grid */}
      <div className="grid gap-6 max-w-[1400px] w-full px-5 mt-10 mb-16
        grid-cols-3
        max-[1100px]:grid-cols-2
        max-[640px]:grid-cols-1">
        {DEVELOPERS.map(dev => (
          <a key={dev.name}
            href={dev.ig} target="_blank" rel="noopener noreferrer"
            className="group relative flex flex-col items-center p-8 pb-7 rounded-[24px] bg-[rgba(26,26,26,0.55)] border border-white/[.05]
              transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] no-underline text-white block cursor-pointer
              hover:-translate-y-2 hover:border-accent/30 hover:bg-[rgba(26,26,26,0.85)]
              hover:shadow-[0_20px_45px_rgba(255,51,51,0.12),0_0_1px_rgba(255,51,51,0.4)]"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            {/* Radial glow overlay on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[400ms]
              pointer-events-none z-[1] rounded-[24px]"
              style={{ background: 'radial-gradient(circle at 50% 20%, rgba(255,51,51,0.06) 0%, transparent 60%)' }} />

            {/* Avatar container */}
            <div className="relative z-[2] w-[130px] h-[130px] rounded-full mb-5 flex-shrink-0
              bg-gradient-to-br from-white/10 to-[rgba(255,51,51,0.3)] p-[3px]
              shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)]
              group-hover:bg-gradient-to-br group-hover:from-accent group-hover:to-accent-deep
              group-hover:scale-[1.06] group-hover:shadow-[0_0_25px_rgba(255,51,51,0.35)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dev.img} alt={dev.name}
                className="w-full h-full rounded-full object-cover border-2 border-[#161616]" />
            </div>

            {/* Role badge */}
            <span className="relative z-[2] text-[0.75rem] font-extrabold uppercase tracking-[2px] text-accent/90
              bg-accent/10 px-3.5 py-1 rounded-[50px] mb-5 inline-block border border-accent/15">
              {dev.role}
            </span>

            {/* Name */}
            <h3 className="relative z-[2] text-[1.25rem] font-bold text-white mb-4 tracking-[0.5px]
              transition-colors duration-300 group-hover:text-accent">
              {dev.name}
            </h3>

            {/* Info table box */}
            <div className="relative z-[2] w-full bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5
              text-left mt-auto transition-colors duration-300 group-hover:bg-white/[0.04]">
              {[['คณะ', dev.faculty], ['สาขาวิชา', dev.major], ['ชั้นปี', dev.year]].map(([label, val]) => (
                <div key={label} className="flex justify-between mb-2 last:mb-0 text-[0.85rem] border-b border-white/[0.02] last:border-0 pb-1.5 last:pb-0">
                  <span className="text-text-muted">{label}</span>
                  <span className="text-white font-semibold text-right ml-2">{val}</span>
                </div>
              ))}
            </div>

            {/* IG Icon integration */}
            <div className="relative z-[2] w-[44px] h-[44px] rounded-[12px] flex items-center justify-center
              bg-white/[.02] border border-white/[.04] text-white/30 mt-5 overflow-hidden transition-all duration-[400ms]
              group-hover:border-transparent group-hover:shadow-[0_6px_20px_rgba(220,39,67,0.3)]"
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]
                opacity-0 group-hover:opacity-100 transition-opacity duration-[400ms] z-0" />
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className="relative z-10 text-white/30 group-hover:text-white transition-colors duration-[400ms]">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </div>
          </a>
        ))}
      </div>

      <footer className="page-footer">Powerd By Computer Engineering 67 &amp; 68</footer>
    </div>
  );
}
