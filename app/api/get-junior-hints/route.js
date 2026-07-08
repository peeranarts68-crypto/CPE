import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const juniorId = (searchParams.get('junior_id') || '').trim();

    if (!juniorId) {
      return NextResponse.json(
        { success: false, message: 'Missing junior_id' },
        { status: 400 }
      );
    }

    const hintsRef = collection(db, 'hints');

    const q1 = query(hintsRef, where('drawn_by', '==', juniorId), where('hint_number', '==', 1));
    const querySnapshot1 = await getDocs(q1);

    if (querySnapshot1.empty) {
      return NextResponse.json({ success: true, has_drawn: false, seniors: [] });
    }

    const seniorsDrawn = querySnapshot1.docs.map((doc) => doc.data().senior_name);
    const uniqueSeniors = Array.from(new Set(seniorsDrawn));
    const seniorsData = [];

    for (const seniorName of uniqueSeniors) {
      const q2 = query(hintsRef, where('senior_name', '==', seniorName));
      const querySnapshot2 = await getDocs(q2);

      const allHints = querySnapshot2.docs.map((doc) => doc.data());
      allHints.sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0));

      const hintMap = new Map();
      for (const h of allHints) {
        const num = parseInt(h.hint_number) || 1;
        const existing = hintMap.get(num);
        if (!existing || h.is_drawn) {
          hintMap.set(num, h);
        }
      }

      const formattedHints = Array.from(hintMap.values())
        .sort((a, b) => (a.hint_number || 0) - (b.hint_number || 0))
        .map((h) => {
          const isDrawn = Boolean(h.is_drawn);
          const hintNum = parseInt(h.hint_number) || 1;
          const text = isDrawn ? h.hint_text : 'ยังไม่ถูกเปิดเผยโดยพี่รหัส';
          return {
            hint_number: hintNum,
            is_released: isDrawn,
            hint_text: text,
          };
        });

      seniorsData.push({
        senior_index: seniorsData.length + 1,
        hints: formattedHints,
      });
    }

    return NextResponse.json({
      success: true,
      has_drawn: true,
      seniors: seniorsData,
    });
  } catch (err) {
    console.error('get-junior-hints error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
