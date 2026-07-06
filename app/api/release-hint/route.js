import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, limit } from 'firebase/firestore';

export async function POST(request) {
  try {
    const data = await request.json();
    const seniorName = (data.senior_name || '').trim();
    const hintNumber = parseInt(data.hint_number || 0);
    const juniorId = (data.junior_id || '').trim();

    if (!seniorName || hintNumber <= 1 || !juniorId) {
      return NextResponse.json(
        { success: false, message: 'ข้อมูลไม่ครบถ้วน (senior_name, hint_number, junior_id)' },
        { status: 400 }
      );
    }

    const hintsRef = collection(db, 'hints');

    const q1 = query(
      hintsRef,
      where('senior_name', '==', seniorName),
      where('hint_number', '==', 1),
      where('drawn_by', '==', juniorId),
      limit(1)
    );
    const querySnapshot1 = await getDocs(q1);

    if (querySnapshot1.empty) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลความสัมพันธ์สายรหัสที่ถูกต้อง' },
        { status: 403 }
      );
    }

    const firstHintDoc = querySnapshot1.docs[0].data();
    const juniorName = firstHintDoc.drawn_by_name || 'น้องรหัส';

    const q2 = query(
      hintsRef,
      where('senior_name', '==', seniorName),
      where('hint_number', '==', hintNumber),
      limit(1)
    );
    const querySnapshot2 = await getDocs(q2);

    if (querySnapshot2.empty) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลคำใบ้หรือไม่มีการเปลี่ยนแปลง' },
        { status: 404 }
      );
    }

    const targetDoc = querySnapshot2.docs[0];
    await updateDoc(doc(db, 'hints', targetDoc.id), {
      is_drawn: true,
      drawn_by: juniorId,
      drawn_by_name: juniorName,
    });

    return NextResponse.json({ success: true, message: 'ปล่อยคำใบ้สำเร็จ!' });
  } catch (err) {
    console.error('release-hint error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
