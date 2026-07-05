import "./globals.css";

export const metadata = {
  title: "CPE Hint 68-69",
  description: "ระบบสุ่มสายรหัส CPE 68-69 — คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏพิบูลสงคราม",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
