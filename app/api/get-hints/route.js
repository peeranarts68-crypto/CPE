import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const seniorName = (searchParams.get('senior_name') || '').trim();

    const hintsRef = collection(db, 'hints');
    let q;

    if (seniorName !== '') {
      q = query(hintsRef, where('senior_name', '==', seniorName));
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      }));
      results.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0));
      return NextResponse.json(results);
    }

    q = query(hintsRef, where('is_drawn', '==', false), where('hint_number', '==', 1));
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    }));

    results.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });

    const seniorMap = new Map();
    for (const item of results) {
      const name = item.senior_name;
      if (!seniorMap.has(name)) {
        seniorMap.set(name, item);
      }
    }
    const unique = Array.from(seniorMap.values());

    const withAlias = unique.map((item, idx) => ({
      ...item,
      alias: `CPE${String(idx + 1).padStart(2, '0')}`,
    }));

    return NextResponse.json(withAlias);
  } catch (err) {
    console.error('get-hints error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
