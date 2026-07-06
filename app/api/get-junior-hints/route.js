import { NextResponse } from 'next/server';

const USE_DUMMY = process.env.USE_DUMMY === 'true';

// ── DUMMY handler ──────────────────────────────────────────
async function handleDummy(request) {
  const { hintsStore } = await import('@/lib/dummy-store');
  const { searchParams } = new URL(request.url);
  const juniorId = (searchParams.get('junior_id') || '').trim();

  if (!juniorId) {
    return NextResponse.json({ success: false, message: 'Missing junior_id' }, { status: 400 });
  }

  const drawnHint = hintsStore.findOne({ drawn_by: juniorId, hint_number: 1 });
  if (!drawnHint) return NextResponse.json({ success: true, has_drawn: false, hints: [] });

  const seniorName = drawnHint.senior_name;
  const allHints = hintsStore.find({ senior_name: seniorName });

  const hintMap = new Map();
  for (const h of allHints) {
    const num = parseInt(h.hint_number) || 1;
    const existing = hintMap.get(num);
    if (!existing || h.is_drawn) hintMap.set(num, h);
  }

  const formattedHints = Array.from(hintMap.values())
    .sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0))
    .map((h) => ({
      hint_number: parseInt(h.hint_number) || 1,
      is_released: Boolean(h.is_drawn),
      hint_text: h.is_drawn ? h.hint_text : 'ยังไม่ถูกเปิดเผยโดยพี่รหัส',
    }));

  return NextResponse.json({ success: true, has_drawn: true, senior_name: seniorName, hints: formattedHints });
}

// ── REAL handler ───────────────────────────────────────────
async function handleReal(request) {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

  const { searchParams } = new URL(request.url);
  const juniorId = (searchParams.get('junior_id') || '').trim();

  if (!juniorId) {
    return NextResponse.json({ success: false, message: 'Missing junior_id' }, { status: 400 });
  }

  const hintsRef = collection(db, 'hints');
  const q1 = query(hintsRef, where('drawn_by', '==', juniorId), where('hint_number', '==', 1), limit(1));
  const querySnapshot1 = await getDocs(q1);

  if (querySnapshot1.empty) return NextResponse.json({ success: true, has_drawn: false, hints: [] });

  const drawnHint = querySnapshot1.docs[0].data();
  const seniorName = drawnHint.senior_name;

  const q2 = query(hintsRef, where('senior_name', '==', seniorName));
  const querySnapshot2 = await getDocs(q2);
  const allHints = querySnapshot2.docs.map((doc) => doc.data());
  allHints.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0));

  const hintMap = new Map();
  for (const h of allHints) {
    const num = parseInt(h.hint_number) || 1;
    const existing = hintMap.get(num);
    if (!existing || h.is_drawn) hintMap.set(num, h);
  }

  const formattedHints = Array.from(hintMap.values())
    .sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0))
    .map((h) => ({
      hint_number: parseInt(h.hint_number) || 1,
      is_released: Boolean(h.is_drawn),
      hint_text: h.is_drawn ? h.hint_text : 'ยังไม่ถูกเปิดเผยโดยพี่รหัส',
    }));

  return NextResponse.json({ success: true, has_drawn: true, senior_name: seniorName, hints: formattedHints });
}

export async function GET(request) {
  try {
    return USE_DUMMY ? await handleDummy(request) : await handleReal(request);
  } catch (err) {
    console.error('get-junior-hints error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
