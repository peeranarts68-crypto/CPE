import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

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
    await updateDoc(hintDocRef, {
      is_drawn: true,
      drawn_by: drawnBy,
      drawn_by_name: drawnByName,
    });

    return NextResponse.json({
      success: true,
      matchedCount: 1,
    });
  } catch (err) {
    console.error('draw-hint error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
