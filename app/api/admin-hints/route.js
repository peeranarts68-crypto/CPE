import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export async function GET() {
  try {
    const hintsRef = collection(db, 'hints');
    const querySnapshot = await getDocs(hintsRef);
    const results = querySnapshot.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    }));

    const grouped = {};
    results.forEach((hint) => {
      const s = hint.senior_name || 'Unknown';
      if (!grouped[s]) {
        grouped[s] = { senior_name: s, hints: [] };
      }
      grouped[s].hints.push(hint);
    });

    const finalData = Object.values(grouped).sort((a, b) =>
      a.senior_name.localeCompare(b.senior_name)
    );

    finalData.forEach((item) => {
      item.hints.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0));
    });

    return NextResponse.json(finalData);
  } catch (err) {
    console.error('admin-hints error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
