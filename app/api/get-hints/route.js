import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
async function handleDummy(request) {
  const { hintsStore } = await import('@/lib/dummy-store');
  const { searchParams } = new URL(request.url);
  const seniorName = (searchParams.get('senior_name') || '').trim();

  if (seniorName !== '') {
    const results = hintsStore.find({ senior_name: seniorName });
    results.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0));
    return NextResponse.json(results);
  }

  // Wheel view: hint_number=1, not drawn
  let results = hintsStore.find({ is_drawn: false, hint_number: 1 });
  results.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  const seniorMap = new Map();
  for (const item of results) {
    if (!seniorMap.has(item.senior_name)) seniorMap.set(item.senior_name, item);
  }
  const unique = Array.from(seniorMap.values());
  const withAlias = unique.map((item, idx) => ({
    ...item,
    alias: `CPE${String(idx + 1).padStart(2, '0')}`,
  }));

  return NextResponse.json(withAlias);
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal(request) {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');

  const { searchParams } = new URL(request.url);
  const seniorName = (searchParams.get('senior_name') || '').trim();
  const hintsRef = collection(db, 'hints');
  let q;

  if (seniorName !== '') {
    q = query(hintsRef, where('senior_name', '==', seniorName));
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
    results.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0));
    return NextResponse.json(results);
  }

  q = query(hintsRef, where('is_drawn', '==', false), where('hint_number', '==', 1));
  const querySnapshot = await getDocs(q);
  let results = querySnapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
  results.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  const seniorMap = new Map();
  for (const item of results) {
    if (!seniorMap.has(item.senior_name)) seniorMap.set(item.senior_name, item);
  }
  const unique = Array.from(seniorMap.values());
  const withAlias = unique.map((item, idx) => ({
    ...item,
    alias: `CPE${String(idx + 1).padStart(2, '0')}`,
  }));

  return NextResponse.json(withAlias);
}

export async function GET(request) {
  try {
    return USE_DUMMY ? await handleDummy(request) : await handleReal(request);
  } catch (err) {
    console.error('get-hints error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
