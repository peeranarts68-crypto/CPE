import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
async function handleDummy(request) {
  const { hintsStore } = await import('@/lib/dummy-store');
  const data = await request.json();
  const seniorName = (data.senior_name || '').trim();
  const hints = Array.isArray(data.hints) ? data.hints : [];
  const singleHint = (data.hint_text || '').trim();

  if (!seniorName) {
    return NextResponse.json({ success: false, message: 'Missing senior_name' }, { status: 400 });
  }

  const docs = [];
  if (hints.length > 0) {
    hints.forEach((text, i) => {
      const t = (text || '').trim();
      if (t) docs.push({ senior_name: seniorName, hint_text: t, is_drawn: false, drawn_by: '', drawn_by_name: '', hint_number: i + 1 });
    });
  } else if (singleHint) {
    docs.push({ senior_name: seniorName, hint_text: singleHint, is_drawn: false, drawn_by: '', drawn_by_name: '', hint_number: 1 });
  }

  if (docs.length === 0) {
    return NextResponse.json({ success: false, message: 'No valid hints provided' }, { status: 400 });
  }

  const createdAt = new Date().toISOString();
  hintsStore.deleteWhere({ senior_name: seniorName });
  docs.forEach((d) => hintsStore.insert({ ...d, created_at: createdAt }));

  return NextResponse.json({ success: true, insertedCount: docs.length });
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal(request) {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, writeBatch, doc } = await import('firebase/firestore');

  const data = await request.json();
  const seniorName = (data.senior_name || '').trim();
  const hints = Array.isArray(data.hints) ? data.hints : [];
  const singleHint = (data.hint_text || '').trim();

  if (!seniorName) {
    return NextResponse.json({ success: false, message: 'Missing senior_name' }, { status: 400 });
  }

  const docs = [];
  if (hints.length > 0) {
    hints.forEach((text, i) => {
      const t = (text || '').trim();
      if (t) docs.push({ senior_name: seniorName, hint_text: t, is_drawn: false, drawn_by: '', drawn_by_name: '', hint_number: i + 1 });
    });
  } else if (singleHint) {
    docs.push({ senior_name: seniorName, hint_text: singleHint, is_drawn: false, drawn_by: '', drawn_by_name: '', hint_number: 1 });
  }

  if (docs.length === 0) {
    return NextResponse.json({ success: false, message: 'No valid hints provided' }, { status: 400 });
  }

  const hintsCollection = collection(db, 'hints');
  const existingQ = query(hintsCollection, where('senior_name', '==', seniorName));
  const existingSnap = await getDocs(existingQ);

  const createdAt = new Date().toISOString();
  const batch = writeBatch(db);
  existingSnap.docs.forEach((d) => batch.delete(doc(db, 'hints', d.id)));
  docs.forEach((d) => { const newRef = doc(hintsCollection); batch.set(newRef, { ...d, created_at: createdAt }); });
  await batch.commit();

  return NextResponse.json({ success: true, insertedCount: docs.length });
}

export async function POST(request) {
  try {
    return USE_DUMMY ? await handleDummy(request) : await handleReal(request);
  } catch (err) {
    console.error('add-hint error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
