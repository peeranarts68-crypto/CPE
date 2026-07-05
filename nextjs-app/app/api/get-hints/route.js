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
    } else {
      q = query(hintsRef, where('is_drawn', '==', false), where('hint_number', '==', 1));
    }

    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    }));

    if (seniorName !== '') {
      results.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0));
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error('get-hints error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
