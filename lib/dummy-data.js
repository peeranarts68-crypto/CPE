/**
 * DUMMY DATA — สำหรับ local testing เมื่อเชื่อม Firestore ไม่ได้
 * วิธีใช้: ไปที่ /backup แล้วกดปุ่ม "Backup & Use Dummy" เพื่อ populate ข้อมูลจาก DB จริง
 * จากนั้นตั้งค่า USE_DUMMY=true ใน .env.local
 *
 * โครงสร้าง hints doc:
 * { _id, senior_name, hint_text, hint_number, is_drawn, drawn_by, drawn_by_name, created_at }
 *
 * โครงสร้าง users doc:
 * { _id, username, password, first_name, nickname, role, created_at }
 */

export const DUMMY_HINTS = [
  {
    _id: 'hint_demo_1a',
    senior_name: 'พี่ทดสอบ',
    hint_text: 'ใส่แว่นตา ชอบกาแฟ',
    hint_number: 1,
    is_drawn: false,
    drawn_by: '',
    drawn_by_name: '',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    _id: 'hint_demo_1b',
    senior_name: 'พี่ทดสอบ',
    hint_text: 'ชอบเตะฟุตบอลตอนเย็น',
    hint_number: 2,
    is_drawn: false,
    drawn_by: '',
    drawn_by_name: '',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    _id: 'hint_demo_1c',
    senior_name: 'พี่ทดสอบ',
    hint_text: 'มีรถจักรยานยนต์สีดำ',
    hint_number: 3,
    is_drawn: false,
    drawn_by: '',
    drawn_by_name: '',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    _id: 'hint_demo_2a',
    senior_name: 'พี่ดีโม่สอง',
    hint_text: 'ผมสั้น นิสัยดี ชอบโค้ด',
    hint_number: 1,
    is_drawn: false,
    drawn_by: '',
    drawn_by_name: '',
    created_at: '2025-01-02T00:00:00.000Z',
  },
  {
    _id: 'hint_demo_2b',
    senior_name: 'พี่ดีโม่สอง',
    hint_text: 'ชอบดูอนิเมะ',
    hint_number: 2,
    is_drawn: false,
    drawn_by: '',
    drawn_by_name: '',
    created_at: '2025-01-02T00:00:00.000Z',
  },
  {
    _id: 'hint_demo_2c',
    senior_name: 'พี่ดีโม่สอง',
    hint_text: 'เรียนดี GPA 3.8',
    hint_number: 3,
    is_drawn: false,
    drawn_by: '',
    drawn_by_name: '',
    created_at: '2025-01-02T00:00:00.000Z',
  },
];

export const DUMMY_USERS = [
  {
    _id: 'user_senior_1',
    username: '6800000001',
    // password: "password123" (bcrypt hash — dummy store bypasses bcrypt check)
    password: '$2a$10$dummyhashsenior1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    first_name: 'พี่ทดสอบ',
    nickname: 'พี่ทดสอบ',
    role: 'cpe68',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    _id: 'user_junior_1',
    username: '6900000001',
    password: '$2a$10$dummyhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    first_name: 'น้องทดสอบ',
    nickname: 'น้อง',
    role: 'cpe69',
    created_at: '2025-01-01T00:00:00.000Z',
  },
];
