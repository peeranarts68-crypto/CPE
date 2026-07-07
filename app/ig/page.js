'use client';
import Sidebar from '../components/Sidebar';

const IG_LIST = [
  { id: 1,  handle: "p.phat_1" },
  { id: 2,  handle: "picceskxnyk" },
  { id: 3,  handle: "phetnarin06" },
  { id: 4,  handle: "cnkpd_ton" },
  { id: 5,  handle: "snxtp_6" },
  { id: 6,  handle: "maimearailok" },
  { id: 7,  handle: "mx_qrxhg" },
  { id: 8,  handle: "pprt._.xf" },
  { id: 9,  handle: "saran_yu06" },
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
  { id: 39, handle: "thann_wa_" },
];

export default function IGPage() {
  return (
    <div className="flex flex-col items-center min-h-screen">
      <Sidebar />

      <main className="w-full max-w-[1200px] px-5 py-10 flex-1 flex flex-col items-center">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-[3rem] sm:text-[2.2rem] font-extrabold mb-3
            bg-gradient-to-br from-white to-[#ddd] bg-clip-text text-transparent">
            IG พี่รหัส{' '}
            <span className="bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888]
              bg-clip-text text-transparent">CPE 68</span>
          </h1>
          <p className="text-text-muted text-[1.15rem]">
            รวม IG พี่รหัสที่เข้าร่วมการเล่นสายรหัสทั้งหมด (กดที่การ์ดเพื่อไปยังโปรไฟล์)
          </p>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 w-full">
          {IG_LIST.map((item) => (
            <a
              key={item.id}
              href={`https://instagram.com/${item.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block text-white no-underline"
            >
              <div className="relative overflow-hidden bg-white/[.03] border border-white/[.06]
                rounded-2xl py-4 px-6 sm:py-3.5 sm:px-5 flex items-center gap-4 sm:gap-3
                transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
                group-hover:-translate-y-[5px] group-hover:scale-[1.02]
                group-hover:border-transparent group-hover:shadow-[0_15px_30px_rgba(220,39,67,0.15)]">

                {/* Instagram gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]
                  opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-0 rounded-2xl" />

                 {/* Icon wrapper */}
                <div className="relative z-10 flex items-center justify-center w-[54px] h-[54px] sm:w-[48px] sm:h-[48px]
                  rounded-[14px] bg-white/5 flex-shrink-0 overflow-hidden transition-all duration-300
                  group-hover:shadow-[0_5px_15px_rgba(220,39,67,0.3)]">
                  {/* Inner gradient overlay for transition */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]
                    opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="relative z-10 text-text-muted group-hover:text-white transition-colors duration-300 w-[30px] h-[30px] sm:w-[26px] sm:h-[26px]">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </div>

                {/* Handle */}
                <div className="relative z-10 flex-1 min-w-0">
                  <span className="text-[1.1rem] sm:text-[1rem] font-semibold text-white block
                    group-hover:text-white transition-colors duration-300">
                    @{item.handle}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </main>

      <footer className="page-footer">Powerd By Computer Engineering 67 &amp; 68</footer>
    </div>
  );
}
