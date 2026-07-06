import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const data = await request.json();
    const username = (data.username || '').trim();
    const password = data.password || '';

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' },
        { status: 400 }
      );
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { success: false, message: 'รหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' },
      { status: 500 }
    );
  }
}
