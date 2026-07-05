import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const data = await request.json();
    const seniorName = (data.senior_name || '').trim();
    const hints = Array.isArray(data.hints) ? data.hints : [];
    const singleHint = (data.hint_text || '').trim();

    if (!seniorName) {
      return NextResponse.json(
        { success: false, message: 'Missing senior_name' },
        { status: 400 }
      );
    }

    const docs = [];

    if (hints.length > 0) {
      hints.forEach((text, i) => {
        const t = (text || '').trim();
        if (t) {
          docs.push({
            senior_name: seniorName,
            hint_text: t,
            is_drawn: false,
            drawn_by: '',
            hint_number: i + 1,
          });
        }
      });
    } else if (singleHint) {
      docs.push({
        senior_name: seniorName,
        hint_text: singleHint,
        is_drawn: false,
        drawn_by: '',
        hint_number: 1,
      });
    }

    if (docs.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid hints provided' },
        { status: 400 }
      );
    }

    const hintsCollection = collection(db, 'hints');

    // Delete all existing hints for this senior before inserting new ones
    const existingQ = query(hintsCollection, where('senior_name', '==', seniorName));
    const existingSnap = await getDocs(existingQ);
    const deletePromises = existingSnap.docs.map((d) => deleteDoc(doc(db, 'hints', d.id)));
    await Promise.all(deletePromises);

    // Insert fresh hints
    const createdAt = new Date().toISOString();
    let insertedCount = 0;
    for (const d of docs) {
      await addDoc(hintsCollection, {
        ...d,
        created_at: createdAt,
      });
      insertedCount++;
    }

    return NextResponse.json({ success: true, insertedCount });
  } catch (err) {
    console.error('add-hint error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
