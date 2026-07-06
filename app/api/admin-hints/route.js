import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
async function handleDummy() {
  const { hintsStore } = await import('@/lib/dummy-store');

  const all = hintsStore.all();
  const grouped = {};
  all.forEach((hint) => {
    const s = hint.senior_name || 'Unknown';
    if (!grouped[s]) grouped[s] = { senior_name: s, hints: [] };
    grouped[s].hints.push(hint);
  });

  const finalData = Object.values(grouped).sort((a, b) =>
    a.senior_name.localeCompare(b.senior_name)
  );
  finalData.forEach((item) =>
    item.hints.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0))
  );

  return NextResponse.json(finalData);
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal() {
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs } = await import('firebase/firestore');

  const hintsRef = collection(db, 'hints');
  const querySnapshot = await getDocs(hintsRef);
  const results = querySnapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));

  const grouped = {};
  results.forEach((hint) => {
    const s = hint.senior_name || 'Unknown';
    if (!grouped[s]) grouped[s] = { senior_name: s, hints: [] };
    grouped[s].hints.push(hint);
  });

  const finalData = Object.values(grouped).sort((a, b) =>
    a.senior_name.localeCompare(b.senior_name)
  );
  finalData.forEach((item) =>
    item.hints.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0))
  );

  return NextResponse.json(finalData);
}

export async function GET() {
  try {
    return USE_DUMMY ? await handleDummy() : await handleReal();
  } catch (err) {
    console.error('admin-hints error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
