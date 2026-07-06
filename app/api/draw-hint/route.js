import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';

export async function POST(request) {
  try {
    const data = await request.json();
    const id = (data.id || '').trim();
    const drawnBy = (data.drawn_by || 'น้องรหัส').trim();
    const drawnByName = (data.drawn_by_name || 'น้องรหัส').trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Missing id' },
        { status: 400 }
      );
    }

    const hintDocRef = doc(db, 'hints', id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(hintDocRef);

      if (!snap.exists()) {
        throw new Error('Hint not found');
      }

      const currentData = snap.data();

      if (currentData.is_drawn) {
        const err = new Error('Already drawn by another user');
        err.code = 'ALREADY_DRAWN';
        throw err;
      }

      tx.update(hintDocRef, {
        is_drawn: true,
        drawn_by: drawnBy,
        drawn_by_name: drawnByName,
      });
    });

    return NextResponse.json({ success: true, matchedCount: 1 });
  } catch (err) {
    if (err.code === 'ALREADY_DRAWN') {
      return NextResponse.json(
        { success: false, message: 'Hint already drawn by another user', code: 'ALREADY_DRAWN' },
        { status: 409 }
      );
    }

    console.error('draw-hint error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
