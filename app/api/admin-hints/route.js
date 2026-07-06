import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request) {
  try {
    const hintsRef = collection(db, 'hints');
    // Get all hints that haven't been drawn yet
    const q = query(hintsRef, where('is_drawn', '==', false));
    const querySnapshot = await getDocs(q);
    
    const results = querySnapshot.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    }));

    // Sort by senior_name and then hint_number
    results.sort((a, b) => {
      const nameA = a.senior_name || '';
      const nameB = b.senior_name || '';
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return (a.hint_number || 0) - (b.hint_number || 0);
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error('admin-hints error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
