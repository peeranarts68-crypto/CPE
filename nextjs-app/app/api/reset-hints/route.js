import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const data = await request.json();
    const seniorName = (data.senior_name || '').trim();

    if (!seniorName) {
      return NextResponse.json(
        { success: false, message: 'Missing senior_name' },
        { status: 400 }
      );
    }

    const hintsRef = collection(db, 'hints');
    const q = query(hintsRef, where('senior_name', '==', seniorName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ success: true, message: 'No hints found to delete' });
    }

    const batch = writeBatch(db);
    querySnapshot.docs.forEach((d) => {
      batch.delete(doc(db, 'hints', d.id));
    });
    await batch.commit();

    return NextResponse.json({ success: true, message: 'Hints reset successfully' });
  } catch (err) {
    console.error('reset-hints error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
