import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { hintId } = await request.json();
    if (!hintId) {
      return NextResponse.json({ error: 'Missing hintId' }, { status: 400 });
    }
    // Simple admin check - rely on client side auth; in production add proper auth
    await deleteDoc(doc(db, 'hints', hintId));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('admin-hints delete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
