import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
async function handleDummy(request) {
  const { hintsStore } = await import('@/lib/dummy-store');
  const data = await request.json();
  const id = (data.id || '').trim();
  const drawnBy = (data.drawn_by || 'น้องรหัส').trim();
  const drawnByName = (data.drawn_by_name || 'น้องรหัส').trim();

  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });

  const hint = hintsStore.findById(id);
  if (!hint) return NextResponse.json({ success: false, message: 'Hint not found' }, { status: 404 });
  if (hint.is_drawn) {
    return NextResponse.json(
      { success: false, message: 'Hint already drawn by another user', code: 'ALREADY_DRAWN' },
      { status: 409 }
    );
  }

  hintsStore.update(id, { is_drawn: true, drawn_by: drawnBy, drawn_by_name: drawnByName });
  return NextResponse.json({ success: true, matchedCount: 1 });
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal(request) {
  const { db } = await import('@/lib/firebase');
  const { doc, runTransaction } = await import('firebase/firestore');

  const data = await request.json();
  const id = (data.id || '').trim();
  const drawnBy = (data.drawn_by || 'น้องรหัส').trim();
  const drawnByName = (data.drawn_by_name || 'น้องรหัส').trim();

  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });

  const hintDocRef = doc(db, 'hints', id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(hintDocRef);
    if (!snap.exists()) throw new Error('Hint not found');
    if (snap.data().is_drawn) {
      const err = new Error('Already drawn by another user');
      err.code = 'ALREADY_DRAWN';
      throw err;
    }
    tx.update(hintDocRef, { is_drawn: true, drawn_by: drawnBy, drawn_by_name: drawnByName });
  });

  return NextResponse.json({ success: true, matchedCount: 1 });
}

export async function POST(request) {
  try {
    return USE_DUMMY ? await handleDummy(request) : await handleReal(request);
  } catch (err) {
    if (err.code === 'ALREADY_DRAWN') {
      return NextResponse.json(
        { success: false, message: 'Hint already drawn by another user', code: 'ALREADY_DRAWN' },
        { status: 409 }
      );
    }
    console.error('draw-hint error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
