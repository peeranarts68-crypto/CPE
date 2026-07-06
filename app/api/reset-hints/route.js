import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
async function handleDummy(request) {
  const { hintsStore } = await import('@/lib/dummy-store');
  const data = await request.json();
  const seniorName = (data.senior_name || '').trim();

  if (!seniorName) {
    return NextResponse.json({ success: false, message: 'Missing senior_name' }, { status: 400 });
  }

  const deleted = hintsStore.deleteWhere({ senior_name: seniorName });
  return NextResponse.json({ success: true, message: `Hints reset (${deleted} deleted)` });
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal(request) {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, writeBatch, doc } = await import('firebase/firestore');

  const data = await request.json();
  const seniorName = (data.senior_name || '').trim();

  if (!seniorName) {
    return NextResponse.json({ success: false, message: 'Missing senior_name' }, { status: 400 });
  }

  const hintsRef = collection(db, 'hints');
  const q = query(hintsRef, where('senior_name', '==', seniorName));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return NextResponse.json({ success: true, message: 'No hints found to delete' });
  }

  const batch = writeBatch(db);
  querySnapshot.docs.forEach((d) => batch.delete(doc(db, 'hints', d.id)));
  await batch.commit();

  return NextResponse.json({ success: true, message: 'Hints reset successfully' });
}

export async function POST(request) {
  try {
    return USE_DUMMY ? await handleDummy(request) : await handleReal(request);
  } catch (err) {
    console.error('reset-hints error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
