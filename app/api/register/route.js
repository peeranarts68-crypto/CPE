import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
async function handleDummy(request) {
  const { usersStore } = await import('@/lib/dummy-store');
  const data = await request.json();
  const username = (data.username || '').trim();
  const password = data.password || '';
  const firstName = (data.first_name || '').trim();
  const nickname = (data.nickname || '').trim();

  if (!username || !password || !firstName || !nickname) {
    return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' }, { status: 400 });
  }
  if (!/^\d{10}$/.test(username)) {
    return NextResponse.json({ success: false, message: 'Username ต้องเป็นรหัสนักศึกษา 10 หลักเท่านั้น' }, { status: 400 });
  }

  const existing = usersStore.findByUsername(username);
  if (existing) {
    return NextResponse.json({ success: false, message: 'รหัสนักศึกษานี้เคยลงทะเบียนแล้ว' }, { status: 409 });
  }

  const role = username.startsWith('68') ? 'cpe68' : 'cpe69';
  usersStore.insert({ username, password, first_name: firstName, nickname, role, created_at: new Date().toISOString() });
  return NextResponse.json({ success: true, message: 'ลงทะเบียนสำเร็จ! (dummy mode)' });
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal(request) {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, limit, addDoc } = await import('firebase/firestore');
  const bcrypt = (await import('bcryptjs')).default;

  const data = await request.json();
  const username = (data.username || '').trim();
  const password = data.password || '';
  const firstName = (data.first_name || '').trim();
  const nickname = (data.nickname || '').trim();

  if (!username || !password || !firstName || !nickname) {
    return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' }, { status: 400 });
  }
  if (!/^\d{10}$/.test(username)) {
    return NextResponse.json({ success: false, message: 'Username ต้องเป็นรหัสนักศึกษา 10 หลักเท่านั้น' }, { status: 400 });
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username), limit(1));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    return NextResponse.json({ success: false, message: 'รหัสนักศึกษานี้เคยลงทะเบียนแล้ว' }, { status: 409 });
  }

  const role = username.startsWith('68') ? 'cpe68' : 'cpe69';
  const hashedPassword = await bcrypt.hash(password, 10);
  await addDoc(usersRef, { username, password: hashedPassword, first_name: firstName, nickname, role, created_at: new Date().toISOString() });
  return NextResponse.json({ success: true, message: 'ลงทะเบียนสำเร็จ!' });
}

export async function POST(request) {
  try {
    return USE_DUMMY ? await handleDummy(request) : await handleReal(request);
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' }, { status: 500 });
  }
}
