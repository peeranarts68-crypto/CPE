import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
// ใน dummy mode: login ผ่านเสมอโดยจับคู่ username + password ตรงๆ (ไม่ hash)
// password สำหรับ dummy users คือ "password123"
async function handleDummy(request) {
  const { usersStore } = await import('@/lib/dummy-store');
  const data = await request.json();
  const username = (data.username || '').trim();
  const password = data.password || '';

  if (!username || !password) {
    return NextResponse.json({ success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' }, { status: 400 });
  }

  const user = usersStore.findByUsername(username);
  if (!user) {
    return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' }, { status: 401 });
  }

  // Dummy mode: ใช้ password "password123" สำหรับทุก account หรือตรวจสอบตรงๆ
  const validPassword = password === 'password123' || password === user.password;
  if (!validPassword) {
    return NextResponse.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง (dummy password: password123)' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      username: user.username,
      first_name: user.first_name,
      nickname: user.nickname,
      role: user.role || (user.username.startsWith('68') ? 'cpe68' : 'cpe69'),
    },
  });
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal(request) {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
  const bcrypt = (await import('bcryptjs')).default;

  const data = await request.json();
  const username = (data.username || '').trim();
  const password = data.password || '';

  if (!username || !password) {
    return NextResponse.json({ success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' }, { status: 400 });
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username), limit(1));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' }, { status: 401 });
  }

  const userDoc = querySnapshot.docs[0];
  const user = userDoc.data();
  const match = await bcrypt.compare(password, user.password);

  if (match) {
    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        first_name: user.first_name,
        nickname: user.nickname,
        role: user.username === '0611610900' ? 'admin' : (user.role || 'cpe69'),
      },
    });
  } else {
    return NextResponse.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    return USE_DUMMY ? await handleDummy(request) : await handleReal(request);
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' }, { status: 500 });
  }
}
