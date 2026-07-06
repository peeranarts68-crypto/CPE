import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function POST() {
  try {
    const hintsRef = collection(db, 'hints');
    const snapshot = await getDocs(hintsRef);

    const all = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));

    // Group by senior_name + hint_number
    const groups = {};
    for (const hint of all) {
      const key = `${hint.senior_name}__${hint.hint_number}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(hint);
    }

    // For each group that has duplicates, keep the latest (by created_at), delete the rest
    const toDelete = [];
    for (const key of Object.keys(groups)) {
      const group = groups[key];
      if (group.length <= 1) continue;

      // Sort by created_at descending — keep first, delete rest
      group.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at) : new Date(0);
        const db2 = b.created_at ? new Date(b.created_at) : new Date(0);
        return db2 - da;
      });

      // Keep index 0, delete the rest
      for (let i = 1; i < group.length; i++) {
        toDelete.push(group[i]._id);
      }
    }

    // Delete all duplicates
    await Promise.all(toDelete.map(id => deleteDoc(doc(db, 'hints', id))));

    return NextResponse.json({ success: true, deleted: toDelete.length });
  } catch (err) {
    console.error('dedupe-hints error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
