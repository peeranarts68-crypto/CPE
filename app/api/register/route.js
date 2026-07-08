import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    return NextResponse.json(
      { success: false, message: 'ระบบปิดการลงทะเบียนแล้ว' },
      { status: 403 }
    );
    const data = await request.json();
    const username = (data.username || '').trim();
    const password = data.password || '';
    const firstName = (data.first_name || '').trim();
    const nickname = (data.nickname || '').trim();

    if (!username || !password || !firstName || !nickname) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' },
        { status: 400 }
      );
    }

    if (!/^(68|69)12247\d{3}$/.test(username)) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลผู้ใช้ในระบบ' },
        { status: 400 }
      );
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingUser = querySnapshot.docs[0].data();
      if (existingUser.is_duplicate) {
        return NextResponse.json(
          { success: false, message: 'ไม่พบข้อมูลผู้ใช้ในระบบ' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'รหัสนักศึกษานี้เคยลงทะเบียนแล้ว' },
        { status: 409 }
      );
    }

    const role = username.startsWith('68') ? 'cpe68' : 'cpe69';

    const hashedPassword = await bcrypt.hash(password, 10);
    await addDoc(usersRef, {
      username,
      password: hashedPassword,
      first_name: firstName,
      nickname,
      role,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'ลงทะเบียนสำเร็จ!' });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' },
      { status: 500 }
    );
  }
}
