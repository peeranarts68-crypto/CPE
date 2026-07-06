import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

/**
 * GET /api/backup
 * ดึง hints + users ทั้งหมดจาก DB (หรือ dummy store)
 * แล้วคืน JSON สำหรับนำไป seed ลง dummy-data.js
 */
export async function GET() {
  try {
    if (USE_DUMMY) {
      const { hintsStore, usersStore } = await import('@/lib/dummy-store');
      return NextResponse.json({
        success: true,
        source: 'dummy',
        hints: hintsStore.all(),
        users: usersStore.all().map((u) => ({ ...u, password: '[REDACTED]' })),
      });
    }

    // Real Firestore
    const { db } = await import('@/lib/firebase');
    const { collection, getDocs } = await import('firebase/firestore');

    const [hintsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'hints')),
      getDocs(collection(db, 'users')),
    ]);

    const hints = hintsSnap.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
    // ซ่อน password hash ใน response
    const users = usersSnap.docs.map((doc) => {
      const { password, ...rest } = doc.data();
      return { _id: doc.id, ...rest, password: '[REDACTED]' };
    });

    return NextResponse.json({ success: true, source: 'firestore', hints, users });
  } catch (err) {
    console.error('backup error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/backup/seed
 * รับ { hints, users } แล้ว seed เข้า dummy store (runtime only)
 * ใช้ตอนกดปุ่ม "Load into Dummy" บน /backup page
 */
export async function POST(request) {
  try {
    const { hintsStore, usersStore } = await import('@/lib/dummy-store');
    const { hints = [], users = [] } = await request.json();

    hintsStore.seed(hints);
    usersStore.seed(users.map((u) => ({ ...u, password: 'password123' })));

    return NextResponse.json({
      success: true,
      message: `Seeded ${hints.length} hints, ${users.length} users into dummy store`,
    });
  } catch (err) {
    console.error('backup seed error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
