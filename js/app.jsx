/**
 * CPE Shirt & Jacket Ordering Web App - React 18 Application Component
 * Integrated with Firebase Auth, Cloud Firestore Database, and Analytics
 */

const { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  query, 
  where, 
  onSnapshot, 
  orderBy,
  serverTimestamp 
} = window.CPEFirebase || {};

const { useState, useEffect, useContext, createContext } = React;

// Fixed Universal Order Deadline (Target: Saturday 8 August 2026 at 14:40:00 PM Bangkok Time)
const FIXED_ORDER_DEADLINE = new Date('2026-08-08T14:40:00+07:00').getTime();

const calculateTimeLeft = (targetTime = FIXED_ORDER_DEADLINE) => {
  const diff = targetTime - Date.now();
  if (diff <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { total: diff, days, hours, minutes, seconds };
};

// PromptPay EMVCo Dynamic Payload Generator for Thailand PromptPay
const generatePromptPayPayload = (targetPhone = '0923637199', amount) => {
  let sanitized = String(targetPhone).replace(/[^0-9]/g, '');
  if (sanitized.startsWith('0')) {
    sanitized = '0066' + sanitized.substring(1);
  }
  const targetTag = '01' + String(sanitized.length).padStart(2, '0') + sanitized;
  const tag29Data = '0016A000000677010111' + targetTag;
  const tag29 = '29' + String(tag29Data.length).padStart(2, '0') + tag29Data;
  
  let payload = '000201' + (amount ? '010212' : '010211') + tag29 + '5303764';
  if (amount && Number(amount) > 0) {
    const formattedAmount = Number(amount).toFixed(2);
    payload += '54' + String(formattedAmount.length).padStart(2, '0') + formattedAmount;
  }
  payload += '5802TH6304';
  
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
  return payload + crcHex;
};

// Format a deadline timestamp into Thai display string
const formatDeadlineText = (ts) => {
  if (!ts) return '14:40 น.';
  try {
    const d = new Date(ts);
    const time = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    const date = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', weekday: 'short' }).format(d);
    return `${time} น. (${date})`;
  } catch (e) { return '14:40 น.'; }
};

// Helper to prevent async network requests from hanging indefinitely
const withTimeout = (promise, ms = 4000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Network operation timeout')), ms))
  ]);
};

const isLargeSizeHelper = (sz) => ['5XL', '6XL', '7XL', '8XL'].includes((sz || '').toString().toUpperCase().trim());

// Helper to retrieve exact grand total of an order recalculated dynamically with the current price policy (350฿ / 5XL+ 600฿)
const getOrderTotal = (o) => {
  if (!o) return 350;

  if (o.items && Array.isArray(o.items) && o.items.length > 0) {
    return o.items.reduce((sum, it) => {
      const prodKey = it.productKey || 'polo_navy';
      let base = 350;
      let largeFee = 250;

      if (prodKey === 'jacket') {
        base = 920;
        largeFee = 100;
      }

      let unitPrice = base;
      if (isLargeSizeHelper(it.size)) {
        unitPrice += largeFee;
      }

      const qty = typeof it.qty === 'number' && it.qty > 0 ? it.qty : 1;
      return sum + (unitPrice * qty);
    }, 0);
  }

  return 350;
};

// Create Auth Context
const AuthContext = createContext();

// Helper to retrieve sanitized saved user from localStorage
function getSanitizedSavedUser() {
  try {
    const raw = localStorage.getItem('cpe_current_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ensure essential fields exist
    if (parsed && parsed.uid && parsed.name) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.warn('Failed to parse saved user:', e);
    return null;
  }
}

// App Toast Notification Component
function Toast({ toast }) {
  if (!toast.visible) return null;
  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div className="toast-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999999, pointerEvents: 'none' }}>
      <div 
        className={`toast ${toast.type}`}
        style={{
          background: '#10121a',
          border: `1px solid ${isError ? '#ef4444' : isSuccess ? '#22c55e' : 'var(--border-gold)'}`,
          color: isError ? '#fca5a5' : isSuccess ? '#86efac' : '#fff',
          padding: '14px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.85)',
          fontWeight: 500,
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <span>{isError ? '⚠️' : isSuccess ? '✅' : 'ℹ️'}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

// Products Registry
const PRODUCTS = {
  polo: {
    id: 'polo',
    title: 'เสื้อโปโลสาขาวิศวกรรมคอมพิวเตอร์ (CPE Polo Shirt)',
    batch: 'LXVIII (รุ่น 68)',
    basePrice: 350,
    largeFee: 250,
    originalPrice: 350,
    badgeText: 'ราคาตัวละ ฿350 (5XL+ ฿600)',
    images: {
      front: 'assets/shirt_front.jpg',
      back: 'assets/shirt_back.jpg',
      sleeve: 'assets/shirt_sleeve.jpg'
    },
    specs: [
      'อกซ้าย: <strong>ปักตรา CPE PSRU</strong>',
      'ด้านหลัง: <strong>สกรีนวงจร Computer Eng</strong>',
      'แขนเสื้อ: <strong>ปักเลขโรมัน LXVIII</strong>'
    ]
  },
  polo_navy: {
    id: 'polo_navy',
    title: 'เสื้อโปโลสาขาวิศวกรรมคอมพิวเตอร์ (สีกรมท่า Navy Blue)',
    batch: 'คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม CPE',
    basePrice: 350,
    largeFee: 250,
    originalPrice: 350,
    badgeText: 'ราคาตัวละ ฿350 (5XL+ ฿600)',
    images: {
      front: 'assets/polo_navy_front.jpg',
      back: 'assets/polo_navy_back.jpg',
      sleeve: 'assets/polo_navy_front.jpg'
    },
    specs: [
      'สีเสื้อ: <strong>สีกรมท่า (Navy Blue) ปกขอบขาว</strong>',
      'เนื้อผ้า: <strong>ผ้าไมโครไฟเบอร์ นุ่ม ใส่สบาย ไม่ร้อน</strong>',
      'อกซ้าย: <strong>ปักโลโก้ตรา CPE Computer Engineering</strong>',
      'ด้านหลัง: <strong>สกรีน Computer Engineering & Circuit สีขาว</strong>'
    ]
  },
  jacket: {
    id: 'jacket',
    title: 'เสื้อคลุมสาขาวิศวกรรมคอมพิวเตอร์ (CPE 69 Jacket)',
    batch: 'LXIX (รุ่น 69)',
    basePrice: 920,
    largeFee: 100,
    originalPrice: 1200,
    badgeText: 'สำหรับน้อง CPE 69 (3XL+ +฿100)',
    images: {

      front: 'assets/jacket_front.png',
      back: 'assets/jacket_back.png',
      sleeve: 'assets/jacket_side.png'
    },
    specs: [
      'ผ้าไมโครโพลีเอสเตอร์: <strong>ระบายอากาศได้ดี ซิปหน้าอย่างดี</strong>',
      'อกซ้าย: <strong>ปักตรา CPE Computer Engineering 100 S</strong>',
      'ด้านหลัง: <strong>สกรีน Computer Engineering 69 & ฟันเฟือง PSRU</strong>',
      'แขนเสื้อ: <strong>ปักเลขโรมัน LXIX</strong>'
    ]
  }
};


// Size Base Labels & Chest Measurements
const SIZES = [
  { id: 'SS', label: 'SS (34")', chest: '34"' },
  { id: 'S', label: 'S (36")', chest: '36"' },
  { id: 'M', label: 'M (38")', chest: '38"' },
  { id: 'L', label: 'L (40")', chest: '40"' },
  { id: 'XL', label: 'XL (42")', chest: '42"' },
  { id: '2XL', label: '2XL (44")', chest: '44"' },
  { id: '3XL', label: '3XL (46")', chest: '46"' },
  { id: '4XL', label: '4XL (48")', chest: '48"' },
  { id: '5XL', label: '5XL (50")', chest: '50"', isLarge: true },
  { id: '6XL', label: '6XL (52")', chest: '52"', isLarge: true },
  { id: '7XL', label: '7XL (54")', chest: '54"', isLarge: true }
];

// Main React App Provider & Root
function App() {
  // Global pre-fetch for Admin Dashboard so Admin Modal opens INSTANTLY
  useEffect(() => {
    let unsubOrders = () => {};
    let unsubExtra = () => {};

    const startPrefetch = () => {
      const fb = window.CPEFirebase || {};
      if (!fb.db || !fb.collection || !fb.onSnapshot) return;

      try {
        if (adminCachedOrders.length === 0) {
          const ordersRef = fb.collection(fb.db, 'orders');
          unsubOrders = fb.onSnapshot(ordersRef, (querySnapshot) => {
            let firestoreList = [];
            querySnapshot.forEach((docSnap) => {
              firestoreList.push({ firestoreId: docSnap.id, ...docSnap.data() });
            });
            firestoreList.sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
            adminCachedOrders = firestoreList;
            window.dispatchEvent(new Event('cpe-admin-data-updated'));
          }, (err) => console.log("Prefetch orders warning:", err));
        }

        if (adminCachedExtraDeposits.length === 0) {
          const q = fb.collection(fb.db, 'extra_deposits');
          unsubExtra = fb.onSnapshot(q, (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            adminCachedExtraDeposits = list;
            window.dispatchEvent(new Event('cpe-admin-data-updated'));
          }, (err) => console.log("Prefetch extra deposits warning:", err));
        }
      } catch (e) {
        console.log("Global prefetch error:", e);
      }
    };

    startPrefetch();
    window.addEventListener('cpe-firebase-ready', startPrefetch);
    return () => {
      unsubOrders();
      unsubExtra();
      window.removeEventListener('cpe-firebase-ready', startPrefetch);
    };
  }, []);
  const [currentUser, setCurrentUser] = useState(() => getSanitizedSavedUser());
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cpe_cart')) || []; }
    catch { return []; }
  });
  
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isExtraDepositModalOpen, setIsExtraDepositModalOpen] = useState(false);
  const [isPayRemainingModalOpen, setIsPayRemainingModalOpen] = useState(false);
  const [payRemainingOrder, setPayRemainingOrder] = useState(null);

  // Real-time Dynamic Sales Settings State
  const [salesSettings, setSalesSettings] = useState({
    salesMode: 'auto', // 'auto', 'open', 'closed'
    customDeadline: '2026-08-08T14:40'
  });

  useEffect(() => {
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.doc || !fb.onSnapshot) return;

    let unsub = () => {};
    try {
      const settingsRef = fb.doc(fb.db, 'settings', 'order_settings');
      unsub = fb.onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
          setSalesSettings(docSnap.data());
        }
      }, (err) => console.log("Settings listener warning:", err));
    } catch (e) {
      console.log("Settings listener error:", e);
    }
    return () => unsub();
  }, []);

  const effectiveDeadline = salesSettings.customDeadline 
    ? new Date(salesSettings.customDeadline).getTime() 
    : FIXED_ORDER_DEADLINE;

  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(effectiveDeadline));

  const isExpired = salesSettings.salesMode === 'closed' ? true :
                    salesSettings.salesMode === 'open' ? false :
                    timeLeft.total <= 0;

  useEffect(() => {
    setTimeLeft(calculateTimeLeft(effectiveDeadline));
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(effectiveDeadline));
    }, 1000);
    return () => clearInterval(timer);
  }, [effectiveDeadline]);

  // Determine admin status – include fallback from localStorage in case auth state hasn't loaded yet
  const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('cpe_current_user') : null;
  const parsedStored = storedUser ? JSON.parse(storedUser) : null;
  const isAdmin = currentUser?.studentId === '6800000000' || currentUser?.role === 'admin' ||
                  parsedStored?.studentId === '6800000000' || parsedStored?.role === 'admin';
  
  const [selectedProductKey, setSelectedProductKey] = useState('polo_navy');

  // Force polo_navy for everyone as requested ("ปรับให้ทุกคนสั่งได้แค่เสื้อโปโลสีกรม")
  useEffect(() => {
    setSelectedProductKey('polo_navy');
  }, []);

  const [totalShirtsCount, setTotalShirtsCount] = useState(() => {
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('cpe_public_total_shirts') : null;
      return cached ? parseInt(cached, 10) : 0;
    } catch (e) {
      return 0;
    }
  });

  useEffect(() => {
    let unsub = () => {};
    let isMounted = true;

    const fetchPublicTotalShirts = () => {
      const fb = window.CPEFirebase || {};
      if (!fb.db || !fb.collection) return false;

      // 1. Direct fetch immediately
      if (fb.getDocs) {
        fb.getDocs(fb.collection(fb.db, 'orders')).then(snap => {
          if (!isMounted) return;
          let count = 0;
          snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.items && Array.isArray(data.items)) {
              count += data.items.reduce((s, it) => s + (it.qty || 1), 0);
            } else {
              count += 1;
            }
          });
          setTotalShirtsCount(count);
          try { localStorage.setItem('cpe_public_total_shirts', count.toString()); } catch (e) {}
        }).catch(e => console.log('Public total fetch error:', e));
      }

      // 2. Realtime listener
      if (fb.onSnapshot) {
        try {
          unsub = fb.onSnapshot(fb.collection(fb.db, 'orders'), (snap) => {
            if (!isMounted) return;
            let count = 0;
            snap.forEach(docSnap => {
              const data = docSnap.data();
              if (data.items && Array.isArray(data.items)) {
                count += data.items.reduce((s, it) => s + (it.qty || 1), 0);
              } else {
                count += 1;
              }
            });
            setTotalShirtsCount(count);
            try { localStorage.setItem('cpe_public_total_shirts', count.toString()); } catch (e) {}
          }, (err) => console.log('Public total snapshot error:', err));
        } catch (e) {}
      }
      return true;
    };

    const success = fetchPublicTotalShirts();
    let interval = null;
    if (!success) {
      interval = setInterval(() => {
        if (window.CPEFirebase && window.CPEFirebase.db) {
          clearInterval(interval);
          fetchPublicTotalShirts();
        }
      }, 400);
      window.addEventListener('cpe-firebase-ready', fetchPublicTotalShirts);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      if (typeof unsub === 'function') unsub();
      window.removeEventListener('cpe-firebase-ready', fetchPublicTotalShirts);
    };
  }, []);
  const [searchTrackingQuery, setSearchTrackingQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);

  const storageKey = currentUser?.studentId ? `cpe_my_orders_${currentUser.studentId}` : 'cpe_my_orders_guest';

  const [myOrdersHistory, setMyOrdersHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Save Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem('cpe_cart', JSON.stringify(cart));
  }, [cart]);

  // Save My Orders History to LocalStorage (scoped by studentId)
  useEffect(() => {
    if (myOrdersHistory && myOrdersHistory.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(myOrdersHistory));
    }
  }, [myOrdersHistory, storageKey]);

  // Auto sync user's orders from Firestore when currentUser changes
  useEffect(() => {
    const studentId = currentUser?.studentId;
    const uid = currentUser?.uid;
    if (!studentId && !uid) {
      setMyOrdersHistory([]);
      setTrackedOrder(null);
      return;
    }
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.collection || !fb.query || !fb.where || !fb.getDocs) return;

    let isMounted = true;
    const fetchUserOrders = async () => {
      try {
        const ordersRef = fb.collection(fb.db, 'orders');
        let rawOrders = [];

        if (studentId) {
          const q = fb.query(ordersRef, fb.where('studentId', '==', studentId));
          const querySnapshot = await fb.getDocs(q);
          querySnapshot.forEach(docSnap => {
            rawOrders.push({ firestoreId: docSnap.id, ...docSnap.data() });
          });
        }

        if (rawOrders.length === 0 && uid) {
          const q2 = fb.query(ordersRef, fb.where('userUid', '==', uid));
          const querySnapshot2 = await fb.getDocs(q2);
          querySnapshot2.forEach(docSnap => {
            rawOrders.push({ firestoreId: docSnap.id, ...docSnap.data() });
          });
        }

        // STRICT OWNER ISOLATION FILTER: Keep ONLY orders that strictly match current user!
        const userOrders = rawOrders.filter(ord => {
          if (studentId && ord.studentId === studentId) return true;
          if (uid && ord.userUid === uid) return true;
          return false;
        });

        if (isMounted) {
          setMyOrdersHistory(userOrders);
          if (userOrders.length > 0) {
            setTrackedOrder(userOrders[0]);
            if (userOrders[0].id) setSearchTrackingQuery(userOrders[0].id);
          } else {
            setTrackedOrder(null);
            if (studentId) setSearchTrackingQuery(studentId);
          }
        }
      } catch (e) {
        console.log("Error fetching user orders from Firestore:", e);
      }
    };

    fetchUserOrders();
    return () => { isMounted = false; };
  }, [currentUser?.studentId, currentUser?.uid]);

  

  // Firebase Auth Listener with Session Persistence
  useEffect(() => {
    let unsubscribe = () => {};

    const initAuthListener = () => {
      const fb = window.CPEFirebase || {};
      if (!fb.auth || !fb.onAuthStateChanged) return;

      unsubscribe = fb.onAuthStateChanged(fb.auth, async (user) => {
        if (user) {
          try {
            if (fb.getDoc && fb.doc && fb.db) {
              const userDoc = await fb.getDoc(fb.doc(fb.db, 'users', user.uid));
              if (userDoc.exists()) {
                const uData = { uid: user.uid, ...userDoc.data() };
                setCurrentUser(uData);
                localStorage.setItem('cpe_current_user', JSON.stringify(uData));
                return;
              }
            }
            // Fallback: derive minimal user info if document does not exist yet
            const derivedStudentId = user.email && user.email.includes('@') ? user.email.split('@')[0] : '';
            const newUser = {
              uid: user.uid,
              email: user.email,
              name: user.displayName || 'ผู้ใช้งาน CPE',
              studentId: derivedStudentId
            };
            setCurrentUser(newUser);
            localStorage.setItem('cpe_current_user', JSON.stringify(newUser));
          } catch (e) {
            console.log('Firestore user fetch error:', e);
          }
        }
      });
    };

    if (window.CPEFirebase && window.CPEFirebase.auth) {
      initAuthListener();
    } else {
      window.addEventListener('cpe-firebase-ready', initAuthListener);
    }

    return () => {
      window.removeEventListener('cpe-firebase-ready', initAuthListener);
      unsubscribe();
    };
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'info' }), 3500);
  };

  const handleLogout = async () => {
    localStorage.removeItem('cpe_current_user');
    setCurrentUser(null);
    try {
      if (auth) await signOut(auth);
    } catch (e) { console.log("Signout error:", e); }
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  const selectProductFromBanner = (prodKey) => {
    setSelectedProductKey(prodKey);
    const elem = document.getElementById('ordering');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, showToast, setIsAuthModalOpen, handleLogout }}>
      <div className="app-layout">
        
        {/* Toast Alert Notification */}
        <Toast toast={toast} />

        {/* HEADER NAVBAR */}
        <header className="navbar">
          <div className="container nav-container">
            <a href="#" className="brand-logo">
              <img src="assets/logo.png" alt="CPE Logo" className="brand-icon" />
              <div className="brand-text">
                <h1>COMPUTER ENGINEERING</h1>
                <span>FACULTY OF ENGINEERING PSRU</span>
              </div>
            </a>

            <nav className="nav-menu">
              <a href="#hero" className="nav-link active">หน้าแรก</a>
              <a href="#ordering" className="nav-link">สั่งซื้อเสื้อสาขา</a>
              {currentUser && <a href="#tracking" className="nav-link">ติดตามสถานะ</a>}
              {currentUser && (currentUser.role !== 'teacher' && currentUser.year !== 'teacher') && (
                <button
                  onClick={() => { setPayRemainingOrder(null); setIsPayRemainingModalOpen(true); }}
                  style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, padding: '4px 8px', textDecoration: 'underline dotted' }}
                >
                  💰 ชำระส่วนที่เหลือ
                </button>
              )}
            </nav>

            <div className="nav-actions">
              {currentUser && (
                <button className="cart-btn" onClick={() => setIsCartOpen(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                  <span className="cart-count">{cart.reduce((sum, item) => sum + item.qty, 0)}</span>
                </button>
              )}

              {isAdmin && (
                <button 
                  className="btn" 
                  onClick={() => setIsAdminModalOpen(true)} 
                  style={{ 
                    background: 'linear-gradient(135deg, #d4af37 0%, #8b0c1a 100%)', 
                    color: '#fff', 
                    border: '1px solid #f5d061', 
                    fontWeight: 'bold',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    boxShadow: '0 0 12px rgba(212, 175, 55, 0.5)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  👑 แผงควบคุมแอดมิน
                </button>
              )}

              {!currentUser ? (
                <div className="auth-btn-group">
                  <button className="btn btn-outline" onClick={() => setIsAuthModalOpen(true)}>
                    เข้าสู่ระบบ / ลงทะเบียน
                  </button>
                </div>
              ) : (
                (() => {
                  const getUserTag = (user) => {
                    if (!user) return { label: 'นักศึกษา', badge: 'นักศึกษา', color: '#38bdf8', bg: 'rgba(56,189,248,0.18)', border: '#38bdf8', isTeacher: false };
                    
                    const isTeacher = user.role === 'teacher' || 
                                      user.year === 'teacher' || 
                                      user.year === 'อาจารย์ / บุคลากร' || 
                                      (user.studentId && user.studentId.toUpperCase().startsWith('T')) ||
                                      (user.studentId && !/^\d{10}$/.test(user.studentId));

                    if (isTeacher) {
                      return { label: '👨‍🏫 อาจารย์', badge: '👨‍🏫 อาจารย์ / บุคลากร', color: '#38bdf8', bg: 'rgba(56,189,248,0.18)', border: '#38bdf8', isTeacher: true };
                    }

                    // Calculate year from studentId or year property
                    let yearNum = user.year;
                    if (!yearNum && user.studentId && user.studentId.length === 10) {
                      const prefix = user.studentId.substring(0, 2);
                      if (prefix === '69') yearNum = '1';
                      else if (prefix === '68') yearNum = '2';
                      else if (prefix === '67') yearNum = '3';
                      else if (prefix === '66') yearNum = '4';
                    }

                    if (yearNum) {
                      const cleanYear = String(yearNum).replace(/\D/g, '');
                      if (cleanYear === '1') return { label: '🎓 นักศึกษา ปี 1', badge: '🎓 ปี 1 (CPE 69)', color: '#10b981', bg: 'rgba(16,185,129,0.18)', border: '#10b981', isTeacher: false };
                      if (cleanYear === '2') return { label: '🎓 นักศึกษา ปี 2', badge: '🎓 ปี 2 (CPE 68)', color: '#eab308', bg: 'rgba(234,179,8,0.18)', border: '#eab308', isTeacher: false };
                      if (cleanYear === '3') return { label: '🎓 นักศึกษา ปี 3', badge: '🎓 ปี 3 (CPE 67)', color: '#a855f7', bg: 'rgba(168,85,247,0.18)', border: '#a855f7', isTeacher: false };
                      if (cleanYear === '4') return { label: '🎓 นักศึกษา ปี 4', badge: '🎓 ปี 4 (CPE 66)', color: '#f97316', bg: 'rgba(249,115,22,0.18)', border: '#f97316', isTeacher: false };
                    }

                    return { label: '🎓 นักศึกษา', badge: '🎓 นักศึกษา', color: '#38bdf8', bg: 'rgba(56,189,248,0.18)', border: '#38bdf8', isTeacher: false };
                  };

                  const tag = getUserTag(currentUser);

                  return (
                    <div className="user-profile-menu">
                      <button className={`user-avatar-btn ${isAdmin ? 'admin-badge' : ''}`} onClick={() => {
                        const menu = document.getElementById('reactDropdownMenu');
                        if (menu) menu.classList.toggle('show');
                      }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px 4px 6px' }}>
                        <div className={`user-avatar-img ${isAdmin ? 'admin-avatar' : ''}`}>
                          {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                          <span className="user-name" style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>{currentUser.name || 'ผู้ใช้งาน'}</span>
                          <span style={{ 
                            fontSize: '0.68rem', 
                            fontWeight: 700, 
                            color: tag.color, 
                            background: tag.bg, 
                            border: `1px solid ${tag.border}`,
                            padding: '0px 5px', 
                            borderRadius: '4px',
                            marginTop: '2px'
                          }}>
                            {tag.badge}
                          </span>
                        </div>
                      </button>

                      <div id="reactDropdownMenu" className="dropdown-menu">
                        <div className="dropdown-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '0.95rem' }}>{currentUser.name}</strong>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 'bold', 
                              color: tag.color, 
                              background: tag.bg, 
                              border: `1px solid ${tag.border}`,
                              padding: '1px 6px', 
                              borderRadius: '4px'
                            }}>
                              {tag.badge}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--text-sub)', fontSize: '0.8rem' }}>
                            {tag.isTeacher ? `รหัสอาจารย์: ${currentUser.studentId || '-'}` : `รหัสนักศึกษา: ${currentUser.studentId || '-'}`}
                          </p>
                        </div>
                        {isAdmin && (
                          <div 
                            onClick={() => {
                              setIsAdminModalOpen(true);
                              const menu = document.getElementById('reactDropdownMenu');
                              if (menu) menu.classList.remove('show');
                            }} 
                            className="dropdown-item" 
                            style={{ cursor: 'pointer', color: '#f5d061', fontWeight: 'bold' }}
                          >
                            👑 แผงควบคุมแอดมิน (Admin Portal)
                          </div>
                        )}
                        <a href="#tracking" className="dropdown-item">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                          ประวัติ &amp; ติดตามออเดอร์
                        </a>
                        <div onClick={handleLogout} className="dropdown-item text-danger" style={{ cursor: 'pointer' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                          ออกจากระบบ
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </header>

        {/* HERO BANNER AUTO ROTATING SLIDER */}
        <HeroSlider onSelectProduct={selectProductFromBanner} isExpired={isExpired} showToast={showToast} />

        {/* COUNTDOWN TIMER BANNER (BELOW HERO BANNER) */}
        {(() => { window._effectiveDeadline = effectiveDeadline; return null; })()}
        <CountdownBanner isExpired={isExpired} timeLeft={timeLeft} salesMode={salesSettings.salesMode} effectiveDeadline={effectiveDeadline} />

        {/* PUBLIC TOTAL ORDERED SHIRTS COUNTER BADGE */}
        <div style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(34,197,94,0.12))', border: '1px solid rgba(234,179,8,0.3)', padding: '14px 20px', borderRadius: '12px', textAlign: 'center', margin: '20px auto 0', maxWidth: '1100px', width: '92%', boxShadow: '0 8px 25px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.6rem' }}>🔥</div>
          <div>
            <span style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700 }}>
              ยอดสั่งจองเสื้อสาขาวิชาในขณะนี้:
            </span>
            <span style={{ color: '#22c55e', fontSize: '1.6rem', fontWeight: 800, marginLeft: '8px', marginRight: '6px' }}>
              {totalShirtsCount.toLocaleString()}
            </span>
            <span style={{ color: '#fde047', fontSize: '1.1rem', fontWeight: 800 }}>
              ตัว
            </span>
          </div>
          <span style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
            ⚡ อัปเดตข้อมูลสดแบบ Realtime
          </span>
        </div>

        {/* FEATURES GRID */}
        <Features />

        {/* PRODUCT CONFIGURATOR & ORDERING SECTION */}
        <ProductConfigurator 
          selectedProductKey={selectedProductKey}
          setSelectedProductKey={setSelectedProductKey}
          cart={cart}
          setCart={setCart}
          setIsSizeGuideOpen={setIsSizeGuideOpen}
          setIsCartOpen={setIsCartOpen}
          isExpired={isExpired}
          totalShirtsCount={totalShirtsCount}
        />

        {/* ORDER TRACKING LOOKUP SECTION */}
        {currentUser && (
          <OrderTracking 
            searchQuery={searchTrackingQuery}
            setSearchQuery={setSearchTrackingQuery}
            trackedOrder={trackedOrder}
            setTrackedOrder={setTrackedOrder}
            myOrdersHistory={myOrdersHistory}
            onPayRemaining={(ord) => {
              setPayRemainingOrder(ord);
              setIsPayRemainingModalOpen(true);
            }}
          />
        )}

        {/* CART DRAWER */}
        <CartDrawer 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          setCart={setCart}
          onCheckout={() => {
            if (isExpired) {
              showToast('🚫 ระบบปิดรับการสั่งซื้อเสื้อแล้ว (หมดเวลาสั่งจองเมื่อ 14:40 น.)', 'error');
              return;
            }
            setIsCartOpen(false);
            setIsCheckoutOpen(true);
          }}
          isExpired={isExpired}
          showToast={showToast}
        />

        {/* AUTH MODAL (CPE PORTAL) */}
        <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

        {/* CHECKOUT MODAL (PromptPay & Slip Upload) */}
        <CheckoutModal 
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cart={cart}
          setCart={setCart}
          setTrackedOrder={setTrackedOrder}
          setMyOrdersHistory={setMyOrdersHistory}
          setSearchTrackingQuery={setSearchTrackingQuery}
          isExpired={isExpired}
        />

        {/* SIZE GUIDE MODAL */}
        <SizeGuideModal 
          isOpen={isSizeGuideOpen}
          onClose={() => setIsSizeGuideOpen(false)}
        />

        {/* ADMIN DASHBOARD MODAL */}
        <AdminDashboardModal 
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
        />

        <ExtraDepositModal
          isOpen={isExtraDepositModalOpen}
          onClose={() => setIsExtraDepositModalOpen(false)}
          showToast={showToast}
        />

        <PayRemainingModal
          isOpen={isPayRemainingModalOpen}
          onClose={() => setIsPayRemainingModalOpen(false)}
          initialOrder={payRemainingOrder}
          showToast={showToast}
        />

        {/* FOOTER */}
        <Footer />

      </div>
    </AuthContext.Provider>
  );
}

// COUNTDOWN BANNER COMPONENT
function CountdownBanner({ isExpired, timeLeft, salesMode, effectiveDeadline }) {
  return (
    <div className="container" style={{ marginTop: '24px', marginBottom: '16px' }}>
      <div style={{
        background: isExpired 
          ? 'linear-gradient(135deg, rgba(35, 10, 15, 0.95), rgba(15, 6, 8, 0.98))'
          : 'linear-gradient(135deg, rgba(20, 22, 34, 0.95), rgba(10, 11, 17, 0.98))',
        border: `1px solid ${isExpired ? 'rgba(239, 68, 68, 0.7)' : 'rgba(245, 208, 97, 0.5)'}`,
        borderRadius: '20px',
        padding: '20px 28px',
        boxShadow: isExpired 
          ? '0 12px 40px rgba(0,0,0,0.8), 0 0 30px rgba(239,68,68,0.25)' 
          : '0 12px 40px rgba(0,0,0,0.8), 0 0 35px rgba(245,208,97,0.2), inset 0 0 25px rgba(139,12,26,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        {/* Left Info HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: '1 1 300px' }}>
          <div style={{
            width: '58px',
            height: '58px',
            borderRadius: '16px',
            background: isExpired 
              ? 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(153,27,27,0.5) 100%)' 
              : 'radial-gradient(circle, rgba(245,208,97,0.3) 0%, rgba(139,12,26,0.6) 100%)',
            border: `2px solid ${isExpired ? '#ef4444' : '#F5D061'}`,
            boxShadow: isExpired ? '0 0 20px rgba(239,68,68,0.5)' : '0 0 20px rgba(245,208,97,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            flexShrink: 0
          }}>
            {isExpired ? '🚫' : '⚡'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{
                background: isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(245,208,97,0.18)',
                border: `1px solid ${isExpired ? '#ef4444' : '#F5D061'}`,
                color: isExpired ? '#fca5a5' : '#F5D061',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 12px',
                borderRadius: '20px',
                letterSpacing: '1px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isExpired ? '#ef4444' : '#22c55e',
                  boxShadow: isExpired ? '0 0 10px #ef4444' : '0 0 10px #22c55e'
                }}></span>
                {isExpired ? 'SYSTEM LOCKED' : 'LIVE COUNTDOWN'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>| CPE PORTAL SYSTEM</span>
            </div>

            <h4 style={{ 
              color: isExpired ? '#fca5a5' : '#F5D061', 
              margin: 0, 
              fontSize: '1.2rem', 
              fontWeight: 800,
              letterSpacing: '0.3px',
              textShadow: isExpired ? 'none' : '0 0 12px rgba(245,208,97,0.4)'
            }}>
              {isExpired
                ? 'ปิดรับการสั่งซื้อเสื้อแล้ว (หมดระยะเวลาสั่งจอง)'
                : `นับถอยหลังปิดรับออเดอร์สั่งจองเสื้อ (กำหนดปิด ${formatDeadlineText(effectiveDeadline)})`}
            </h4>
            <p style={{ color: 'var(--text-sub)', margin: 0, fontSize: '0.83rem', marginTop: '3px' }}>
              {isExpired 
                ? 'ระบบปิดรับคำสั่งซื้อเสื้อทุกรุ่นแล้ว เนื่องจากถึงกำหนดหมดระยะเวลาที่ตั้งไว้' 
                : 'กรุณาส่งออเดอร์และโอนเงินมัดจำก่อนหมดเวลาถอยหลังเพื่อรักษาสิทธิ์สั่งผลิต'}
            </p>
            {salesMode === 'open' && (
              <span style={{ display: 'inline-block', marginTop: '6px', background: '#16a34a', color: '#fff', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', padding: '2px 10px' }}>
                🟢 แอดมินเปิดรับออเดอร์แบบไม่จำกัดเวลา
              </span>
            )}
            {salesMode === 'closed' && (
              <span style={{ display: 'inline-block', marginTop: '6px', background: '#dc2626', color: '#fff', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', padding: '2px 10px' }}>
                🔴 แอดมินปิดรับออเดอร์ชั่วคราว
              </span>
            )}
          </div>
        </div>

        {/* Right Digital Cyber Clock */}
        {!isExpired ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {timeLeft.days > 0 && (
              <>
                <div style={{
                  background: 'linear-gradient(180deg, #1d2133 0%, #0a0c14 100%)',
                  border: '1px solid rgba(245, 208, 97, 0.6)',
                  borderRadius: '14px',
                  padding: '10px 18px',
                  textAlign: 'center',
                  minWidth: '85px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)'
                }}>
                  <span style={{
                    fontFamily: "'Chakra Petch', 'Kanit', sans-serif",
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    textShadow: '0 0 16px rgba(245, 208, 97, 0.85)',
                    display: 'block',
                    lineHeight: 1
                  }}>
                    {String(timeLeft.days).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#F5D061',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    marginTop: '4px',
                    display: 'block'
                  }}>
                    DAYS
                  </span>
                </div>

                <span style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#F5D061',
                  textShadow: '0 0 12px #F5D061'
                }}>:</span>
              </>
            )}

            <div style={{
              background: 'linear-gradient(180deg, #1d2133 0%, #0a0c14 100%)',
              border: '1px solid rgba(245, 208, 97, 0.6)',
              borderRadius: '14px',
              padding: '10px 18px',
              textAlign: 'center',
              minWidth: '85px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}>
              <span style={{
                fontFamily: "'Chakra Petch', 'Kanit', sans-serif",
                fontSize: '2rem',
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 0 16px rgba(245, 208, 97, 0.85)',
                display: 'block',
                lineHeight: 1
              }}>
                {String(timeLeft.hours).padStart(2, '0')}
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: '#F5D061',
                fontWeight: 700,
                letterSpacing: '1px',
                marginTop: '4px',
                display: 'block'
              }}>
                HOURS
              </span>
            </div>

            <span style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '2rem',
              fontWeight: 800,
              color: '#F5D061',
              textShadow: '0 0 12px #F5D061'
            }}>:</span>

            <div style={{
              background: 'linear-gradient(180deg, #1d2133 0%, #0a0c14 100%)',
              border: '1px solid rgba(245, 208, 97, 0.6)',
              borderRadius: '14px',
              padding: '10px 18px',
              textAlign: 'center',
              minWidth: '85px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}>
              <span style={{
                fontFamily: "'Chakra Petch', 'Kanit', sans-serif",
                fontSize: '2rem',
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 0 16px rgba(245, 208, 97, 0.85)',
                display: 'block',
                lineHeight: 1
              }}>
                {String(timeLeft.minutes).padStart(2, '0')}
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: '#F5D061',
                fontWeight: 700,
                letterSpacing: '1px',
                marginTop: '4px',
                display: 'block'
              }}>
                MINS
              </span>
            </div>

            <span style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '2rem',
              fontWeight: 800,
              color: '#F5D061',
              textShadow: '0 0 12px #F5D061'
            }}>:</span>

            <div style={{
              background: 'linear-gradient(180deg, #1d2133 0%, #0a0c14 100%)',
              border: '1px solid rgba(245, 208, 97, 0.6)',
              borderRadius: '14px',
              padding: '10px 18px',
              textAlign: 'center',
              minWidth: '85px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}>
              <span style={{
                fontFamily: "'Chakra Petch', 'Kanit', sans-serif",
                fontSize: '2rem',
                fontWeight: 800,
                color: '#ffffff',
                textShadow: '0 0 16px rgba(245, 208, 97, 0.85)',
                display: 'block',
                lineHeight: 1
              }}>
                {String(timeLeft.seconds).padStart(2, '0')}
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: '#F5D061',
                fontWeight: 700,
                letterSpacing: '1px',
                marginTop: '4px',
                display: 'block'
              }}>
                SECS
              </span>
            </div>
          </div>
        ) : (
          <span style={{
            background: 'linear-gradient(135deg, #ef4444, #991b1b)',
            color: '#ffffff',
            fontWeight: 700,
            padding: '10px 24px',
            borderRadius: '14px',
            fontSize: '0.9rem',
            letterSpacing: '1px',
            boxShadow: '0 6px 20px rgba(239,68,68,0.4)',
            border: '1px solid #fca5a5',
            flexShrink: 0
          }}>
            🔒 REGISTRATION CLOSED
          </span>
        )}

      </div>
    </div>
  );
}

// 1. HERO BANNER COMPONENT
function HeroSlider({ onSelectProduct, isExpired, showToast }) {
  const { currentUser } = useContext(AuthContext);

  return (
    <section id="hero" className="hero-section">
      <div className="container">
        <div className="banner-container">
          <div className="banner-slider">
            {/* CPE Navy Polo Poster */}
            <div className="banner-slide active">
              <img src="assets/polo_navy_banner.jpg" alt="CPE Polo Navy Banner" className="banner-img" />
              <div className="banner-overlay-bar">
                <div className="banner-tagline">
                  <span className="tech-pill">CPE POLO SHIRT (NAVY BLUE)</span>
                  <div className="banner-text-content">
                    <h2>เสื้อโปโลสาขารุ่นใหม่ สีกรมท่า ดีไซน์เรียบหรู ใส่สบาย (ราคา ฿300)</h2>
                  </div>
                </div>
                <div className="banner-cta-group">
                  <button 
                    onClick={() => {
                      if (isExpired) {
                        if (showToast) showToast('🚫 ระบบปิดรับการสั่งซื้อเสื้อแล้ว (หมดเวลาสั่งจองเมื่อ 14:40 น.)', 'error');
                        return;
                      }
                      onSelectProduct('polo_navy');
                    }} 
                    className="btn btn-gold"
                    style={{ opacity: isExpired ? 0.6 : 1 }}
                  >
                    {isExpired ? '⛔ ปิดรับการสั่งซื้อแล้ว' : 'สั่งซื้อเสื้อโปโลสีกรมท่า'}
                  </button>
                  {currentUser && <a href="#tracking" className="btn btn-outline">เช็คสถานะออเดอร์</a>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 2. FEATURES COMPONENT
function Features() {
  return (
    <section className="features-section">
      <div className="container">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <div className="feature-info">
              <h3>เนื้อผ้าใส่สบาย ระบายอากาศ</h3>
              <p>ผ้า Micro Polyester เกรดพรีเมียม ใส่สบาย ไม่ร้อน ไม่ยับง่าย</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            </div>
            <div className="feature-icon-text">
              <h3>งานปัก &amp; สกรีนประณีต</h3>
              <p>ปักโลโก้ตราสาขา อกซ้าย / สกรีนวงจรคอมพิวเตอร์ด้านหลังคมชัด</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div className="feature-info">
              <h3>ราคาสาขาพิเศษ สำหรับนักศึกษา</h3>
              <p>เสื้อโปโล ฿350 / เสื้อคลุม CPE 69 ฿920 (ไซส์ SS - 8XL)</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            </div>
            <div className="feature-info">
              <h3>รับสินค้าสะดวกที่สาขา</h3>
              <p>สั่งจองล่วงหน้า ติดตามสถานะการผลิตได้ตลอด 24 ชั่วโมง</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 3. PRODUCT CONFIGURATOR COMPONENT
function ProductConfigurator({ selectedProductKey, setSelectedProductKey, cart, setCart, setIsSizeGuideOpen, setIsCartOpen, isExpired, totalShirtsCount = 0 }) {
  const { currentUser, showToast, setIsAuthModalOpen } = useContext(AuthContext);
  const [selectedSize, setSelectedSize] = useState('M');
  const [currentView, setCurrentView] = useState('front');
  const [customName, setCustomName] = useState('');
  const [studentIdInput, setStudentIdInput] = useState(currentUser?.studentId || '');
  const [qty, setQty] = useState(1);
  const [itemsConfig, setItemsConfig] = useState([
    { size: 'M', customName: '' }
  ]);

  const handleQtyChange = (newQty) => {
    const validQty = Math.max(1, Math.min(50, newQty));
    setQty(validQty);
    setItemsConfig(prev => {
      if (validQty > prev.length) {
        const added = Array.from({ length: validQty - prev.length }, () => ({
          size: prev[prev.length - 1]?.size || 'M',
          customName: ''
        }));
        return [...prev, ...added];
      } else {
        return prev.slice(0, validQty);
      }
    });
  };

  const updateItemConfig = (index, field, value) => {
    setItemsConfig(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveShirt = (index) => {
    if (itemsConfig.length <= 1) return;
    const next = itemsConfig.filter((_, i) => i !== index);
    setItemsConfig(next);
    setQty(next.length);
  };

  const handleAddShirt = () => {
    handleQtyChange(qty + 1);
  };

  // Determine admin status – include fallback from localStorage in case auth state hasn't loaded yet
  const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('cpe_current_user') : null;
  const parsedStored = storedUser ? JSON.parse(storedUser) : null;
  const isAdmin = currentUser?.studentId === '6800000000' || currentUser?.role === 'admin' ||
                  parsedStored?.studentId === '6800000000' || parsedStored?.role === 'admin';

  const userStudentId = currentUser?.studentId;
  const isTeacherUser = currentUser?.role === 'teacher' || 
                        currentUser?.year === 'teacher' || 
                        currentUser?.year === 'อาจารย์ / บุคลากร' || 
                        (userStudentId && userStudentId.toUpperCase().startsWith('T')) ||
                        (studentIdInput && studentIdInput.trim().toUpperCase().startsWith('T')) ||
                        (userStudentId && !/^\d{10}$/.test(userStudentId));

  // Force polo_navy for ALL users as requested: "ปรับให้ทุกคนสั่งได้แค่เสื้อโปโลสีกรม"
  useEffect(() => {
    if (selectedProductKey !== 'polo_navy') {
      setSelectedProductKey('polo_navy');
    }
  }, [selectedProductKey]);

  useEffect(() => {
    if (currentUser?.studentId) setStudentIdInput(currentUser.studentId);
  }, [currentUser]);

  useEffect(() => {
    if (currentView === 'sleeve') {
      setCurrentView('front');
    }
  }, [selectedProductKey]);

  const prod = PRODUCTS.polo_navy || PRODUCTS.polo;

  const isLargeSize = (sz) => ['5XL', '6XL', '7XL', '8XL'].includes((sz || '').toUpperCase());

  // Calculate Total Price dynamically across all items
  const totalPrice = itemsConfig.reduce((sum, item) => {
    let itemPrice = prod.basePrice;
    if (isLargeSize(item.size)) {
      itemPrice += prod.largeFee;
    }
    return sum + itemPrice;
  }, 0);

  const handleAddToCart = () => {
    if (isExpired) {
      showToast('🚫 ระบบปิดรับการสั่งซื้อเสื้อแล้ว (หมดเวลาสั่งจองเมื่อ 14:40 น.)', 'error');
      return;
    }
    if (!currentUser) {
      showToast('กรุณาเข้าสู่ระบบ (Login) ก่อนสั่งซื้อสินค้า', 'error');
      if (setIsAuthModalOpen) setIsAuthModalOpen(true);
      return;
    }
    const isTeacher = isTeacherUser;

    if (!studentIdInput.trim() || (!isTeacher && studentIdInput.trim().length !== 10)) {
      showToast(isTeacher ? 'กรุณากรอกรหัสอาจารย์ / รหัสประจำตัว' : 'กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)', 'error');
      return;
    }

    const newCartItems = itemsConfig.map((itemCfg, idx) => {
      let itemPrice = prod.basePrice;
      if (isLargeSize(itemCfg.size)) {
        itemPrice += prod.largeFee;
      }
      return {
        id: Date.now() + idx,
        productKey: 'polo_navy',
        title: prod.title,
        size: itemCfg.size,
        qty: 1,
        customName: '',
        studentId: studentIdInput.trim() || currentUser?.studentId || '6812345678',
        price: itemPrice,
        totalPrice: itemPrice
      };
    });

    setCart(prev => [...prev, ...newCartItems]);
    showToast(`เพิ่ม ${prod.title} (${qty} ตัว) ลงในตะกร้าเรียบร้อยแล้ว!`, 'success');
    setIsCartOpen(true);
  };

  return (
    <section id="ordering" className="ordering-section">
      <div className="container">
        
        <div className="section-header">
          <span className="subtitle">COMPUTER ENGINEERING UNIFORM</span>
          <h2 className="title">สั่งซื้อเสื้อโปโลสาขาวิศวกรรมคอมพิวเตอร์ (สีกรมท่า Navy Blue)</h2>
          {totalShirtsCount > 0 && (
            <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e', padding: '6px 16px', borderRadius: '20px', color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem' }}>
              <span>📦 ยอดสั่งซื้อเสื้อทั้งหมดขณะนี้: <strong>{totalShirtsCount.toLocaleString()} ตัว</strong></span>
            </div>
          )}
        </div>

        {/* Product Selector Switcher Tabs - Restricted to Navy Polo Only */}
        <div className="product-select-tabs" style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="product-tab-btn active"
            onClick={() => setSelectedProductKey('polo_navy')}
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #0f172a)', border: '2px solid #38bdf8', boxShadow: '0 4px 20px rgba(56,189,248,0.4)', padding: '12px 24px', borderRadius: '12px', color: '#fff', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <span>👕 เสื้อโปโลสาขา (สีกรมท่า Navy Blue) - ฿350 (5XL ขึ้นไป ฿600)</span>
          </button>
        </div>

        <div className="product-grid">
          
          {/* Visual Interactive Preview */}
          <div className="product-visual">
            <div className="main-preview-card">
              <div className="shirt-view-toggle">
                <button 
                  className={`view-btn ${currentView === 'front' ? 'active' : ''}`}
                  onClick={() => setCurrentView('front')}
                >
                  ด้านหน้า (Front)
                </button>
                <button 
                  className={`view-btn ${currentView === 'back' ? 'active' : ''}`}
                  onClick={() => setCurrentView('back')}
                >
                  ด้านหลัง (Back)
                </button>
                {selectedProductKey !== 'polo' && selectedProductKey !== 'polo_navy' && (
                  <button 
                    className={`view-btn ${currentView === 'sleeve' ? 'active' : ''}`}
                    onClick={() => setCurrentView('sleeve')}
                  >
                    รายละเอียด (Detail)
                  </button>
                )}
              </div>

              <div className="product-svg-display">
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '12px' }}>
                  <img 
                    src={prod.images[currentView] || prod.images.front} 
                    alt={prod.title} 
                    className="shirt-photo-preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: selectedProductKey === 'jacket' ? 'contain' : 'cover',
                      objectPosition: 'center top',
                      borderRadius: '10px',
                      transition: 'all 0.4s ease'
                    }}
                  />
                </div>
              </div>
            </div>


          </div>

          {/* Configurator Controls */}
          <div className="product-config">
            <div className="product-title-group">
              <h2>{prod.title}</h2>
              <div className="product-price-tag">
                <span className="current-price">฿{totalPrice.toLocaleString()}</span>
                {prod.originalPrice > prod.basePrice && (
                  <span className="original-price">฿{(prod.originalPrice * qty).toLocaleString()}</span>
                )}
                {prod.badgeText && prod.id !== 'polo' && (
                  <span className="discount-badge">{prod.badgeText}</span>
                )}
              </div>
            </div>

            {/* Per-Shirt Configuration List with Visual Size Pills */}
            <div className="config-group" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="config-label">
                <span style={{ fontSize: '0.95rem' }}>รายการเสื้อที่สั่ง ({qty} ตัว):</span>
                <a href="javascript:void(0)" onClick={() => setIsSizeGuideOpen(true)} className="link-btn">ดูตารางขนาดเสื้อ</a>
              </div>

              {itemsConfig.map((item, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    background: '#090a0f', 
                    border: '1px solid var(--border-gold)', 
                    borderRadius: '14px', 
                    padding: '16px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-gold-bright)', fontSize: '0.95rem' }}>
                      👕 {qty > 1 ? `เสื้อตัวที่ ${idx + 1}` : 'เลือกขนาดเสื้อ'} {item.size ? `(ไซส์ ${item.size})` : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: isLargeSize(item.size) ? '#F5D061' : '#22c55e' }}>
                        ฿{prod.basePrice + (isLargeSize(item.size) ? prod.largeFee : 0)}
                      </span>
                      {itemsConfig.length > 1 && (
                        <button 
                          onClick={() => handleRemoveShirt(idx)}
                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          🗑️ ลบตัวนี้
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Size Pills Grid */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '8px' }}>
                      เลือกไซส์: <strong style={{ color: 'var(--accent-gold)' }}>{item.size}</strong>
                    </div>
                    <div className="size-grid">
                      {SIZES.map(s => (
                        <div 
                          key={s.id}
                          className={`size-pill ${item.size === s.id ? 'active' : ''}`}
                          onClick={() => updateItemConfig(idx, 'size', s.id)}
                        >
                          {s.id} ({s.chest})
                          {s.isLarge && (
                            <span style={{ fontSize: '0.72rem', color: '#F5D061', display: 'block' }}>
                              +{prod.largeFee}฿
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Another Shirt Button */}
              <button 
                type="button"
                className="btn btn-outline"
                onClick={handleAddShirt}
                style={{ 
                  borderColor: 'var(--accent-gold)', 
                  color: 'var(--accent-gold-bright)', 
                  background: 'rgba(212,175,55,0.06)',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>➕ เพิ่มเสื้ออีก 1 ตัว (เลือกคนละไซส์ / ปักคนละชื่อได้)</span>
              </button>
            </div>

            {/* Student ID Input */}
            <div className="config-group">
              <div className="config-label">
                <span>รหัสนักศึกษาผู้สั่งซื้อ 10 หลัก (Student ID): <span style={{ color: '#ef4444' }}>*</span></span>
              </div>
              <input 
                type="text" 
                className="form-input" 
                placeholder="เช่น 6812345678"
                maxLength={10}
                value={studentIdInput}
                onChange={e => setStudentIdInput(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {/* Quantity & Add to Cart Button */}
            <div className="config-group" style={{ marginTop: '10px' }}>
              <div className="config-label">
                <span>จำนวนที่ต้องการสั่ง:</span>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => handleQtyChange(qty - 1)}>-</button>
                  <input type="number" className="qty-input" value={qty} readOnly />
                  <button className="qty-btn" onClick={() => handleQtyChange(qty + 1)}>+</button>
                </div>

                {isExpired ? (
                  <button className="btn btn-outline" style={{ flex: 1, borderColor: '#ef4444', color: '#fca5a5', cursor: 'not-allowed', opacity: 0.7 }} disabled>
                    🚫 ปิดรับการสั่งซื้อแล้ว (หมดเวลาสั่งจอง)
                  </button>
                ) : !currentUser ? (
                  <button className="btn btn-outline" style={{ flex: 1, borderColor: '#38bdf8', color: '#38bdf8' }} onClick={() => setIsAuthModalOpen(true)}>
                    🔒 เข้าสู่ระบบเพื่อสั่งซื้อ
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddToCart}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                    เพิ่มลงในตะกร้าสั่งซื้อ
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

// 4. ORDER TRACKING COMPONENT (Firestore Integration & Multi-Order Support)
function OrderTracking({ searchQuery, setSearchQuery, trackedOrder, setTrackedOrder, myOrdersHistory = [], onPayRemaining }) {
  const { showToast } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [foundOrders, setFoundOrders] = useState([]);

  // Sync found orders with myOrdersHistory on change
  useEffect(() => {
    if (myOrdersHistory && myOrdersHistory.length > 0) {
      setFoundOrders(myOrdersHistory);
    }
  }, [myOrdersHistory]);

  const [pendingExtraDeposit, setPendingExtraDeposit] = useState(null);

  // Real-time order update listener
  useEffect(() => {
    if (!trackedOrder || !trackedOrder.firestoreId) return;
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.doc || !fb.onSnapshot) return;
    let unsub = () => {};
    try {
      unsub = fb.onSnapshot(fb.doc(fb.db, 'orders', trackedOrder.firestoreId), (docSnap) => {
        if (docSnap.exists()) {
          const updated = { firestoreId: docSnap.id, ...docSnap.data() };
          setTrackedOrder(prev => ({ ...prev, ...updated }));
          setFoundOrders(prevList => prevList.map(o => (o.firestoreId === docSnap.id || o.id === updated.id) ? { ...o, ...updated } : o));
        }
      });
    } catch (e) { console.log("Realtime order update error:", e); }
    return () => unsub();
  }, [trackedOrder?.firestoreId]);

  // Listen for unverified pending extra deposit for this tracked order
  useEffect(() => {
    if (!trackedOrder || !trackedOrder.id) { setPendingExtraDeposit(null); return; }
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.collection || !fb.query || !fb.where || !fb.onSnapshot) return;
    let unsub = () => {};
    try {
      const q = fb.query(fb.collection(fb.db, 'extra_deposits'), fb.where('orderRef', '==', trackedOrder.id));
      unsub = fb.onSnapshot(q, (snap) => {
        let pending = null;
        snap.forEach(d => {
          const data = d.data();
          if (data.status === 'pending') pending = { id: d.id, ...data };
        });
        setPendingExtraDeposit(pending);
      });
    } catch (e) { console.log(e); }
    return () => unsub();
  }, [trackedOrder?.id]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) {
      showToast('กรุณากรอกเลขที่ออเดอร์ หรือ รหัสนักศึกษา 10 หลัก', 'error');
      return;
    }

    setLoading(true);
    try {
      const fb = window.CPEFirebase || {};
      if (!fb.db || !fb.collection || !fb.query || !fb.where || !fb.getDocs) {
        showToast('กำลังเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง', 'error');
        setLoading(false);
        return;
      }

      // Query Firestore with timeout protection (max 4s)
      const ordersRef = fb.collection(fb.db, 'orders');
      let q = fb.query(ordersRef, fb.where('id', '==', queryStr));
      let querySnapshot = await withTimeout(fb.getDocs(q), 4000);

      if (querySnapshot.empty) {
        q = fb.query(ordersRef, fb.where('studentId', '==', queryStr));
        querySnapshot = await withTimeout(fb.getDocs(q), 4000);
      }

      if (!querySnapshot.empty) {
        let foundList = [];
        querySnapshot.forEach(docSnap => {
          foundList.push({ firestoreId: docSnap.id, ...docSnap.data() });
        });

        // PRIVACY LOCK: Filter out any orders that don't belong to currentUser
        if (currentUser && currentUser.studentId) {
          foundList = foundList.filter(ord => 
            (currentUser.studentId && ord.studentId === currentUser.studentId) ||
            (currentUser.uid && ord.userUid === currentUser.uid)
          );
        }

        if (foundList.length > 0) {
          setFoundOrders(foundList);
          setTrackedOrder(foundList[0]);
          showToast(`พบข้อมูลคำสั่งซื้อ ${foundList.length} รายการของคุณในระบบ!`, 'success');
        } else {
          setFoundOrders([]);
          setTrackedOrder(null);
          showToast('ไม่พบข้อมูลคำสั่งซื้อของคุณตามข้อมูลที่ระบุในระบบ', 'error');
        }
      } else {
        setFoundOrders([]);
        setTrackedOrder(null);
        showToast('ไม่พบข้อมูลคำสั่งซื้อสำหรับรหัสนักศึกษา หรือเลขที่ออเดอร์นี้ในระบบ', 'error');
      }
    } catch (err) {
      console.log("Firestore Search:", err);
      showToast('ไม่พบข้อมูลออเดอร์ที่ระบุ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!trackedOrder?.firestoreId) return;
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.doc || !fb.deleteDoc) return;
    try {
      await fb.deleteDoc(fb.doc(fb.db, 'orders', trackedOrder.firestoreId));
      showToast('ยกเลิกออเดอร์สำเร็จ', 'success');
      const updatedList = foundOrders.filter(o => o.firestoreId !== trackedOrder.firestoreId);
      setFoundOrders(updatedList);
      setTrackedOrder(updatedList.length > 0 ? updatedList[0] : null);
    } catch (err) {
      console.log('Cancel order error:', err);
      showToast('ยกเลิกออเดอร์ไม่สำเร็จ', 'error');
    }
  };

  const getStepStatus = (stepKey, currentStatus) => {
    const order = ['pending', 'paid', 'preparing', 'shipping', 'completed'];
    const currentIdx = order.indexOf(currentStatus || 'pending');
    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'current';
    return '';
  };

  const getProgressWidth = (currentStatus) => {
    switch (currentStatus) {
      case 'pending': return '0%';
      case 'paid': return '25%';
      case 'preparing': return '50%';
      case 'shipping': return '75%';
      case 'completed': return '100%';
      default: return '0%';
    }
  };

  return (
    <section id="tracking" className="tracking-section">
      <div className="container">
        
        <div className="section-header">
          <span className="subtitle">STATUS CHECK (FIREBASE SYNC)</span>
          <h2 className="title">ตรวจสอบและติดตามสถานะการสั่งซื้อ</h2>
        </div>

        <div className="tracking-card">
          <p style={{ color: 'var(--text-sub)', textAlign: 'center', fontSize: '0.95rem' }}>
            กรอกหมายเลขออเดอร์ (เช่น CPE-2026-XXXX) หรือ รหัสนักศึกษา 10 หลัก เพื่อตรวจสอบสถานะการชำระเงินและการผลิตในระบบ Cloud
          </p>

          <form onSubmit={handleSearch} className="search-box">
            <input 
              type="text" 
              className="form-input" 
              placeholder="กรอกเลขที่ออเดอร์ หรือ รหัสนักศึกษา 10 หลัก..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-gold" disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              {loading ? 'กำลังค้นหา...' : 'ค้นหาสถานะ'}
            </button>
          </form>

          {/* Multiple Orders Selector Tabs */}
          {foundOrders.length > 1 && (
            <div style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(212,175,55,0.06)', border: '1px solid var(--border-gold)', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--accent-gold-bright)', marginBottom: '10px', fontWeight: 'bold' }}>
                📦 พบรายการสั่งซื้อของคุณทั้งหมด {foundOrders.length} ออเดอร์ (คลิกเพื่อดูรายละเอียด):
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {foundOrders.map((ord, idx) => {
                  const isSelected = trackedOrder?.id === ord.id || trackedOrder?.firestoreId === ord.firestoreId;
                  const itemCount = ord.items ? ord.items.reduce((sum, item) => sum + (item.qty || 1), 0) : 1;
                  return (
                    <button
                      key={ord.firestoreId || ord.id || idx}
                      onClick={() => {
                        setTrackedOrder(ord);
                        if (ord.id) setSearchQuery(ord.id);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid var(--accent-gold-bright)' : '1px solid rgba(255,255,255,0.15)',
                        background: isSelected ? 'linear-gradient(135deg, rgba(212,175,55,0.3) 0%, rgba(184,30,48,0.3) 100%)' : 'rgba(255,255,255,0.05)',
                        color: isSelected ? '#fff' : 'var(--text-sub)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ออเดอร์ #{idx + 1}: {ord.id} ({itemCount} ตัว)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Render Tracking Results */}
          {trackedOrder ? (
            <div className="tracking-result-box" style={{ marginTop: '24px', background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ color: 'var(--accent-gold-bright)', fontSize: '1.2rem' }}>{trackedOrder.id}</h4>
                  <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>ผู้สั่งซื้อ: {trackedOrder.name} (รหัส: {trackedOrder.studentId})</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tech-pill">ยอดรวม: ฿{(trackedOrder.total || 0).toLocaleString()}</span>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{trackedOrder.date}</p>
                </div>
              </div>

              {/* Pending Extra Deposit Notice */}
              {pendingExtraDeposit && (
                <div style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid #eab308', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.85rem', color: '#fde047', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>⏳</span>
                  <span>สลิปโอนมัดจำเพิ่ม 100 บาทของคุณส่งเข้าระบบแล้ว (กำลังรอแอดมินตรวจสอบสลิป เมื่อแอดมินกดอนุมัติ ยอดค้างชำระจะถูกหักออกให้อัตโนมัติทันที)</span>
                </div>
              )}

              {/* Financial & Deposit Summary Card */}
              {(() => {
                const calcTotal = getOrderTotal(trackedOrder);
                const depositPaid = typeof trackedOrder.deposit === 'number' ? trackedOrder.deposit : 0;
                const remainingAmt = trackedOrder.remainingPaidStatus === 'approved' ? 0 : Math.max(0, calcTotal - depositPaid);
                const isTeacherOrder = trackedOrder.isTeacher || trackedOrder.role === 'teacher' || remainingAmt === 0 || depositPaid >= calcTotal;

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(245,208,97,0.2)' }}>
                      <div style={{ background: '#0f1017', border: '1px solid #22c55e', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 600 }}>{isTeacherOrder ? '💰 ชำระเงินเต็มจำนวนแล้ว' : '💰 ชำระมัดจำแล้ว'}</span>
                        <h4 style={{ color: '#22c55e', fontSize: '1.25rem', margin: '2px 0 0', fontWeight: 800 }}>฿{depositPaid.toLocaleString()}</h4>
                      </div>
                      <div style={{ background: '#0f1017', border: `1px solid ${isTeacherOrder ? '#22c55e' : '#eab308'}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ color: isTeacherOrder ? '#86efac' : '#fde047', fontSize: '0.78rem', fontWeight: 600 }}>{isTeacherOrder ? '✅ สถานะยอดค้างชำระ' : '⚠️ ยอดค้างชำระ (วันรับเสื้อ)'}</span>
                        <h4 style={{ color: isTeacherOrder ? '#22c55e' : '#eab308', fontSize: '1.25rem', margin: '2px 0 0', fontWeight: 800 }}>{isTeacherOrder ? '฿0 (ชำระแล้ว)' : `฿${remainingAmt.toLocaleString()}`}</h4>
                      </div>
                      <div style={{ background: '#0f1017', border: '1px solid var(--border-gold)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem', fontWeight: 600 }}>🏷️ ยอดเต็มออเดอร์</span>
                        <h4 style={{ color: '#fff', fontSize: '1.25rem', margin: '2px 0 0', fontWeight: 800 }}>฿{calcTotal.toLocaleString()}</h4>
                      </div>
                    </div>

                    {trackedOrder.remainingPaidStatus === 'pending_verification' ? (
                      <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(56,189,248,0.12)', border: '1px solid #38bdf8', borderRadius: '10px', color: '#38bdf8', fontSize: '0.88rem', textAlign: 'center', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span>⏳</span>
                        <span>สลิปโอนเงินส่วนที่เหลือ ฿{trackedOrder.remainingAmountPaid ? trackedOrder.remainingAmountPaid.toLocaleString() : remainingAmt.toLocaleString()} ส่งเข้าสู่ระบบแล้ว (กำลังรอแอดมินตรวจสอบ)</span>
                      </div>
                    ) : trackedOrder.remainingPaidStatus === 'approved' || remainingAmt === 0 || isTeacherOrder ? (
                      <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e', borderRadius: '10px', color: '#22c55e', fontSize: '0.88rem', textAlign: 'center', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span>✅</span>
                        <span>ชำระเงินครบถ้วนสมบูรณ์แล้ว (ไม่มี ยอดค้างชำระ)</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onPayRemaining && onPayRemaining(trackedOrder)}
                        style={{
                          marginBottom: '16px',
                          padding: '12px 18px',
                          background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 18px rgba(34,197,94,0.4)',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>💳</span>
                        <span>สแกนจ่ายชำระส่วนที่เหลือ ฿{remainingAmt.toLocaleString()} (PromptPay 0923637199)</span>
                      </button>
                    )}
                  </>
                );
              })()}

              {/* Order Items Detail Breakdown */}
              {trackedOrder.items && trackedOrder.items.length > 0 && (
                <div style={{ marginTop: '16px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h5 style={{ color: 'var(--accent-gold-bright)', marginBottom: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🛒 รายการสินค้าในออเดอร์นี้ ({trackedOrder.items.reduce((acc, item) => acc + (item.qty || 1), 0)} ตัว):
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {trackedOrder.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>{item.title || item.name || 'เสื้อ CPE'}</div>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.8rem', marginTop: '2px' }}>
                            ไซส์: <span style={{ color: 'var(--accent-gold-bright)', fontWeight: 'bold' }}>{item.size || 'L'}</span> 
                            {item.customName ? ` | ปักชื่อ: "${item.customName}"` : ' | (ไม่ปักชื่อ)'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>x{item.qty || 1} ตัว</span>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>฿{(item.totalPrice || item.price * (item.qty || 1) || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stepper Timeline */}
              <div className="stepper" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: '24px' }}>
                <div className="stepper-progress" style={{ width: getProgressWidth(trackedOrder.status), background: 'var(--primary-red-light)' }}></div>
                <div className={`step-item ${getStepStatus('pending', trackedOrder.status)}`}>
                  <div className="step-node">1</div>
                  <div className="step-label">รอตรวจสอบสลิป</div>
                </div>
                <div className={`step-item ${getStepStatus('paid', trackedOrder.status)}`}>
                  <div className="step-node">2</div>
                  <div className="step-label">ชำระเงินแล้ว</div>
                </div>
                <div className={`step-item ${getStepStatus('preparing', trackedOrder.status)}`}>
                  <div className="step-node">3</div>
                  <div className="step-label">กำลังผลิต/ปักลาย</div>
                </div>
                <div className={`step-item ${getStepStatus('shipping', trackedOrder.status)}`}>
                  <div className="step-node">4</div>
                  <div className="step-label">เตรียมจัดส่ง</div>
                </div>
                <div className={`step-item ${getStepStatus('completed', trackedOrder.status)}`}>
                  <div className="step-node">5</div>
                  <div className="step-label">รับสินค้าเรียบร้อย</div>
                </div>
              </div>

              {trackedOrder.trackingNumber && (
                <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid var(--border-gold)', padding: '10px 14px', borderRadius: '8px', marginTop: '20px', fontSize: '0.88rem', color: 'var(--accent-gold-bright)' }}>
                  📦 หมายเลขพัสดุ/อ้างอิงการรับสินค้า: <strong>{trackedOrder.trackingNumber}</strong>
                </div>
              )}

              {trackedOrder && trackedOrder.status !== 'shipping' && trackedOrder.status !== 'completed' && (
                <button 
                  onClick={handleCancel} 
                  style={{ 
                    background: 'rgba(184, 30, 48, 0.15)', 
                    color: '#ff4d4d', 
                    border: '1px solid rgba(184, 30, 48, 0.5)', 
                    padding: '8px 16px', 
                    borderRadius: '6px', 
                    marginTop: '16px', 
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease',
                    width: '100%',
                    textAlign: 'center',
                    display: 'block'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = 'var(--primary-red)';
                    e.target.style.color = '#fff';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'rgba(184, 30, 48, 0.15)';
                    e.target.style.color = '#ff4d4d';
                  }}
                >
                  ❌ ยกเลิกออเดอร์ (Cancel Order)
                </button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-sub)' }}>
              <p style={{ fontSize: '0.95rem' }}>💡 กรอกหมายเลขออเดอร์หรือรหัสนักศึกษา 10 หลัก เพื่อค้นหาสถานะการสั่งซื้อของคุณ</p>
            </div>
          )}

        </div>

      </div>
    </section>
  );
}

// 5. CART DRAWER COMPONENT
function CartDrawer({ isOpen, onClose, cart, setCart, onCheckout }) {
  const { currentUser, showToast } = useContext(AuthContext);
  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const removeItem = (indexToDelete) => {
    const updated = cart.filter((_, idx) => idx !== indexToDelete);
    setCart(updated);
    try {
      localStorage.setItem('cpe_cart', JSON.stringify(updated));
    } catch (e) {}
    if (showToast) showToast('ลบรายการออกจากตะกร้าเรียบร้อยแล้ว', 'info');
  };

  const clearAllCart = () => {
    setCart([]);
    try {
      localStorage.setItem('cpe_cart', JSON.stringify([]));
    } catch (e) {}
    if (showToast) showToast('ล้างตะกร้าสินค้าทั้งหมดแล้ว', 'info');
  };

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 9998, opacity: 1, pointerEvents: 'auto' }}></div>
      <aside className="cart-drawer show open" style={{ position: 'fixed', top: 0, bottom: 0, right: 0, width: '100%', maxWidth: '450px', background: '#10121a', borderLeft: '1px solid var(--border-gold)', zIndex: 9999, display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.8)' }}>
        <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            ตะกร้าสินค้า ({cart.length})
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {cart.length > 0 && (
              <button 
                onClick={clearAllCart}
                style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                🗑️ ล้างทั้งหมด
              </button>
            )}
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="drawer-body" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 10px', color: 'var(--text-muted)' }}>
              🛒 ไม่มีสินค้าในตะกร้าขณะนี้
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={item.id || idx} className="cart-item-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ color: '#fff', fontSize: '0.92rem', margin: '0 0 4px 0' }}>{item.title}</h4>
                  <p style={{ color: 'var(--accent-gold)', fontSize: '0.8rem', margin: 0 }}>
                    ไซส์: <strong>{item.size}</strong> | จำนวน: {item.qty} ตัว
                  </p>
                  {item.customName && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold-bright)', display: 'block', marginTop: '2px' }}>
                      ปักชื่อ: {item.customName}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: 'var(--accent-gold-bright)', fontSize: '1rem', display: 'block' }}>฿{(item.totalPrice || item.price * item.qty).toLocaleString()}</strong>
                  <button 
                    onClick={() => removeItem(idx)} 
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.78rem', marginTop: '6px' }}
                  >
                    🗑️ ลบรายการ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="drawer-footer">
          <div className="summary-row">
            <span>ราคารวมสินค้า</span>
            <span>฿{subtotal.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>ค่าจัดส่ง</span>
            <span style={{ color: '#22c55e' }}>ฟรี (รับที่สาขา)</span>
          </div>
          <div className="summary-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
            <span>ยอดรวมทั้งหมด</span>
            <span style={{ color: 'var(--text-sub)' }}>฿{subtotal.toLocaleString()}</span>
          </div>
          <div className="summary-row total">
            <span>💰 ยอดชำระเงินเต็มจำนวน (100%)</span>
            <span style={{ color: '#22c55e', fontSize: '1.3rem', fontWeight: 'bold' }}>
              ฿{subtotal.toLocaleString()}
            </span>
          </div>
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '8px 10px', marginTop: '6px', fontSize: '0.78rem', color: '#22c55e' }}>
            ✅ ชำระเงินเต็มจำนวน 100% (ไม่มี ยอดค้างชำระ)
          </div>

          <button 
            className="btn btn-gold" 
            style={{ width: '100%', marginTop: '15px' }}
            disabled={cart.length === 0}
            onClick={onCheckout}
          >
            ดำเนินการชำระเงินเต็มจำนวน ฿{subtotal.toLocaleString()} &rarr;
          </button>
        </div>
      </aside>
    </>
  );
}

// 6. AUTH MODAL COMPONENT (CPE PORTAL)
function AuthModal({ isOpen, onClose }) {
  const { setCurrentUser, showToast } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('login');

  // Form states
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regName, setRegName] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regYear, setRegYear] = useState('2');
  const [regNickname, setRegNickname] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authErr, setAuthErr] = useState('');

  const switchTab = (tab) => {
    setActiveTab(tab);
    setAuthErr('');
  };

  if (!isOpen) return null;



  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanId = loginId.trim();
    const cleanPass = loginPass.trim();

    if (!cleanId || !cleanPass) {
      showToast('กรุณากรอกรหัสนักศึกษาและรหัสผ่าน', 'error');
      return;
    }

    if (cleanId.length !== 10) {
      showToast('รหัสนักศึกษาต้องมี 10 หลักเท่านั้น', 'error');
      return;
    }

    const fb = window.CPEFirebase;

    // 1. Special Admin Account Check
    if (cleanId === '6800000000' && cleanPass === 'admin123') {
      const adminSession = {
        uid: 'admin-6800000000',
        studentId: '6800000000',
        name: '👑 ผู้ดูแลระบบ (Admin CPE)',
        role: 'admin',
        email: 'admin@psru.ac.th'
      };
      setCurrentUser(adminSession);
      localStorage.setItem('cpe_current_user', JSON.stringify(adminSession));
      showToast('เข้าสู่ระบบแอดมินสำเร็จ! 👑', 'success');
      onClose();
      return;
    }

    setIsSubmitting(true);
    let verifiedUser = null;
    const authEmail = cleanId.includes('@') ? cleanId : `${cleanId}@psru.ac.th`;

    try {
      // 2. Strict Database Verification via Firebase Auth (max 4s timeout)
      if (fb && fb.auth && fb.signInWithEmailAndPassword) {
        try {
          const res = await withTimeout(fb.signInWithEmailAndPassword(fb.auth, authEmail, cleanPass), 4000);
          
          if (res && res.user && fb.db && fb.getDoc && fb.doc) {
            try {
              const userDoc = await withTimeout(fb.getDoc(fb.doc(fb.db, 'users', res.user.uid)), 3000);
              if (userDoc && userDoc.exists()) {
                verifiedUser = { uid: res.user.uid, ...userDoc.data() };
              }
            } catch (e) {}
          }

          if (!verifiedUser && res && res.user) {
            verifiedUser = { uid: res.user.uid, studentId: cleanId, name: 'นักศึกษา CPE', email: authEmail };
          }
        } catch (err) {
          console.log("Firebase Auth login attempt error:", err);
        }
      }

      // 3. Fallback: Search Firestore `users` collection by studentId (max 3s timeout)
      if (!verifiedUser && fb && fb.db && fb.collection && fb.query && fb.where && fb.getDocs) {
        try {
          const usersRef = fb.collection(fb.db, 'users');
          const q = fb.query(usersRef, fb.where('studentId', '==', cleanId));
          const snap = await withTimeout(fb.getDocs(q), 3000);
          if (snap && !snap.empty) {
            const docData = snap.docs[0].data();
            verifiedUser = { uid: snap.docs[0].id, ...docData };
          }
        } catch (e) {
          console.log("Firestore search fallback error:", e);
        }
      }

      // 4. Fallback: Search localStorage saved user session
      if (!verifiedUser) {
        try {
          const savedUser = localStorage.getItem('cpe_current_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (parsed.studentId === cleanId) {
              verifiedUser = parsed;
            }
          }
        } catch (e) {}
      }

      // 5. Fallback: Demo user account
      if (!verifiedUser && cleanId === '6812345678' && cleanPass === 'password123') {
        verifiedUser = {
          uid: 'demo-6812345678',
          studentId: '6812345678',
          name: 'สมชาย ใจดี (CPE68)',
          email: '6812345678@psru.ac.th'
        };
      }

      // 6. Verification Check: Deny Login if User Not Found!
      if (!verifiedUser) {
        showToast('❌ ไม่พบบัญชีนักศึกษานี้ในระบบ กรุณาสมัครสมาชิกก่อนเข้าสู่ระบบ', 'error');
        return;
      }

      setCurrentUser(verifiedUser);
      localStorage.setItem('cpe_current_user', JSON.stringify(verifiedUser));
      showToast(`ยินดีต้อนรับ ${verifiedUser.name} เข้าสู่ระบบ!`, 'success');
      onClose();
    } catch (err) {
      console.log("Unexpected login error:", err);
      showToast('เกิดข้อผิดพลาดไม่คาดคิดในการเข้าสู่ระบบ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    setAuthErr('');
    if (isSubmitting) return;

    const isTeacher = regYear === 'teacher';
    const name = regName.trim();
    const studentId = regStudentId.trim();
    const phone = regPhone.trim() || '-';
    const email = regEmail.trim() || `${studentId}@psru.ac.th`;
    const pass = regPass.trim();
    const confirmPass = regConfirmPass.trim();

    if (!name) {
      const msg = 'กรุณากรอกชื่อ-นามสกุล';
      setAuthErr(msg);
      showToast(msg, 'error');
      return;
    }
    if (!studentId) {
      const msg = isTeacher ? 'กรุณากรอกรหัสอาจารย์ / รหัสประจำตัว' : 'กรุณากรอกรหัสนักศึกษา';
      setAuthErr(msg);
      showToast(msg, 'error');
      return;
    }
    if (!isTeacher && studentId.length !== 10) {
      const msg = 'กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)';
      setAuthErr(msg);
      showToast(msg, 'error');
      return;
    }
    if (pass.length < 6) {
      const msg = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
      setAuthErr(msg);
      showToast(msg, 'error');
      return;
    }
    if (pass !== confirmPass) {
      const msg = 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน';
      setAuthErr(msg);
      showToast(msg, 'error');
      return;
    }

    const fb = window.CPEFirebase;
    setIsSubmitting(true);

    try {
      let finalUid = 'user-' + Date.now();
      const authEmail = email.includes('@') ? email : `${studentId}@psru.ac.th`;

      if (fb && fb.auth && fb.createUserWithEmailAndPassword) {
        try {
          const res = await withTimeout(fb.createUserWithEmailAndPassword(fb.auth, authEmail, pass), 5000);
          if (res && res.user) {
            finalUid = res.user.uid;
          }
        } catch (err) {
          console.log("Firebase Register Auth attempt:", err);
          if (err.code === 'auth/email-already-in-use' && fb.signInWithEmailAndPassword) {
            try {
              const loginRes = await withTimeout(fb.signInWithEmailAndPassword(fb.auth, authEmail, pass), 3000);
              if (loginRes && loginRes.user) {
                finalUid = loginRes.user.uid;
              }
            } catch (loginErr) {
              console.log("Firebase Auth login fallback error:", loginErr);
            }
          }
        }
      }

      // Prepare User Data
      const userData = {
        uid: finalUid,
        studentId: studentId,
        name: name,
        nickname: regNickname.trim() || name,
        year: regYear,
        role: isTeacher ? 'teacher' : 'student',
        phone: phone,
        email: authEmail,
        createdAt: new Date().toISOString()
      };
      
      // Save user profile to Firestore in background
      if (fb && fb.db && fb.setDoc && fb.doc) {
        fb.setDoc(fb.doc(fb.db, 'users', finalUid), userData).catch(docErr => {
          console.log("Firestore Doc Write Error:", docErr);
        });
      }
      
      localStorage.setItem('cpe_current_user', JSON.stringify(userData));
      setCurrentUser(userData);
      showToast('สมัครสมาชิกสำเร็จ! เข้าสู่ระบบอัตโนมัติ', 'success');
      onClose();
    } catch (unexpectedErr) {
      console.log("Unexpected Register Error:", unexpectedErr);
      showToast('เกิดข้อผิดพลาดไม่คาดคิด กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop show" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1, pointerEvents: 'auto', padding: '16px' }}>
      <div className="modal-card auth-modal-card" onClick={e => e.stopPropagation()} style={{ position: 'relative', zIndex: 10000, background: '#10121a', border: '1px solid var(--border-gold)', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', opacity: 1, visibility: 'visible' }}>
        <button className="close-btn auth-close-btn" onClick={onClose}>&times;</button>
        
        {/* CPE PORTAL BRANDING */}
        <div className="auth-card-branding">
          <h2 className="auth-brand-title">CPE PORTAL</h2>
          <span className="auth-brand-sub">Create and Develop By Peeranart Singto</span>
        </div>

        <div className="modal-body auth-modal-body" style={{ padding: 0 }}>
          
          {/* Segmented Tab Switcher Bar */}
          <div className="auth-tab-bar">
            <button 
              className={`auth-tab-item ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => switchTab('login')}
            >
              เข้าสู่ระบบ
            </button>
            <button 
              className={`auth-tab-item ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => switchTab('register')}
            >
              สมัครสมาชิก
            </button>
          </div>

          {/* LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-form active" noValidate>


              <div className="form-group">
                <label>รหัสนักศึกษา (10 หลัก)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="6812345678"
                  maxLength={10}
                  value={loginId}
                  onChange={e => setLoginId(e.target.value.replace(/\D/g, ''))}
                  required 
                />
              </div>

              <div className="form-group">
                <label>รหัสผ่าน</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" onClick={handleLoginSubmit} className="btn-auth-submit" disabled={isSubmitting}>
                {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'LOGIN'}
              </button>

              <div className="auth-footer-prompt">
                ยังไม่มีบัญชี? <span className="auth-switch-link" onClick={() => setActiveTab('register')}>สมัครสมาชิกที่นี่</span>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="auth-form active" noValidate>
              <div className="form-group">
                <label>ชื่อ-นามสกุล <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="นายสมชาย ใจดี"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{regYear === 'teacher' ? 'รหัสอาจารย์ / รหัสประจำตัว' : 'รหัสนักศึกษา (10 หลัก)'} <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder={regYear === 'teacher' ? "เช่น T12345" : "6812345678"}
                    maxLength={regYear === 'teacher' ? 20 : 10}
                    value={regStudentId}
                    onChange={e => setRegStudentId(regYear === 'teacher' ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>ชั้นปี / สถานะ <span style={{ color: '#ef4444' }}>*</span></label>
                  <select 
                    className="form-input" 
                    style={{ height: '44px' }}
                    value={regYear}
                    onChange={e => setRegYear(e.target.value)}
                  >
                    <option value="1">ปี 1 (CPE69)</option>
                    <option value="2">ปี 2 (CPE68)</option>
                    <option value="3">ปี 3 (CPE67)</option>
                    <option value="teacher">อาจารย์ / บุคลากร 👨‍🏫</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>ชื่อเล่น (สำหรับปัก)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="ต้อม"
                    value={regNickname}
                    onChange={e => setRegNickname(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>เบอร์โทรศัพท์ (ระบุหรือไม่ก็ได้)</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="0812345678 (ว่างไว้ได้)"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>อีเมล (ระบุหรือไม่ก็ได้)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="เช่น student@psru.ac.th (ว่างไว้ได้)"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>กำหนดรหัสผ่าน <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={regPass}
                    onChange={e => setRegPass(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>ยืนยันรหัสผ่าน <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="พิมพ์อีกครั้ง"
                    value={regConfirmPass}
                    onChange={e => setRegConfirmPass(e.target.value)}
                    required 
                  />
                </div>
              </div>

              {authErr && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.88rem' }}>
                  ⚠️ {authErr}
                </div>
              )}

              <button type="submit" onClick={handleRegisterSubmit} className="btn-auth-submit" disabled={isSubmitting}>
                {isSubmitting ? 'กำลังสมัครสมาชิก...' : 'REGISTER'}
              </button>

              <div className="auth-footer-prompt">
                มีบัญชีอยู่แล้ว? <span className="auth-switch-link" onClick={() => setActiveTab('login')}>เข้าสู่ระบบที่นี่</span>
              </div>
            </form>
          )}

          <div className="auth-card-footer">
            Powered By Computer Engineering 68 &amp; 69 PSRU
          </div>

        </div>
      </div>
    </div>
  );
}

// 7. CHECKOUT MODAL COMPONENT (Firestore Submission & Local Persistence)
function CheckoutModal({ isOpen, onClose, cart, setCart, setTrackedOrder, setMyOrdersHistory, setSearchTrackingQuery, isExpired }) {
  const { currentUser, showToast } = useContext(AuthContext);
  const [checkoutName, setCheckoutName] = useState(currentUser?.name || '');
  const [checkoutStudentId, setCheckoutStudentId] = useState(currentUser?.studentId || '');
  const [checkoutPhone, setCheckoutPhone] = useState(currentUser?.phone || '');
  const [slipFile, setSlipFile] = useState(null);
  const [slipDataUrl, setSlipDataUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingOrder, setHasExistingOrder] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);

  const [userRoleType, setUserRoleType] = useState(() => (currentUser?.role === 'teacher' || currentUser?.year === 'teacher' || currentUser?.year === 'อาจารย์ / บุคลากร' || currentUser?.studentId?.toUpperCase()?.startsWith('T')) ? 'teacher' : 'student');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setCheckoutName(currentUser.name);
      if (currentUser.studentId) setCheckoutStudentId(currentUser.studentId);
      if (currentUser.phone) setCheckoutPhone(currentUser.phone);
      if (currentUser.role === 'teacher' || currentUser.year === 'teacher' || currentUser.year === 'อาจารย์ / บุคลากร' || currentUser.studentId?.toUpperCase()?.startsWith('T')) {
        setUserRoleType('teacher');
      }
    }
  }, [currentUser]);

  // Check if studentId already has an existing order
  const checkExistingOrder = async (sid) => {
    if (!sid || sid.length < 8) { setHasExistingOrder(false); return; }
    setCheckingExisting(true);
    try {
      const fb = window.CPEFirebase || {};
      if (fb.db && fb.collection && fb.query && fb.where && fb.getDocs) {
        const q = fb.query(fb.collection(fb.db, 'orders'), fb.where('studentId', '==', sid));
        const snap = await fb.getDocs(q);
        setHasExistingOrder(!snap.empty);
      }
    } catch (e) { console.log('Check existing order error:', e); }
    setCheckingExisting(false);
  };

  useEffect(() => {
    if (checkoutStudentId.length === 10) checkExistingOrder(checkoutStudentId);
    else setHasExistingOrder(false);
  }, [checkoutStudentId]);

  if (!isOpen) return null;

  const isTeacher = userRoleType === 'teacher' || checkoutStudentId.toUpperCase().startsWith('T');
  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const orderId = 'CPE-2026-' + Math.floor(1000 + Math.random() * 9000);

  const promptPayNumber = '0923637199';
  const fullQrPayload = generatePromptPayPayload(promptPayNumber, totalAmount);
  const fullQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullQrPayload)}`;
  const fallbackFullQrUrl = `https://promptpay.io/${promptPayNumber}/${totalAmount}.png`;

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSlipFile(file);
      // Compress image via canvas to avoid Firestore 1MB doc limit
      const img = new Image();
      const reader = new FileReader();
      reader.onloadend = () => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let w = img.width, h = img.height;
          if (w > h && w > MAX_SIZE) { h = h * MAX_SIZE / w; w = MAX_SIZE; }
          else if (h > MAX_SIZE) { w = w * MAX_SIZE / h; h = MAX_SIZE; }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.6);
          setSlipDataUrl(compressed);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (isExpired) {
      showToast('🚫 ระบบปิดรับการสั่งซื้อเสื้อแล้ว (หมดเวลาสั่งจองเมื่อ 14:40 น.)', 'error');
      return;
    }
    if (!checkoutName || !checkoutStudentId || (!isTeacher && checkoutStudentId.length !== 10) || !checkoutPhone) {
      showToast(isTeacher ? 'กรุณากรอกข้อมูลและรหัสอาจารย์/รหัสประจำตัวให้ครบถ้วน' : 'กรุณากรอกข้อมูลและรหัสนักศึกษา 10 หลักให้ครบถ้วน', 'error');
      return;
    }
    if (!slipDataUrl) {
      showToast('กรุณาอัพโหลดสลิปการโอนเงินก่อนดำเนินการ', 'error');
      return;
    }

    setIsSubmitting(true);

    const depositAmount = totalAmount;
    const remainingAmount = 0;
    const newOrder = {
      id: orderId,
      userUid: currentUser?.uid || null,
      studentId: checkoutStudentId,
      name: checkoutName,
      phone: checkoutPhone,
      items: cart,
      total: totalAmount,
      deposit: depositAmount,
      remaining: 0,
      remainingPaidStatus: 'approved',
      isTeacher: isTeacher,
      role: isTeacher ? 'teacher' : 'student',
      status: 'pending', // pending -> paid -> preparing -> shipping -> completed
      date: (() => {
        try {
          return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
        } catch (e) {
          return new Date(Date.now() + 25200000).toISOString().replace('T', ' ').substring(0, 16);
        }
      })(),
      trackingNumber: 'TH' + Math.floor(1000000000 + Math.random() * 9000000000),
      slipUrl: slipDataUrl || null
    };

    const fb = window.CPEFirebase;

    try {
      if (fb && fb.db && fb.addDoc && fb.collection) {
        const docRef = await fb.addDoc(fb.collection(fb.db, 'orders'), newOrder);
        newOrder.firestoreId = docRef.id;
        showToast(`บันทึกคำสั่งซื้อ ${orderId} ลงบน Firebase Firestore เรียบร้อยแล้ว!`, 'success');
      } else {
        showToast(`สร้างคำสั่งซื้อ ${orderId} เรียบร้อยแล้ว!`, 'success');
      }
    } catch (err) {
      console.log("Firestore order save:", err);
      showToast(`สร้างคำสั่งซื้อ ${orderId} เรียบร้อยแล้ว!`, 'success');
    } finally {
      setIsSubmitting(false);
      if (setMyOrdersHistory) {
        setMyOrdersHistory(prev => [newOrder, ...prev]);
      }
      setTrackedOrder(newOrder);
      if (setSearchTrackingQuery) {
        setSearchTrackingQuery(newOrder.id);
      }
      setCart([]);
      // Reset slip data after successful submission
      setSlipFile(null);
      setSlipDataUrl(null);
      onClose();
      const trackingSec = document.getElementById('tracking');
      if (trackingSec) trackingSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div 
      className="modal-backdrop show" 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'rgba(0,0,0,0.85)', 
        backdropFilter: 'blur(8px)', 
        zIndex: 99999, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        opacity: 1, 
        pointerEvents: 'auto', 
        padding: '16px' 
      }}
    >
      <div 
        className="modal-card lg" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          position: 'relative', 
          zIndex: 100000, 
          background: '#10121a', 
          border: '1px solid var(--border-gold)', 
          borderRadius: '16px', 
          width: '100%', 
          maxWidth: '780px', 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          opacity: 1, 
          visibility: 'visible', 
          boxShadow: '0 25px 70px rgba(0,0,0,0.95)',
          margin: 'auto'
        }}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 20px' }}>
          <h3 className="modal-title" style={{ color: 'var(--accent-gold-bright)', fontSize: '1.2rem' }}>
            💳 ชำระเงินเต็มจำนวน ฿{totalAmount.toLocaleString()} (สแกน PromptPay QR Code)
          </h3>
          <button className="close-btn" onClick={onClose} style={{ color: '#fff', fontSize: '1.8rem' }}>&times;</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <form onSubmit={handleSubmitOrder}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              
              {/* Left: PromptPay QR Code */}
              <div style={{ flex: '1 1 300px' }}>
                <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '10px' }}>
                  1. สแกน QR Code ชำระเงินเต็มจำนวน (0923637199)
                </h4>
                <div style={{ background: '#fff', padding: '14px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.5)' }}>
                  <div>
                    <div style={{ background: '#003b64', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>
                      PROMPTPAY | พร้อมเพย์ 0923637199
                    </div>
                    <img 
                      src={fullQrUrl}
                      onError={(e) => { e.target.src = fallbackFullQrUrl; }}
                      alt={`PromptPay QR Code ชำระเต็มจำนวน ฿${totalAmount}`}
                      style={{ width: '100%', maxWidth: '240px', height: 'auto', margin: '0 auto', display: 'block', borderRadius: '8px' }}
                    />
                  </div>
                  <div style={{ background: '#0f1017', border: '1px solid #22c55e', borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                    <p style={{ color: '#22c55e', fontWeight: '700', fontSize: '1.4rem', margin: 0 }}>
                      💰 ยอดชำระเงินเต็มจำนวน: ฿{totalAmount.toLocaleString()}
                    </p>
                    <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: '4px', margin: 0 }}>
                      ชำระเงินครบถ้วน 100% (ไม่มี ยอดค้างชำระ)
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Receiver Info & Slip Upload */}
              <div style={{ flex: '1 1 300px' }}>
                <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '10px' }}>2. ข้อมูลผู้รับเสื้อ &amp; หลักฐาน</h4>
                
                {/* Role Selection */}
                <div className="form-group" style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ color: 'var(--accent-gold-bright)', fontSize: '0.82rem', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>
                    ประเภทการสั่งซื้อ (ชำระเงินเต็มจำนวน 100%)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setUserRoleType('student')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: !isTeacher ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.15)',
                        background: !isTeacher ? 'rgba(34,197,94,0.18)' : '#0a0b10',
                        color: !isTeacher ? '#22c55e' : '#94a3b8',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.82rem'
                      }}
                    >
                      👨‍🎓 นักศึกษา (ชำระเต็ม)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserRoleType('teacher')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: isTeacher ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                        background: isTeacher ? 'rgba(56,189,248,0.18)' : '#0a0b10',
                        color: isTeacher ? '#38bdf8' : '#94a3b8',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.82rem'
                      }}
                    >
                      👨‍🏫 อาจารย์ (ชำระเต็ม)
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ color: '#fff' }}>ชื่อ-นามสกุล ผู้สั่งซื้อ</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={checkoutName}
                    onChange={e => setCheckoutName(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ color: '#fff' }}>{isTeacher ? 'รหัสอาจารย์ / รหัสประจำตัว' : 'รหัสนักศึกษา (10 หลัก)'}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    maxLength={isTeacher ? 20 : 10}
                    placeholder={isTeacher ? "เช่น T12345" : "6812345678"}
                    value={checkoutStudentId}
                    onChange={e => setCheckoutStudentId(isTeacher ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ color: '#fff' }}>เบอร์โทรศัพท์ติดต่อ</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    value={checkoutPhone}
                    onChange={e => setCheckoutPhone(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                    แนบสลิปชำระเงินเต็มจำนวน ฿{totalAmount.toLocaleString()}
                  </label>
                  <label 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '8px',
                      padding: slipDataUrl ? '12px' : '24px 16px', 
                      border: slipDataUrl ? '2px solid #22c55e' : '2px dashed rgba(234,179,8,0.4)', 
                      borderRadius: '12px', 
                      background: slipDataUrl ? 'rgba(34,197,94,0.06)' : 'rgba(234,179,8,0.04)', 
                      cursor: 'pointer', 
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = slipDataUrl ? '#22c55e' : '#eab308'; e.currentTarget.style.background = slipDataUrl ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = slipDataUrl ? '#22c55e' : 'rgba(234,179,8,0.4)'; e.currentTarget.style.background = slipDataUrl ? 'rgba(34,197,94,0.06)' : 'rgba(234,179,8,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSlipChange}
                      style={{ display: 'none' }}
                    />
                    {slipDataUrl ? (
                      <>
                        <div style={{ fontSize: '2rem' }}>✅</div>
                        <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.9rem' }}>แนบสลิปเรียบร้อยแล้ว!</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>แตะเพื่อเปลี่ยนไฟล์</span>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '2.2rem' }}>📎</div>
                        <span style={{ color: '#eab308', fontWeight: '600', fontSize: '0.9rem' }}>แตะเพื่ออัปโหลดสลิป</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>รองรับ JPG, PNG, HEIC</span>
                      </>
                    )}
                  </label>
                </div>

                <button type="submit" className="btn btn-gold" style={{ width: '100%', padding: '12px', fontWeight: 'bold' }} disabled={isSubmitting}>
                  {isSubmitting ? '⏳ กำลังบันทึกคำสั่งซื้อ...' : `🚀 ยืนยันการสั่งซื้อและชำระเงินเต็มจำนวน ฿${totalAmount.toLocaleString()}`}
                </button>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 8. SIZE GUIDE MODAL COMPONENT
function SizeGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop show">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">ตารางขนาดเสื้อ (Size Guide)</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            ขนาดรอบอก (นิ้ว) และความยาวตัวเสื้อ (นิ้ว) สำหรับทรงเสื้อโปโล &amp; เสื้อคลุม CPE 69
          </p>

          <h4 style={{ color: 'var(--accent-gold)', marginTop: '12px', fontSize: '0.95rem' }}>1. เสื้อโปโลสาขา CPE (Polo Shirt) - ฿350</h4>
          <table className="size-table">
            <thead>
              <tr>
                <th>ไซส์ (Size)</th>
                <th>รอบอก (นิ้ว)</th>
                <th>ความยาว (นิ้ว)</th>
                <th>ราคา</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>SS - 4XL</strong></td><td>34" - 48"</td><td>25" - 32"</td><td>350 บาท</td></tr>
              <tr><td><strong>5XL ขึ้นไป</strong> <span style={{ fontSize: '0.75rem', color: '#F5D061' }}>(+250฿)</span></td><td>50" ขึ้นไป</td><td>33" ขึ้นไป</td><td><strong style={{ color: '#F5D061' }}>600 บาท</strong></td></tr>
            </tbody>
          </table>

          <h4 style={{ color: 'var(--accent-gold)', marginTop: '20px', fontSize: '0.95rem' }}>2. เสื้อคลุมสาขา CPE 69 (Jacket) - ฿920</h4>
          <table className="size-table">
            <thead>
              <tr>
                <th>ไซส์ (Size)</th>
                <th>รอบอก (นิ้ว)</th>
                <th>ความยาว (นิ้ว)</th>
                <th>ราคา (น้อง 69)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>SS - 2XL</strong></td><td>36" - 46"</td><td>26" - 31"</td><td>920 บาท</td></tr>
              <tr><td><strong>3XL - 4XL</strong> <span style={{ fontSize: '0.75rem', color: '#F5D061' }}>(+100฿)</span></td><td>48" - 50"</td><td>32" - 33"</td><td><strong style={{ color: '#F5D061' }}>1,020 บาท</strong></td></tr>
            </tbody>
          </table>

          <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid var(--border-gold)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--accent-gold-bright)', marginTop: '15px' }}>
            💡 คำแนะนำ: เสื้อโปโล SS - 4XL ราคา 350฿ / ไซส์ 5XL ขึ้นไป ราคา 600฿ (+250฿)
          </div>
        </div>
      </div>
    </div>
  );
}

// EXTRA DEPOSIT MODAL (ระบบจ่ายมัดจำเพิ่ม 100 บาท)
function ExtraDepositModal({ isOpen, onClose, showToast }) {
  const { currentUser, setIsAuthModalOpen } = useContext(AuthContext);
  const [studentId, setStudentId] = useState(currentUser?.studentId || '');
  const [foundOrders, setFoundOrders] = useState([]);
  const [searching, setSearching] = useState(false);
  const [slipDataUrl, setSlipDataUrl] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  // Local cache of extra deposits for duplicate payment guard
  const [extraDepositsList, setExtraDepositsList] = useState([]);

  const handleSearchWithId = async (sid) => {
    const searchTarget = sid || studentId;
    if (!searchTarget || searchTarget.length < 8) {
      showToast('กรุณากรอกรหัสนักศึกษา 8-10 หลัก', 'error');
      return;
    }
    setSearching(true);
    setFoundOrders([]);
    try {
      const fb = window.CPEFirebase || {};
      if (fb.db && fb.collection && fb.query && fb.where && fb.getDocs) {
        // Query orders for the given student ID
        const q = fb.query(fb.collection(fb.db, 'orders'), fb.where('studentId', '==', searchTarget));
        const snap = await fb.getDocs(q);
        const results = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        setFoundOrders(results);
        if (results.length === 0) {
          showToast('ไม่พบออเดอร์ในระบบ ตรวจสอบรหัสอีกครั้ง', 'error');
          setAlreadyPaid(false);
        } else {
          const firstId = results[0].id || results[0].firestoreId;
          setSelectedOrderId(firstId);
          const orderIds = results.map(o => o.id || o.firestoreId);
          // Fetch all extra deposits (could be optimized with a query) and filter
          if (fb.collection && fb.getDocs) {
            const depSnap = await fb.getDocs(fb.collection(fb.db, 'extra_deposits'));
            const depList = [];
            depSnap.forEach(d => depList.push({ id: d.id, ...d.data() }));
            setExtraDepositsList(depList);
            const hasPaid = depList.some(ed => orderIds.includes(ed.orderRef) && ed.status === 'verified');
            setAlreadyPaid(hasPaid);
            if (hasPaid) {
              showToast('คุณได้จ่ายมัดจำเพิ่มแล้วสำหรับออเดอร์นี้', 'warning');
            }
          } else {
            // Fallback if extra deposits collection not available
            setAlreadyPaid(false);
          }
        }
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
    }
    setSearching(false);
  };

  useEffect(() => {
    if (isOpen && currentUser?.studentId) {
      setStudentId(currentUser.studentId);
      handleSearchWithId(currentUser.studentId);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  if (!currentUser) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#10121a', border: '1px solid #d4af37', borderRadius: '20px', width: '100%', maxWidth: '480px', padding: '28px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.95)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
          <h3 style={{ color: '#f5d061', marginBottom: '10px', fontSize: '1.2rem' }}>กรุณาเข้าสู่ระบบก่อนดำเนินการ</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '24px', lineHeight: '1.5' }}>
            คุณต้องเข้าสู่ระบบสมาชิก CPE PORTAL ก่อน เพื่อใช้งานหน้าจ่ายมัดจำเพิ่ม
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              onClick={() => { onClose(); setIsAuthModalOpen(true); }}
              style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #f5d061, #d4af37)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              เข้าสู่ระบบ / สมัครสมาชิก
            </button>
            <button 
              onClick={onClose}
              style={{ padding: '10px 18px', background: '#18181b', color: '#aaa', border: '1px solid #333', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSearch = () => handleSearchWithId(studentId);

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onloadend = () => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800; let w = img.width, h = img.height;
        if (w > h && w > MAX) { h = h * MAX / w; w = MAX; }
        else if (h > MAX) { w = w * MAX / h; h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setSlipDataUrl(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (alreadyPaid) {
      showToast('คุณได้จ่ายมัดจำเพิ่มแล้วสำหรับออเดอร์นี้', 'error');
      return;
    }
    if (!selectedOrderId) {
      showToast('กรุณาเลือกออเดอร์และอัพโหลดสลิปให้ครบถ้วนก่อน', 'error');
      return;
    }
    if (!slipDataUrl) {
      showToast('กรุณาอัพโหลดสลิปการโอนเงินก่อน', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const fb = window.CPEFirebase || {};
      if (fb.db && fb.addDoc && fb.collection) {
        await fb.addDoc(fb.collection(fb.db, 'extra_deposits'), {
          studentId,
          orderRef: selectedOrderId,
          slipUrl: slipDataUrl,
          amount: 100,
          status: 'pending',
          date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
        });
        setSubmitted(true);
        showToast('✅ ส่งหลักฐานมัดจำเพิ่มเรียบร้อยแล้ว รอแอดมินยืนยัน!', 'success');
      }
    } catch (err) {
      console.log('Extra deposit error:', err);
      showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error');
    }
    setIsSubmitting(false);
  };



  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#10121a', border: '1px solid #d4af37', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.95)' }}>
        
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1b0a0e, #0a0b10)', borderBottom: '1px solid #d4af37', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: '#f5d061', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>💳 จ่ายมัดจำเพิ่ม 100 บาท</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '3px 0 0' }}>สำหรับคนที่มีออเดอร์เดิมอยู่แล้ว (ไม่เกี่ยวกับการสั่งเสื้อใหม่)</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ padding: '24px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
              <h3 style={{ color: '#22c55e', marginBottom: '8px' }}>ส่งหลักฐานเรียบร้อยแล้ว!</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>รอแอดมินยืนยันสลิปของคุณ หากเรียบร้อยแล้วจะอัปเดตสถานะให้ทันที</p>
              <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 32px', background: 'linear-gradient(135deg, #f5d061, #d4af37)', color: '#000', border: 'none', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}>ปิดหน้าต่าง</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Step 1: Search */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#f5d061', fontSize: '0.95rem', marginBottom: '10px' }}>1. ค้นหาออเดอร์ของคุณ</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="รหัสนักศึกษา 10 หลัก"
                    value={studentId}
                    maxLength={10}
                    onChange={e => setStudentId(e.target.value.replace(/\D/g, ''))}
                    style={{ flex: 1, padding: '10px 14px', background: '#18181b', border: '1px solid #d4af37', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  />
                  <button type="button" onClick={handleSearch} disabled={searching} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #f5d061, #d4af37)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {searching ? 'ค้นหา...' : '🔍 ค้นหา'}
                  </button>
                </div>
                {foundOrders.length > 0 && (
                  <div style={{ marginTop: '12px', background: '#0a0b10', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px' }}>พบ {foundOrders.length} ออเดอร์ — เลือกออเดอร์ที่ต้องการจ่ายมัดจำเพิ่ม:</p>
                    {foundOrders.map(o => (
                      <label key={o.firestoreId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '6px', background: selectedOrderId === (o.id || o.firestoreId) ? 'rgba(245,208,97,0.1)' : 'transparent', cursor: 'pointer', marginBottom: '4px' }}>
                        <input type="radio" name="orderSelect" value={o.id || o.firestoreId} checked={selectedOrderId === (o.id || o.firestoreId)} onChange={() => setSelectedOrderId(o.id || o.firestoreId)} />
                        <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                          <strong style={{ color: '#f5d061' }}>{o.id || o.firestoreId}</strong>
                          {' — '}{o.name} | ยอดรวม ฿{(o.total || 0).toLocaleString()} | สถานะ: {o.status}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: QR Code */}
              {foundOrders.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#f5d061', fontSize: '0.95rem', marginBottom: '10px' }}>2. สแกน QR Code โอนมัดจำเพิ่ม 100 บาท</h4>
                  <div style={{ background: '#fff', padding: '14px', borderRadius: '12px', textAlign: 'center', maxWidth: '240px', margin: '0 auto' }}>
                    <img src="assets/extra_deposit_qr.png" alt="QR Code มัดจำเพิ่ม 100 บาท" style={{ width: '100%', borderRadius: '6px' }} />
                    <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.2rem', margin: '10px 0 0' }}>฿100 บาท เท่านั้น</p>
                  </div>
                </div>
              )}


              {/* Step 3: Upload Slip (Luxury Custom Dropzone) */}
              {foundOrders.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#f5d061', fontSize: '0.95rem', marginBottom: '10px' }}>3. อัพโหลดสลิปการโอน 100 บาท</h4>
                  <label 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '8px',
                      padding: slipDataUrl ? '16px' : '28px 16px', 
                      border: slipDataUrl ? '2px solid #22c55e' : '2px dashed #f5d061', 
                      borderRadius: '12px', 
                      background: slipDataUrl ? 'rgba(34,197,94,0.08)' : 'rgba(245,208,97,0.05)', 
                      cursor: 'pointer', 
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = slipDataUrl ? '#22c55e' : '#f5d061'; e.currentTarget.style.background = slipDataUrl ? 'rgba(34,197,94,0.12)' : 'rgba(245,208,97,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = slipDataUrl ? '#22c55e' : 'rgba(245,208,97,0.4)'; e.currentTarget.style.background = slipDataUrl ? 'rgba(34,197,94,0.08)' : 'rgba(245,208,97,0.05)'; }}
                  >
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSlipChange} 
                      style={{ display: 'none' }} 
                    />
                    {slipDataUrl ? (
                      <>
                        <div style={{ fontSize: '2.2rem' }}>✅</div>
                        <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '0.95rem' }}>แนบสลิปการโอนเรียบร้อยแล้ว!</span>
                        <img src={slipDataUrl} alt="สลิป" style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '8px', border: '1px solid #22c55e', marginTop: '6px' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>แตะที่นี่เพื่อเปลี่ยนไฟล์สลิป</span>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '2.5rem' }}>📎</div>
                        <span style={{ color: '#f5d061', fontWeight: '700', fontSize: '0.95rem' }}>แตะที่นี่เพื่อเลือกไฟล์สลิปการโอน</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>รองรับไฟล์รูปภาพ JPG, PNG, HEIC</span>
                      </>
                    )}
                  </label>
                </div>
              )}

              {foundOrders.length > 0 && (
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  style={{ 
                    width: '100%', 
                    padding: '16px', 
                    background: (!slipDataUrl || !selectedOrderId) ? 'linear-gradient(135deg, #d4af37, #f5d061)' : 'linear-gradient(135deg, #22c55e, #16a34a)', 
                    color: (!slipDataUrl || !selectedOrderId) ? '#000' : '#fff', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontSize: '1rem', 
                    fontWeight: 800, 
                    cursor: 'pointer', 
                    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  {isSubmitting ? '⏳ กำลังส่งหลักฐาน...' : '💳 ยืนยันการจ่ายมัดจำเพิ่ม 100 บาท'}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PayRemainingModal Component - Dynamic PromptPay QR Code Payment for Remaining Balance
 * Target PromptPay: 0923637199
 */
function PayRemainingModal({ isOpen, onClose, initialOrder, showToast }) {
  const [studentId, setStudentId] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundOrders, setFoundOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  useEffect(() => {
    if (initialOrder) {
      setSelectedOrder(initialOrder);
      if (initialOrder.studentId) setStudentId(initialOrder.studentId);
    } else {
      setSelectedOrder(null);
      setFoundOrders([]);
      setSlipFile(null);
      setSlipPreview(null);
      setSubmitted(false);
    }
  }, [isOpen, initialOrder]);

  if (!isOpen) return null;

  const handleSearch = async () => {
    const queryStr = studentId.trim();
    if (!queryStr) {
      showToast('กรุณากรอกรหัสนักศึกษา หรือเลขที่ออเดอร์', 'error');
      return;
    }
    setSearching(true);
    try {
      const fb = window.CPEFirebase || {};
      if (!fb.db || !fb.collection) return;
      const ordersRef = fb.collection(fb.db, 'orders');
      
      let q = fb.query(ordersRef, fb.where('studentId', '==', queryStr));
      let snap = await fb.getDocs(q);
      
      if (snap.empty) {
        q = fb.query(ordersRef, fb.where('id', '==', queryStr));
        snap = await fb.getDocs(q);
      }

      if (!snap.empty) {
        const list = [];
        snap.forEach(d => list.push({ firestoreId: d.id, ...d.data() }));
        setFoundOrders(list);
        setSelectedOrder(list[0]);
        showToast(`พบข้อมูลออเดอร์ ${list.length} รายการ`, 'success');
      } else {
        setFoundOrders([]);
        setSelectedOrder(null);
        showToast('ไม่พบข้อมูลออเดอร์สำหรับรหัสที่ระบุ', 'error');
      }
    } catch (e) {
      console.log('Search remaining error:', e);
      showToast('ค้นหาล้มเหลว', 'error');
    } finally {
      setSearching(false);
    }
  };

  const calcRemaining = (ord) => {
    if (!ord) return 0;
    if (ord.remainingPaidStatus === 'approved') return 0;
    const total = getOrderTotal(ord);
    const deposit = typeof ord.deposit === 'number' ? ord.deposit : 0;
    return Math.max(0, total - deposit);
  };

  const currentRemaining = calcRemaining(selectedOrder);
  const promptPayNumber = '0923637199';
  const qrPayload = generatePromptPayPayload(promptPayNumber, currentRemaining);
  const primaryQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
  const fallbackQrUrl = `https://promptpay.io/${promptPayNumber}/${currentRemaining}.png`;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setSlipPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(promptPayNumber);
    setCopiedAccount(true);
    showToast('คัดลอกเลขพร้อมเพย์เรียบร้อยแล้ว!', 'success');
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(String(currentRemaining));
    setCopiedAmount(true);
    showToast(`คัดลอกยอดเงิน ฿${currentRemaining.toLocaleString()} เรียบร้อยแล้ว!`, 'success');
    setTimeout(() => setCopiedAmount(false), 2500);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedOrder || !selectedOrder.firestoreId) {
      showToast('กรุณาเลือกออเดอร์ก่อนชำระเงิน', 'error');
      return;
    }
    if (!slipPreview) {
      showToast('กรุณาอัปโหลดสลิปหลักฐานการชำระเงินส่วนที่เหลือ', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fb = window.CPEFirebase || {};
      if (fb.db && fb.doc && fb.updateDoc) {
        await fb.updateDoc(fb.doc(fb.db, 'orders', selectedOrder.firestoreId), {
          remainingPaidStatus: 'pending_verification',
          remainingSlipUrl: slipPreview,
          remainingAmountPaid: currentRemaining,
          remainingSubmittedAt: new Date().toISOString()
        });
      } else if (fb.db && fb.doc && fb.setDoc) {
        await fb.setDoc(fb.doc(fb.db, 'orders', selectedOrder.firestoreId), {
          remainingPaidStatus: 'pending_verification',
          remainingSlipUrl: slipPreview,
          remainingAmountPaid: currentRemaining,
          remainingSubmittedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Log into remaining_payments collection
      if (fb.db && fb.collection && fb.addDoc) {
        await fb.addDoc(fb.collection(fb.db, 'remaining_payments'), {
          orderId: selectedOrder.id || '',
          orderFirestoreId: selectedOrder.firestoreId,
          studentId: selectedOrder.studentId || '',
          name: selectedOrder.name || '',
          remainingAmount: currentRemaining,
          promptPayNumber,
          slipUrl: slipPreview,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }

      setSubmitted(true);
      showToast('✅ แจ้งชำระเงินส่วนที่เหลือเรียบร้อยแล้ว! รอแอนมินตรวจสอบ', 'success');
    } catch (err) {
      console.log("Submit remaining error:", err);
      showToast('ส่งหลักฐานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#10121a', border: '1px solid var(--border-gold)', borderRadius: '20px', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.95)' }}>
        
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1b0a0e, #0a0b10)', borderBottom: '1px solid var(--border-gold)', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: 'var(--accent-gold-bright)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>💳 ชำระเงินส่วนที่เหลือ (PromptPay QR)</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '3px 0 0' }}>สแกน PromptPay QR Code เลข 0923637199 พร้อมยอดเงินอัตโนมัติ</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ padding: '24px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
              <h3 style={{ color: '#22c55e', marginBottom: '8px' }}>ส่งหลักฐานการชำระเงินส่วนที่เหลือเรียบร้อยแล้ว!</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>ระบบบันทึกสลิปเรียบร้อยแล้ว เมื่อแอดมินอนุมัติ สถานะของออเดอร์จะเปลี่ยนเป็นชำระเต็มจำนวนโดยสมบูรณ์</p>
              <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 32px', background: 'linear-gradient(135deg, #f5d061, #d4af37)', color: '#000', border: 'none', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}>ปิดหน้าต่าง</button>
            </div>
          ) : (
            <div>
              {/* Step 1: Order Selector */}
              {!initialOrder && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--accent-gold-bright)', fontSize: '0.95rem', marginBottom: '10px' }}>1. ค้นหาและเลือกออเดอร์ของคุณ</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="กรอกรหัสนักศึกษา หรือเลขที่ออเดอร์..."
                      value={studentId}
                      onChange={e => setStudentId(e.target.value)}
                      style={{ flex: 1, padding: '10px 14px', background: '#18181b', border: '1px solid var(--border-gold)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                    />
                    <button type="button" onClick={handleSearch} disabled={searching} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #f5d061, #d4af37)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {searching ? 'กำลังค้นหา...' : '🔍 ค้นหา'}
                    </button>
                  </div>

                  {foundOrders.length > 0 && (
                    <div style={{ marginTop: '12px', background: '#0a0b10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px' }}>เลือกรายการออเดอร์ที่ต้องการชำระเงินส่วนที่เหลือ:</p>
                      {foundOrders.map(o => (
                        <label key={o.firestoreId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '6px', background: selectedOrder?.firestoreId === o.firestoreId ? 'rgba(245,208,97,0.15)' : 'transparent', cursor: 'pointer', marginBottom: '4px' }}>
                          <input type="radio" name="orderSelectRemaining" value={o.firestoreId} checked={selectedOrder?.firestoreId === o.firestoreId} onChange={() => setSelectedOrder(o)} />
                          <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                            <strong style={{ color: 'var(--accent-gold-bright)' }}>{o.id || o.firestoreId}</strong>
                            {' — '}{o.name} | ยอดรวม ฿{getOrderTotal(o).toLocaleString()} | มัดจำแล้ว ฿{(o.deposit || 0).toLocaleString()} | <span style={{ color: '#eab308', fontWeight: 'bold' }}>ยอดค้าง ฿{calcRemaining(o).toLocaleString()}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Order Info Summary */}
              {selectedOrder && (
                <div style={{ background: 'rgba(245,208,97,0.06)', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '14px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--accent-gold-bright)', fontWeight: 800, fontSize: '1rem' }}>ออเดอร์ #{selectedOrder.id}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>ผู้สั่ง: {selectedOrder.name} ({selectedOrder.studentId})</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>ยอดมัดจำแล้ว: ฿{(selectedOrder.deposit || 50).toLocaleString()}</div>
                      <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.2rem' }}>
                        ยอดชำระส่วนที่เหลือ: ฿{currentRemaining.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Dynamic PromptPay QR Code Display */}
              {selectedOrder && currentRemaining > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: 'var(--accent-gold-bright)', fontSize: '0.95rem', marginBottom: '12px' }}>
                    2. สแกน QR Code พร้อมเพย์ (ระบุยอดเงินอัตโนมัติ ฿{currentRemaining.toLocaleString()})
                  </h4>
                  
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', maxWidth: '300px', margin: '0 auto' }}>
                    {/* PromptPay Header Banner */}
                    <div style={{ background: '#003b64', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.5px' }}>PROMPTPAY | พร้อมเพย์</span>
                    </div>

                    <img 
                      src={primaryQrUrl} 
                      onError={(e) => { e.target.src = fallbackQrUrl; }}
                      alt={`PromptPay QR Code ฿${currentRemaining}`} 
                      style={{ width: '100%', maxWidth: '240px', height: 'auto', borderRadius: '8px', display: 'block', margin: '0 auto' }} 
                    />

                    {/* Amount Tag */}
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>จำนวนเงินที่ต้องชำระส่วนที่เหลือ</span>
                      <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '1.6rem' }}>฿{currentRemaining.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Copy helper buttons */}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                    <button 
                      type="button" 
                      onClick={handleCopyAccount}
                      style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📱 {copiedAccount ? '✓ คัดลอกเบอร์แล้ว' : 'คัดลอกเลขพร้อมเพย์ (0923637199)'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleCopyAmount}
                      style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      💰 {copiedAmount ? '✓ คัดลอกยอดเงินแล้ว' : `คัดลอกยอดเงิน (฿${currentRemaining.toLocaleString()})`}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Slip Upload Dropzone */}
              {selectedOrder && currentRemaining > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: 'var(--accent-gold-bright)', fontSize: '0.95rem', marginBottom: '10px' }}>3. อัปโหลดสลิปหลักฐานการชำระเงินส่วนที่เหลือ</h4>
                  <label 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '24px', 
                      background: slipPreview ? '#0f172a' : 'rgba(255,255,255,0.03)', 
                      border: '2px dashed var(--border-gold)', 
                      borderRadius: '12px', 
                      cursor: 'pointer', 
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    {slipPreview ? (
                      <div>
                        <img src={slipPreview} alt="Slip Preview" style={{ maxHeight: '180px', maxWidth: '100%', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} />
                        <p style={{ color: '#22c55e', fontSize: '0.85rem', margin: 0, fontWeight: 600 }}>✓ อัปโหลดสลิปเรียบร้อยแล้ว (คลิกเพื่อเปลี่ยนรูป)</p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🧾</div>
                        <p style={{ color: '#fff', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>คลิก หรือ ลากสลิปสแกนจ่ายโอนเงินมาวางที่นี่</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '4px', margin: 0 }}>รองรับไฟล์รูปภาพ JPG, PNG, WEBP</p>
                      </div>
                    )}
                  </label>
                </div>
              )}

              {/* Submit Button */}
              {selectedOrder && currentRemaining > 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !slipPreview}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: isSubmitting || !slipPreview ? '#334155' : 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    cursor: isSubmitting || !slipPreview ? 'not-allowed' : 'pointer',
                    boxShadow: isSubmitting || !slipPreview ? 'none' : '0 8px 25px rgba(34,197,94,0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isSubmitting ? '⏳ กำลังบันทึกหลักฐาน...' : `🚀 ยืนยันการส่งหลักฐานชำระเงิน ฿${currentRemaining.toLocaleString()}`}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

let adminCachedOrders = (() => {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('cpe_cached_admin_orders') : null;
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
})();
let adminCachedExtraDeposits = [];
let adminCachedSalesMode = 'auto';
let adminCachedDeadline = '2026-08-08T14:40';

let isGlobalSyncStarted = false;
function initGlobalAdminSync() {
  if (isGlobalSyncStarted) return;
  const fb = window.CPEFirebase || {};
  if (!fb.db || !fb.collection || !fb.onSnapshot) return;

  isGlobalSyncStarted = true;
  try {
    fb.onSnapshot(fb.collection(fb.db, 'orders'), (snap) => {
      let list = [];
      snap.forEach((docSnap) => {
        list.push({ firestoreId: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
      adminCachedOrders = list;
      try {
        localStorage.setItem('cpe_cached_admin_orders', JSON.stringify(list.slice(0, 300)));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('cpe-admin-orders-updated', { detail: list }));
    }, (err) => {
      console.log('Global orders listener error:', err);
    });

    fb.onSnapshot(fb.collection(fb.db, 'extra_deposits'), (snap) => {
      const list = [];
      snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      adminCachedExtraDeposits = list;
      window.dispatchEvent(new CustomEvent('cpe-admin-extra-updated', { detail: list }));
    }, (err) => {
      console.log('Global extra deposits listener error:', err);
    });
  } catch (e) {
    console.log('Global admin sync error:', e);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('cpe-firebase-ready', () => initGlobalAdminSync());
  setTimeout(() => { if (window.CPEFirebase && window.CPEFirebase.db) initGlobalAdminSync(); }, 300);
}

// 9. ADMIN DASHBOARD MODAL COMPONENT (Admin ID: 6800000000)
function AdminDashboardModal({ isOpen, onClose }) {
  const { showToast } = useContext(AuthContext);
  const [orders, setOrders] = useState(adminCachedOrders);
  const [loading, setLoading] = useState(adminCachedOrders.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [previewSlipOrder, setPreviewSlipOrder] = useState(null);
  const [editingTracking, setEditingTracking] = useState({});
  const [activeBreakdownTab, setActiveBreakdownTab] = useState('summary');
  const [salesMode, setSalesMode] = useState('auto');
  const [customDeadline, setCustomDeadline] = useState('2026-08-08T14:40');
  const [savingSettings, setSavingSettings] = useState(false);
  const [extraDeposits, setExtraDeposits] = useState(adminCachedExtraDeposits);

  useEffect(() => {
    if (!isOpen) return;
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.collection || !fb.getDocs) {
      setExtraDeposits([]);
      return;
    }
    const extraDepositsRef = fb.collection(fb.db, 'extra_deposits');
    const fetchExtraDeposits = async () => {
      try {
        const snapshot = await fb.getDocs(extraDepositsRef);
        const list = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
        adminCachedExtraDeposits = list;
        setExtraDeposits(list);
      } catch (e) {
        console.log('Fetch extra deposits error:', e);
      }
    };
    fetchExtraDeposits();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.doc || !fb.onSnapshot) return;

    let unsub = () => {};
    try {
      const settingsRef = fb.doc(fb.db, 'settings', 'order_settings');
      unsub = fb.onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.salesMode) setSalesMode(data.salesMode);
          if (data.customDeadline) setCustomDeadline(data.customDeadline);
        }
      });
    } catch (e) { console.log(e); }
    return () => unsub();
  }, [isOpen]);

  const handleSaveSalesSettings = async (mode = salesMode, deadline = customDeadline) => {
    setSavingSettings(true);
    const fb = window.CPEFirebase || {};
    if (fb.db && fb.doc && fb.setDoc) {
      try {
        await fb.setDoc(fb.doc(fb.db, 'settings', 'order_settings'), {
          salesMode: mode,
          customDeadline: deadline,
          updatedBy: '6800000000',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        showToast('💾 บันทึกการตั้งค่าเวลาเปิด-ปิดการขายเรียบร้อยแล้ว!', 'success');
      } catch (e) {
        console.log("Save settings error:", e);
        showToast('บันทึกการตั้งค่าไม่สำเร็จ', 'error');
      }
    }
    setSavingSettings(false);
  };

  const handleDeleteExtraDeposit = async (depItem) => {
    const sId = depItem.studentId || '';
    const oRef = depItem.orderRef || '';
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการแจ้งโอนมัดจำเพิ่มของ ' + sId + ' (ออเดอร์ ' + oRef + ')?')) return;

    const fb = window.CPEFirebase || {};
    if (!fb.deleteDoc || !fb.doc || !fb.db) return;

    try {
      await fb.deleteDoc(fb.doc(fb.db, 'extra_deposits', depItem.id));

      const updatedExtra = extraDeposits.filter(ed => ed.id !== depItem.id);
      adminCachedExtraDeposits = updatedExtra;
      setExtraDeposits(updatedExtra);

      if (depItem.status === 'verified') {
        const targetOrder = orders.find(o => o.id === depItem.orderRef || o.firestoreId === depItem.orderRef);
        if (targetOrder && targetOrder.firestoreId) {
          const revertedDeposit = Math.max(50, (targetOrder.deposit || 150) - (depItem.amount || 100));
          const revertedRemaining = (targetOrder.total || 0) - revertedDeposit;
          await fb.setDoc(fb.doc(fb.db, 'orders', targetOrder.firestoreId), {
            deposit: revertedDeposit,
            remaining: revertedRemaining
          }, { merge: true });

          const updatedOrders = orders.map(o => 
            o.firestoreId === targetOrder.firestoreId ? { ...o, deposit: revertedDeposit, remaining: revertedRemaining } : o
          );
          adminCachedOrders = updatedOrders;
          setOrders(updatedOrders);
        }
      }

      showToast('🗑️ ลบรายการมัดจำเพิ่มเรียบร้อยแล้ว', 'success');
    } catch (e) {
      console.log('Delete extra deposit error:', e);
      showToast('เกิดข้อผิดพลาดในการลบรายการมัดจำเพิ่ม', 'error');
    }
  };

  const handleVerifyExtraDeposit = async (depItem) => {
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.setDoc || !fb.doc) return;
    try {
      // 1. Mark extra deposit as verified
      await fb.setDoc(fb.doc(fb.db, 'extra_deposits', depItem.id), {
        status: 'verified',
        verifiedAt: new Date().toISOString()
      }, { merge: true });

      const updatedExtra = extraDeposits.map(ed => 
        ed.id === depItem.id ? { ...ed, status: 'verified', verifiedAt: new Date().toISOString() } : ed
      );
      adminCachedExtraDeposits = updatedExtra;
      setExtraDeposits(updatedExtra);

      // 2. Find target order and deduct remaining balance / update deposit
      const targetOrder = orders.find(o => o.id === depItem.orderRef || o.firestoreId === depItem.orderRef);
      if (targetOrder && targetOrder.firestoreId) {
        const newDeposit = (targetOrder.deposit || 50) + (depItem.amount || 100);
        const newRemaining = Math.max(0, (targetOrder.total || 0) - newDeposit);
        await fb.setDoc(fb.doc(fb.db, 'orders', targetOrder.firestoreId), {
          deposit: newDeposit,
          remaining: newRemaining
        }, { merge: true });

        const updatedOrders = orders.map(o => 
          o.firestoreId === targetOrder.firestoreId ? { ...o, deposit: newDeposit, remaining: newRemaining } : o
        );
        adminCachedOrders = updatedOrders;
        setOrders(updatedOrders);

        showToast('✅ ยืนยันสลิปมัดจำเพิ่มแล้ว! อัปเดตยอดมัดจำออเดอร์ ' + targetOrder.id + ' เป็น ฿' + newDeposit + ' (ค้าง ฿' + newRemaining + ')', 'success');
      } else {
        showToast('✅ ยืนยันสลิปมัดจำเพิ่มเรียบร้อยแล้ว!', 'success');
      }
    } catch (e) {
      console.log('Verify extra deposit error:', e);
      showToast('เกิดข้อผิดพลาดในการยืนยันสลิป', 'error');
    }
  };

  const handleVerifyRemainingDeposit = async (orderItem) => {
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.setDoc || !fb.doc || !orderItem.firestoreId) return;
    try {
      const fullDeposit = getOrderTotal(orderItem);

      await fb.setDoc(fb.doc(fb.db, 'orders', orderItem.firestoreId), {
        remainingPaidStatus: 'approved',
        deposit: fullDeposit,
        remaining: 0,
        status: 'completed'
      }, { merge: true });

      const updatedOrders = orders.map(o =>
        o.firestoreId === orderItem.firestoreId ? { ...o, remainingPaidStatus: 'approved', deposit: fullDeposit, remaining: 0, status: 'completed' } : o
      );
      adminCachedOrders = updatedOrders;
      setOrders(updatedOrders);
      showToast(`✅ ยืนยันสลิปชำระส่วนที่เหลือของออเดอร์ ${orderItem.id} เรียบร้อยแล้ว (อัปเดตยอดชำระเป็น ฿${fullDeposit.toLocaleString()})!`, 'success');
    } catch (e) {
      console.log('Verify remaining deposit error:', e);
      showToast('เกิดข้อผิดพลาดในการยืนยันสลิปส่วนที่เหลือ', 'error');
    }
  };

  const handleRejectRemainingDeposit = async (orderItem) => {
    if (!window.confirm(`คุณต้องการปฏิเสธสลิปชำระส่วนที่เหลือของออเดอร์ ${orderItem.id} ใช่หรือไม่?`)) return;
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.setDoc || !fb.doc || !orderItem.firestoreId) return;
    try {
      await fb.setDoc(fb.doc(fb.db, 'orders', orderItem.firestoreId), {
        remainingPaidStatus: 'rejected',
        remainingSlipUrl: null
      }, { merge: true });

      const updatedOrders = orders.map(o =>
        o.firestoreId === orderItem.firestoreId ? { ...o, remainingPaidStatus: 'rejected', remainingSlipUrl: null } : o
      );
      adminCachedOrders = updatedOrders;
      setOrders(updatedOrders);
      showToast(`❌ ปฏิเสธสลิปส่วนที่เหลือของออเดอร์ ${orderItem.id} เรียบร้อยแล้ว`, 'info');
    } catch (e) {
      console.log('Reject remaining deposit error:', e);
      showToast('เกิดข้อผิดพลาดในการปฏิเสธสลิป', 'error');
    }
  };

  const fetchOrdersDirect = async (showNotification = false) => {
    setRefreshing(true);
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.collection || !fb.getDocs) {
      if (showNotification) showToast('ระบบ Firebase กำลังเชื่อมต่อ กรุณาลองอีกครั้งในสักครู่', 'warning');
      setRefreshing(false);
      return;
    }

    try {
      const snap = await fb.getDocs(fb.collection(fb.db, 'orders'));
      let list = [];
      snap.forEach(docSnap => {
        list.push({ firestoreId: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
      
      adminCachedOrders = list;
      setOrders(list);
      try {
        localStorage.setItem('cpe_cached_admin_orders', JSON.stringify(list.slice(0, 300)));
      } catch (e) {}

      if (showNotification) {
        showToast(`⚡ ซิงค์ข้อมูลจาก Firebase สำเร็จทั้งหมด ${list.length} ออเดอร์ (100%)`, 'success');
      }
    } catch (e) {
      console.log('Direct fetch orders error:', e);
      if (showNotification) showToast('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (adminCachedOrders && adminCachedOrders.length > 0) {
      setOrders(adminCachedOrders);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let unsubOrders = () => {};
    let unsubExtra = () => {};
    let isMounted = true;

    const startSubscriptions = () => {
      const fb = window.CPEFirebase || {};
      if (!fb.db || !fb.collection) return false;

      // 1. Direct fetch immediately
      fetchOrdersDirect(false);

      // 2. Realtime listener for Orders
      if (fb.onSnapshot) {
        try {
          unsubOrders = fb.onSnapshot(fb.collection(fb.db, 'orders'), (snap) => {
            if (!isMounted) return;
            let list = [];
            snap.forEach(docSnap => list.push({ firestoreId: docSnap.id, ...docSnap.data() }));
            list.sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
            adminCachedOrders = list;
            setOrders(list);
            setLoading(false);
            try { localStorage.setItem('cpe_cached_admin_orders', JSON.stringify(list.slice(0, 300))); } catch (e) {}
          }, (err) => console.log('Admin orders snapshot error:', err));
        } catch (e) { console.log('Orders snapshot err:', e); }

        // 3. Realtime listener for Extra Deposits
        try {
          unsubExtra = fb.onSnapshot(fb.collection(fb.db, 'extra_deposits'), (snap) => {
            if (!isMounted) return;
            const list = [];
            snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
            adminCachedExtraDeposits = list;
            setExtraDeposits(list);
          }, (err) => console.log('Extra deposits snapshot error:', err));
        } catch (e) { console.log('Extra snapshot err:', e); }
      }

      return true;
    };

    const success = startSubscriptions();
    let checkInterval = null;

    if (!success) {
      checkInterval = setInterval(() => {
        if (window.CPEFirebase && window.CPEFirebase.db) {
          clearInterval(checkInterval);
          startSubscriptions();
        }
      }, 400);

      window.addEventListener('cpe-firebase-ready', startSubscriptions);
    }

    return () => {
      isMounted = false;
      if (checkInterval) clearInterval(checkInterval);
      if (typeof unsubOrders === 'function') unsubOrders();
      if (typeof unsubExtra === 'function') unsubExtra();
      window.removeEventListener('cpe-firebase-ready', startSubscriptions);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStatusChange = async (orderId, newStatus) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setOrders(updated);

    const target = orders.find(o => o.id === orderId);
    const fb = window.CPEFirebase || {};
    if (target && target.firestoreId && fb.setDoc && fb.doc && fb.db) {
      try {
        await fb.setDoc(fb.doc(fb.db, 'orders', target.firestoreId), { ...target, status: newStatus }, { merge: true });
      } catch (e) { console.log("Firestore update:", e); }
    }

    showToast(`อัปเดตสถานะออเดอร์ ${orderId} เป็น "${newStatus}" แล้ว`, 'success');
  };

  const handleDelete = async (orderId) => {
    const target = orders.find(o => o.id === orderId);
    if (!target?.firestoreId) return;
    const fb = window.CPEFirebase || {};
    if (!fb.deleteDoc || !fb.doc || !fb.db) return;
    try {
      await fb.deleteDoc(fb.doc(fb.db, 'orders', target.firestoreId));
      const updated = orders.filter(o => o.id !== orderId);
      setOrders(updated);
      showToast(`ลบออเดอร์ ${orderId} สำเร็จ`, 'success');
    } catch (e) {
      console.log('Delete error:', e);
      showToast('ลบออเดอร์ไม่สำเร็จ', 'error');
    }
  };


  const exportSizeSummaryCSV = () => {
    if (!orders || orders.length === 0) {
      showToast('ไม่มีข้อมูลออเดอร์ในการส่งออก', 'error');
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM for Thai encoding in Excel

    csvContent += "=== ตารางสรุปจำนวนยอดสั่งซื้อแยกตามสินค้าและไซส์ (SIZE SUMMARY MATRIX) ===\n";
    
    const sizeSummary = {};
    const sizeOrder = ['SS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'];

    orders.forEach(o => {
      if (o.items) {
        o.items.forEach(it => {
          const product = it.title || 'ไม่ระบุ';
          const size = it.size || 'ไม่ระบุ';
          const qty = it.qty || 1;

          if (!sizeSummary[product]) sizeSummary[product] = {};
          sizeSummary[product][size] = (sizeSummary[product][size] || 0) + qty;
        });
      }
    });

    const products = Object.keys(sizeSummary);
    const allSizes = [...new Set(products.flatMap(p => Object.keys(sizeSummary[p])))];
    allSizes.sort((a, b) => {
      const ia = sizeOrder.indexOf(a);
      const ib = sizeOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    csvContent += "รายการสินค้า," + allSizes.join(",") + ",รวมทั้งหมด(ตัว)\n";
    products.forEach(p => {
      const rowTotal = allSizes.reduce((sum, s) => sum + (sizeSummary[p][s] || 0), 0);
      const rowValues = allSizes.map(s => sizeSummary[p][s] || 0);
      csvContent += `"${p.replace(/"/g, '""')}",` + rowValues.join(",") + `,${rowTotal}\n`;
    });

    csvContent += "\n\n";
    csvContent += "=== รายรายละเอียดผู้สั่งซื้อและข้อความปักชื่อแยกตามเสื้อและไซส์ (ITEMIZED EMBROIDERY REPORT) ===\n";
    csvContent += "เลขที่ออเดอร์,รหัสนักศึกษา,ชื่อ-นามสกุล,เบอร์โทรศัพท์,รายการสินค้า/สี,ไซส์,จำนวน(ตัว),ข้อความปักชื่อ,ราคา(บาท),สถานะออเดอร์,วันที่สั่งซื้อ\n";

    orders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(it => {
          const row = [
            `"${o.id || ''}"`,
            `"${o.studentId || ''}"`,
            `"${(o.name || '').replace(/"/g, '""')}"`,
            `"${o.phone || ''}"`,
            `"${(it.title || it.name || '').replace(/"/g, '""')}"`,
            `"${it.size || 'L'}"`,
            `"${it.qty || 1}"`,
            `"${(it.customName || 'ไม่ปักชื่อ').replace(/"/g, '""')}"`,
            `"${it.totalPrice || it.price || 350}"`,
            `"${o.status || 'pending'}"`,
            `"${o.date || ''}"`
          ];
          csvContent += row.join(",") + "\n";
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateTag = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `รายงานสรุปไซส์เสื้อและข้อความปัก_CPE_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📥 ดาวน์โหลดรายงานสรุปไซส์ & ข้อความปัก (CSV/Excel) สำเร็จ!', 'success');
  };

  const exportFullyPaidPDF = () => {
    const fullyPaidOrders = orders.filter(o => {
      const calcTotal = getOrderTotal(o);
      return o.remainingPaidStatus === 'approved' ||
             o.isTeacher ||
             o.role === 'teacher' ||
             o.remaining === 0 ||
             (o.deposit && o.deposit >= calcTotal);
    });

    if (!fullyPaidOrders || fullyPaidOrders.length === 0) {
      showToast('ไม่พบรายการผู้ชำระเงินครบถ้วน (100%) ในระบบ', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อเปิดรายงาน PDF', 'error');
      return;
    }

    const todayStr = new Date().toLocaleDateString('th-TH', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const totalRevenue = fullyPaidOrders.reduce((sum, o) => sum + getOrderTotal(o), 0);

    const totalShirts = fullyPaidOrders.reduce((sum, o) => 
      sum + (o.items ? o.items.reduce((s, i) => s + (i.qty || 1), 0) : 1), 0
    );

    const teacherCount = fullyPaidOrders.filter(o => 
      o.isTeacher || o.role === 'teacher' || (o.studentId && o.studentId.toUpperCase().startsWith('T'))
    ).length;

    const studentCount = fullyPaidOrders.length - teacherCount;

    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>รายงานสรุปรายชื่อผู้ชำระเงินครบถ้วนแล้ว (100% Fully Paid)</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
          body { font-family: 'Sarabun', sans-serif; color: #111; background: #fff; padding: 24px; margin: 0; font-size: 13px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 800; color: #15803d; margin: 0 0 4px; }
          .subtitle { font-size: 13px; color: #475569; margin: 0; }
          .meta-info { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 8px; }

          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; text-align: center; }
          .stat-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
          .stat-label { font-size: 11px; color: #64748b; font-weight: 600; }
          .stat-val { font-size: 16px; font-weight: 800; color: #16a34a; margin-top: 2px; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #16a34a; color: #fff; border: 1px solid #15803d; padding: 8px 6px; font-size: 12px; font-weight: 700; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 12px; text-align: center; vertical-align: middle; }
          td.left { text-align: left; }
          td.right { text-align: right; }
          tr:nth-child(even) { background: #f8fafc; }
          
          .badge-teacher { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
          .badge-student { background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }

          .total-row { background: #f0fdf4 !important; font-weight: 800; font-size: 13px; }
          .total-row td { border-top: 2px solid #16a34a; border-bottom: 2px solid #16a34a; }

          .signature-section { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 42%; font-size: 12px; }

          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">🎓 รายงานสรุปรายชื่อผู้ชำระเงินครบถ้วนแล้ว (100% Fully Paid Report)</div>
          <div class="subtitle">สาขาวิศวกรรมคอมพิวเตอร์ (Computer Engineering) • คณะวิศวกรรมศาสตร์</div>
          <div class="meta-info">
            <span>พิมพ์รายงานเมื่อ: ${todayStr}</span>
            <span>สถานะระบบ: ข้อมูลจาก Cloud Database (Firestore)</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">ผู้ชำระเงินครบทั้งหมด</div>
            <div class="stat-val">${fullyPaidOrders.length} รายการ</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">อาจารย์ / บุคลากร</div>
            <div class="stat-val" style="color: #0284c7;">${teacherCount} ท่าน</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">นักศึกษา (ชำระครบ)</div>
            <div class="stat-val">${studentCount} คน</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">ยอดเงินรับชำระแล้วรวม</div>
            <div class="stat-val">฿${totalRevenue.toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th style="width: 110px;">เลขที่ออเดอร์</th>
              <th style="width: 100px;">รหัสประจำตัว</th>
              <th style="text-align: left;">ชื่อ-นามสกุล (ผู้สั่งซื้อ)</th>
              <th style="width: 95px;">เบอร์โทรศัพท์</th>
              <th style="width: 90px;">ประเภท</th>
              <th style="text-align: left;">รายการสั่งซื้อ & ไซส์</th>
              <th style="width: 95px; text-align: right;">ยอดชำระแล้ว</th>
            </tr>
          </thead>
          <tbody>
            ${fullyPaidOrders.map((o, idx) => {
              const isTeacher = o.isTeacher || o.role === 'teacher' || (o.studentId && o.studentId.toUpperCase().startsWith('T'));
              const calcTotal = getOrderTotal(o);

              const itemDetails = o.items ? o.items.map(it => 
                `${it.title || 'เสื้อ'} (ไซส์ ${it.size} x ${it.qty || 1})`
              ).join(', ') : 'เสื้อ CPE';

              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${o.id}</strong></td>
                  <td>${o.studentId || '-'}</td>
                  <td class="left"><strong>${o.name || '-'}</strong></td>
                  <td>${o.phone || '-'}</td>
                  <td>
                    ${isTeacher ? '<span class="badge-teacher">👨‍🏫 อาจารย์</span>' : '<span class="badge-student">🎓 นักศึกษา</span>'}
                  </td>
                  <td class="left">${itemDetails}</td>
                  <td class="right" style="font-weight: bold; color: #16a34a;">฿${calcTotal.toLocaleString()}</td>
                </tr>
              `;
            }).join('')}
            
            <tr class="total-row">
              <td colspan="6" style="text-align: right;">รวมทั้งหมด (${fullyPaidOrders.length} ออเดอร์ / ${totalShirts} ตัว)</td>
              <td class="left" style="color: #15803d;">ชำระครบถ้วน 100% ทุกรายการ</td>
              <td class="right" style="color: #16a34a; font-size: 14px;">฿${totalRevenue.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="signature-section">
          <div class="sig-box">
            <p style="margin-bottom: 45px;">ลงชื่อ....................................................ผู้พิมพ์รายงาน</p>
            <p>(....................................................)</p>
            <p style="color: #64748b; font-size: 11px;">ตำแหน่ง กรรมการดำเนินงานเสื้อ CPE</p>
          </div>
          <div class="sig-box">
            <p style="margin-bottom: 45px;">ลงชื่อ....................................................ผู้ตรวจสอบ / เหรัญญิก</p>
            <p>(....................................................)</p>
            <p style="color: #64748b; font-size: 11px;">วันที่ ........ / ........ / ................</p>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    showToast('📄 สร้างรายงาน PDF สรุปผู้ชำระเงินครบถ้วนเรียบร้อยแล้ว!', 'success');
  };

  const exportSizeSummaryPDF = () => {
    if (!orders || orders.length === 0) {
      showToast('ไม่มีข้อมูลออเดอร์ในการส่งออก', 'error');
      return;
    }

    const sizeSummary = {};
    const itemizedByProduct = {};
    const sizeOrder = ['SS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'];

    orders.forEach(o => {
      if (o.items) {
        o.items.forEach(it => {
          const product = it.title || it.name || 'ไม่ระบุประเภท';
          const size = it.size || 'ไม่ระบุ';
          const qty = it.qty || 1;

          if (productFilter === 'polo_67' && !((o.studentId && o.studentId.startsWith('67')) || (it.studentId && it.studentId.startsWith('67')) || o.year === '3')) return;
          if (productFilter === 'polo_68' && !((o.studentId && o.studentId.startsWith('68')) || it.productKey === 'polo' || product.includes('รุ่น 68') || product.includes('CPE Polo Shirt'))) return;
          if (productFilter === 'polo_navy' && !(it.productKey === 'polo_navy' || product.includes('Navy') || product.includes('สีกรมท่า'))) return;
          if (productFilter === 'jacket' && !((o.studentId && o.studentId.startsWith('69')) || it.productKey === 'jacket' || product.includes('เสื้อคลุม') || product.includes('CPE 69'))) return;

          if (!sizeSummary[product]) sizeSummary[product] = {};
          sizeSummary[product][size] = (sizeSummary[product][size] || 0) + qty;

          if (!itemizedByProduct[product]) itemizedByProduct[product] = [];
          itemizedByProduct[product].push({
            product, size, qty,
            name: o.name || 'นักศึกษา',
            studentId: o.studentId || '',
            customName: it.customName || ''
          });
        });
      }
    });

    // Sort items within each product by size then by name
    Object.keys(itemizedByProduct).forEach(p => {
      itemizedByProduct[p].sort((a, b) => {
        const ia = sizeOrder.indexOf(a.size);
        const ib = sizeOrder.indexOf(b.size);
        if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return (a.name || '').localeCompare(b.name || '', 'th');
      });
    });

    const products = Object.keys(sizeSummary);
    const allSizes = [...new Set(products.flatMap(p => Object.keys(sizeSummary[p])))];
    allSizes.sort((a, b) => {
      const ia = sizeOrder.indexOf(a);
      const ib = sizeOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const todayStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const grandTotal = Object.values(itemizedByProduct).flat().reduce((sum, i) => sum + (i.qty || 1), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อเปิด PDF', 'error');
      return;
    }

    // Build one product section per product type
    const embroiderySection = products.map((p, pIdx) => {
      const items = itemizedByProduct[p] || [];
      const totalQty = items.reduce((s, i) => s + (i.qty || 1), 0);
      return `
        <div class="product-section page-break">
          <div class="section-title">ใบงานรายละเอียดการสั่งผลิต: ${p} — รวม <span style="color:#c00;">${totalQty} ตัว</span></div>
          <table>
            <thead>
              <tr>
                <th style="width:35px;">ลำดับ</th>
                <th style="width:65px;">ไซส์</th>
                <th style="text-align:left;">ชื่อผู้สั่ง (รหัสนักศึกษา/รหัสอาจารย์)</th>
                <th style="width:65px;">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it, idx) => `
                <tr style="${idx % 2 === 0 ? 'background:#f9f9f9;' : ''}">
                  <td>${idx + 1}</td>
                  <td><strong>${it.size}</strong></td>
                  <td class="left">${it.name} (${it.studentId})</td>
                  <td>${it.qty || 1} ตัว</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align:right; font-weight:bold;">รวม ${p}</td>
                <td style="font-weight:bold; color:#c00;">${totalQty} ตัว</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>ใบสรุปรายการสั่งผลิตเสื้อ (ส่งร้าน/โรงงาน)</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
          body { font-family: 'Sarabun', sans-serif; color: #000; background: #fff; padding: 24px; margin: 0; font-size: 13px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .header h2 { margin: 0 0 4px 0; font-size: 20px; }
          .header p { margin: 2px 0; font-size: 12px; color: #444; }
          .section-title { font-size: 15px; font-weight: bold; margin: 20px 0 8px 0; background: #e0e0e0; padding: 8px 12px; border-left: 5px solid #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #555; padding: 6px 8px; text-align: center; font-size: 12px; }
          th { background: #c8c8c8; font-weight: bold; }
          td.left { text-align: left; }
          .total-row { background: #e0e0e0; font-weight: bold; }
          .product-section { margin-bottom: 24px; }
          .page-break { page-break-before: always; padding-top: 16px; }
          .grand-total { background: #111; color: #fff; text-align: center; padding: 10px 16px; font-size: 15px; font-weight: bold; margin: 16px 0; border-radius: 4px; }
          @media print { body { padding: 8px; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:15px; text-align:right; display:flex; gap:8px; justify-content:flex-end;">
          <button onclick="window.print()" style="padding:8px 18px; font-size:13px; font-weight:bold; background:#000; color:#fff; border:none; border-radius:4px; cursor:pointer;">
            🖨️ พิมพ์ / บันทึกเป็น PDF
          </button>
        </div>

        <div class="header">
          <h2>ใบสรุปยอดสั่งผลิตเสื้อ (สำหรับส่งโรงงาน/ร้านค้า)</h2>
          <p>สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏพิบูลสงคราม</p>
          <p>วันที่ออกเอกสาร: ${todayStr} &nbsp;|&nbsp; ยอดรวมทั้งหมด: <strong>${grandTotal} ตัว</strong> (${products.length} ประเภท)</p>
        </div>

        <!-- SECTION 1: Size Summary Table -->
        <div class="section-title">ส่วนที่ 1 — ตารางสรุปยอดสั่งแยกตามประเภทเสื้อและไซส์</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">ประเภทเสื้อ / สินค้า</th>
              ${allSizes.map(s => `<th>${s}</th>`).join('')}
              <th>รวม (ตัว)</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => {
              const rowTotal = allSizes.reduce((sum, s) => sum + (sizeSummary[p][s] || 0), 0);
              return `
                <tr>
                  <td class="left" style="font-weight:bold;">${p}</td>
                  ${allSizes.map(s => `<td>${sizeSummary[p][s] || '-'}</td>`).join('')}
                  <td style="font-weight:bold;">${rowTotal}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td class="left">รวมทุกประเภท</td>
              ${allSizes.map(s => {
                const c = products.reduce((sum, p) => sum + (sizeSummary[p][s] || 0), 0);
                return `<td>${c || '-'}</td>`;
              }).join('')}
              <td style="font-size:14px; font-weight:bold;">${grandTotal} ตัว</td>
            </tr>
          </tbody>
        </table>

        <div class="grand-total">📦 ยอดสั่งผลิตรวม: ${grandTotal} ตัว แบ่งเป็น ${products.length} ประเภทเสื้อ</div>

        <!-- SECTIONS 2+: One product job sheet per product type -->
        ${embroiderySection}

        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 600); };
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    showToast('📄 เปิดรายงาน PDF แยกตามประเภทเสื้อเรียบร้อยแล้ว!', 'success');
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch = (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (o.studentId || '').includes(searchTerm) || 
                        (o.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchStatus = statusFilter === 'all' || o.status === statusFilter;
    if (statusFilter === 'teacher_orders') {
      matchStatus = o.isTeacher || o.role === 'teacher' || (o.studentId && o.studentId.toUpperCase().startsWith('T')) || (o.studentId && !/^\d{10}$/.test(o.studentId));
    } else if (statusFilter === 'remaining_completed') {
      matchStatus = o.remainingPaidStatus === 'approved' || (o.remaining === 0 && o.deposit === o.total);
    } else if (statusFilter === 'remaining_pending') {
      matchStatus = o.remainingPaidStatus === 'pending_verification';
    }
    
    let matchProduct = true;
    if (productFilter !== 'all') {
      if (productFilter === 'polo_67') {
        matchProduct = (o.studentId && o.studentId.startsWith('67')) || o.year === '3' || (o.items && o.items.some(it => (it.studentId && it.studentId.startsWith('67'))));
      } else if (productFilter === 'polo_68') {
        matchProduct = (o.studentId && o.studentId.startsWith('68')) || o.year === '2' || (o.items && o.items.some(it => it.productKey === 'polo' || (it.title && (it.title.includes('รุ่น 68') || it.title.includes('CPE Polo Shirt')))));
      } else if (productFilter === 'polo_navy') {
        matchProduct = o.items && o.items.some(it => it.productKey === 'polo_navy' || (it.title && (it.title.includes('Navy') || it.title.includes('สีกรมท่า'))));
      } else if (productFilter === 'jacket') {
        matchProduct = (o.studentId && o.studentId.startsWith('69')) || o.year === '1' || (o.items && o.items.some(it => it.productKey === 'jacket' || (it.title && (it.title.includes('เสื้อคลุม') || it.title.includes('CPE 69')))));
      }
    }

    return matchSearch && matchStatus && matchProduct;
  });

  const totalRev = orders.reduce((sum, o) => sum + getOrderTotal(o), 0);

  const totalItemsCount = orders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.qty || 1), 0) : 1), 0);

  return (
    <div className="modal-backdrop show" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1, pointerEvents: 'auto', padding: '16px' }}>
      <div className="modal-card xl admin-modal-card" onClick={e => e.stopPropagation()} style={{ position: 'relative', zIndex: 10000, background: '#10121a', border: '1px solid var(--border-gold)', borderRadius: '16px', maxWidth: '1100px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', opacity: 1, visibility: 'visible' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #1b0a0e, #0a0b10)', borderBottom: '1px solid var(--accent-gold)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="modal-title" style={{ color: 'var(--accent-gold-bright)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', margin: 0 }}>
            <span>👑 CPE ADMIN PORTAL (ผู้ดูแลระบบ: 6800000000)</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => fetchOrdersDirect(true)}
              disabled={refreshing}
              style={{
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid #22c55e',
                color: '#22c55e',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 12px rgba(34,197,94,0.2)'
              }}
            >
              <span>{refreshing ? '⏳ กำลังดึงข้อมูล...' : '⚡ ดึงข้อมูลล่าสุด (100%)'}</span>
            </button>
            <button className="close-btn" onClick={onClose} style={{ fontSize: '1.8rem', lineHeight: 1 }}>&times;</button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* Sales Period & Deadline Control Card */}
          <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <h4 style={{ color: 'var(--accent-gold-bright)', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ ควบคุมสถานะการเปิด-ปิดรับออเดอร์ (Sales Period Settings)
              </h4>
              <span style={{ fontSize: '0.8rem', color: salesMode === 'open' ? '#22c55e' : salesMode === 'closed' ? '#ef4444' : '#38bdf8', fontWeight: 'bold' }}>
                สถานะปัจจุบัน: {salesMode === 'open' ? '🟢 เปิดรับการสั่งซื้อตลอด' : salesMode === 'closed' ? '🔴 ปิดรับการสั่งซื้อทันที' : '⏱️ เปิดตามเวลานับถอยหลัง'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-sub)', fontSize: '0.82rem', marginBottom: '6px' }}>
                  เลือกโหมดเปิด-ปิดการขาย:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => {
                      setSalesMode('auto');
                      handleSaveSalesSettings('auto', customDeadline);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      border: salesMode === 'auto' ? '1px solid #38bdf8' : '1px solid #333',
                      background: salesMode === 'auto' ? '#0284c7' : '#18181b',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    ⏱️ ตามเวลา (Auto)
                  </button>
                  <button
                    onClick={() => {
                      setSalesMode('open');
                      handleSaveSalesSettings('open', customDeadline);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      border: salesMode === 'open' ? '1px solid #22c55e' : '1px solid #333',
                      background: salesMode === 'open' ? '#16a34a' : '#18181b',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    🟢 เปิดขาย (Open)
                  </button>
                  <button
                    onClick={() => {
                      setSalesMode('closed');
                      handleSaveSalesSettings('closed', customDeadline);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      border: salesMode === 'closed' ? '1px solid #ef4444' : '1px solid #333',
                      background: salesMode === 'closed' ? '#dc2626' : '#18181b',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    🔴 ปิดขาย (Closed)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-sub)', fontSize: '0.82rem', marginBottom: '6px' }}>
                  กำหนดเวลาปิดรับออเดอร์ (กรณีโหมดนับถอยหลัง):
                </label>
                <input
                  type="datetime-local"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#18181b',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <button
                  onClick={() => handleSaveSalesSettings(salesMode, customDeadline)}
                  disabled={savingSettings}
                  style={{
                    width: '100%',
                    padding: '9px 16px',
                    background: 'linear-gradient(135deg, #f5d061, #d4af37)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(245,208,97,0.3)'
                  }}
                >
                  {savingSettings ? '⏳ กำลังบันทึก...' : '💾 บันทึกเวลาปิดออเดอร์'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>ยอดชำระแล้วทั้งหมด</span>
              <h3 style={{ color: '#22c55e', fontSize: '1.4rem', marginTop: '4px', margin: '4px 0 0' }}>
                ฿{orders.reduce((sum, o) => {
                  const calcTotal = getOrderTotal(o);
                  const isFullyPaid = o.remainingPaidStatus === 'approved' || o.isTeacher || o.role === 'teacher' || o.remaining === 0 || (o.deposit && o.deposit >= calcTotal);
                  return sum + (isFullyPaid ? Math.max(calcTotal, o.deposit || 0) : (o.deposit || 50));
                }, 0).toLocaleString()}
              </h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>ยอดขายรวม: ฿{totalRev.toLocaleString()}</span>
            </div>
            <div style={{ background: '#0a0b10', border: '1px solid #38bdf8', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <span style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 600 }}>👨‍🏫 ออเดอร์อาจารย์</span>
              <h3 style={{ color: '#38bdf8', fontSize: '1.4rem', margin: '4px 0 0', fontWeight: 800 }}>
                {orders.filter(o => o.isTeacher || o.role === 'teacher' || (o.studentId && o.studentId.toUpperCase().startsWith('T'))).length} รายการ
              </h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>จ่ายเต็มจำนวน 100%</span>
            </div>
            <div style={{ background: '#0a0b10', border: '1px solid #22c55e', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <span style={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 600 }}>💳 จ่ายส่วนที่เหลือครบแล้ว</span>
              <h3 style={{ color: '#22c55e', fontSize: '1.4rem', margin: '4px 0 0', fontWeight: 800 }}>
                {orders.filter(o => o.remainingPaidStatus === 'approved' || (o.remaining === 0 && o.deposit === o.total)).length} รายการ
              </h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>ไม่มี ยอดค้างชำระ</span>
            </div>
            <div style={{ background: '#0a0b10', border: '1px solid #eab308', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <span style={{ color: '#fde047', fontSize: '0.78rem', fontWeight: 600 }}>⏳ รออนุมัติส่วนที่เหลือ</span>
              <h3 style={{ color: '#eab308', fontSize: '1.4rem', margin: '4px 0 0', fontWeight: 800 }}>
                {orders.filter(o => o.remainingPaidStatus === 'pending_verification').length} รายการ
              </h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>สลิปส่งแล้ว รอตรวจสอบ</span>
            </div>
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>จำนวนออเดอร์ / เสื้อทั้งหมด</span>
              <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '4px 0 0', fontWeight: 800 }}>{orders.length} ออเดอร์ ({totalItemsCount} ตัว)</h3>
            </div>
          </div>

          {/* Shirt Category Sub-pages Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-gold)', paddingBottom: '12px' }}>
            {[
              { id: 'all', label: '📦 ทั้งหมดทุกสินค้า', badgeBg: '#3b82f6' },
              { id: 'deposit_summary', label: '💰 สรุปคนจ่ายมัดจำทั้งหมด', badgeBg: '#10b981' },
              { id: 'polo_67', label: '🎓 ออเดอร์ CPE 67 (ปี 3)', badgeBg: '#a855f7' },
              { id: 'polo_68', label: '👕 เสื้อโปโล CPE 68 (ปี 2)', badgeBg: '#eab308' },
              { id: 'polo_navy', label: '👕 เสื้อโปโล (สีกรมท่า Navy)', badgeBg: '#1e3a8a' },
              { id: 'jacket', label: '🧥 เสื้อคลุม CPE 69 (ปี 1)', badgeBg: '#10b981' },
              { id: 'remaining_payments', label: '💳 อนุมัติชำระส่วนที่เหลือ', badgeBg: '#22c55e' },
              { id: 'extra_deposit', label: '💳 มัดจำเพิ่ม 100 บาท', badgeBg: '#f59e0b' }
            ].map(tab => {
              const count = tab.id === 'deposit_summary' ? orders.length : tab.id === 'extra_deposit' ? extraDeposits.length : tab.id === 'remaining_payments' ? orders.filter(o => o.remainingPaidStatus === 'pending_verification' || o.remainingPaidStatus === 'approved' || o.remainingSlipUrl).length : tab.id === 'all' ? orders.length : orders.filter(o => {
                if (tab.id === 'polo_67') return (o.studentId && o.studentId.startsWith('67')) || o.year === '3' || (o.items && o.items.some(it => it.studentId && it.studentId.startsWith('67')));
                if (tab.id === 'polo_68') return (o.studentId && o.studentId.startsWith('68')) || o.year === '2' || (o.items && o.items.some(it => it.productKey === 'polo' || (it.title && (it.title.includes('รุ่น 68') || it.title.includes('CPE Polo Shirt')))));
                if (tab.id === 'polo_navy') return o.items && o.items.some(it => it.productKey === 'polo_navy' || (it.title && (it.title.includes('Navy') || it.title.includes('สีกรมท่า'))));
                if (tab.id === 'jacket') return (o.studentId && o.studentId.startsWith('69')) || o.year === '1' || (o.items && o.items.some(it => it.productKey === 'jacket' || (it.title && (it.title.includes('เสื้อคลุม') || it.title.includes('CPE 69')))));
                return true;
              }).length;

              const isActive = productFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setProductFilter(tab.id)}
                  style={{
                    background: isActive ? tab.badgeBg : '#0a0b10',
                    color: isActive ? '#fff' : 'var(--text-sub)',
                    border: `1px solid ${isActive ? tab.badgeBg : 'var(--border-gold)'}`,
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isActive ? `0 4px 12px ${tab.badgeBg}66` : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    background: isActive ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontSize: '0.75rem'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Size Summary Card & Export Excel/CSV Action */}
          {(() => {
            const sizeSummary = {};
            const itemizedList = [];
            const sizeOrder = ['SS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'];

            orders.forEach(o => {
              if (o.items) {
                o.items.forEach(it => {
                  const product = it.title || 'ไม่ระบุ';
                  const size = it.size || 'ไม่ระบุ';
                  const qty = it.qty || 1;

                  if (productFilter === 'polo_67' && !((o.studentId && o.studentId.startsWith('67')) || (it.studentId && it.studentId.startsWith('67')) || o.year === '3')) return;
                  if (productFilter === 'polo_68' && !((o.studentId && o.studentId.startsWith('68')) || it.productKey === 'polo' || product.includes('รุ่น 68') || product.includes('CPE Polo Shirt'))) return;
                  if (productFilter === 'polo_navy' && !(it.productKey === 'polo_navy' || product.includes('Navy') || product.includes('สีกรมท่า'))) return;
                  if (productFilter === 'jacket' && !((o.studentId && o.studentId.startsWith('69')) || it.productKey === 'jacket' || product.includes('เสื้อคลุม') || product.includes('CPE 69'))) return;

                  if (!sizeSummary[product]) sizeSummary[product] = {};
                  sizeSummary[product][size] = (sizeSummary[product][size] || 0) + qty;

                  itemizedList.push({
                    orderId: o.id,
                    studentId: o.studentId,
                    name: o.name,
                    phone: o.phone,
                    status: o.status,
                    product,
                    size,
                    qty,
                    customName: it.customName || ''
                  });
                });
              }
            });

            const products = Object.keys(sizeSummary);
            const allSizes = [...new Set(products.flatMap(p => Object.keys(sizeSummary[p])))];
            allSizes.sort((a, b) => {
              const ia = sizeOrder.indexOf(a);
              const ib = sizeOrder.indexOf(b);
              return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });

            return (
              <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ color: 'var(--accent-gold-bright)', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📊 สรุปจำนวนสั่งแยกตามไซส์ & รายชื่อปักชื่อ
                  </h4>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={exportSizeSummaryPDF}
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.83rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(239,68,68,0.3)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>📄 พิมพ์ / โหลด PDF ส่งร้านปัก</span>
                    </button>

                    <button 
                      onClick={exportFullyPaidPDF}
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #16a34a, #15803d)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.83rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>📄 ปริ้นท์ PDF สรุปผู้ชำระเงินครบถ้วน (100%)</span>
                    </button>

                    <button 
                      onClick={exportSizeSummaryCSV}
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.83rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>📊 ส่งออก Excel (.CSV)</span>
                    </button>
                  </div>
                </div>

                {products.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>ยังไม่มีข้อมูลออเดอร์</div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', color: '#fff', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#090a0f', borderBottom: '1px solid var(--border-gold)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--accent-gold-bright)' }}>สินค้า</th>
                            {allSizes.map(s => (
                              <th key={s} style={{ padding: '8px 10px', color: '#38bdf8', fontWeight: 'bold' }}>{s}</th>
                            ))}
                            <th style={{ padding: '8px 10px', color: '#22c55e', fontWeight: 'bold' }}>รวม</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map(product => {
                            const rowTotal = allSizes.reduce((sum, s) => sum + (sizeSummary[product][s] || 0), 0);
                            return (
                              <tr key={product} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', color: '#fff' }}>{product}</td>
                                {allSizes.map(s => (
                                  <td key={s} style={{ padding: '8px 10px', color: sizeSummary[product][s] ? '#eab308' : 'var(--text-muted)', fontWeight: sizeSummary[product][s] ? 'bold' : 'normal' }}>
                                    {sizeSummary[product][s] || 0}
                                  </td>
                                ))}
                                <td style={{ padding: '8px 10px', color: '#22c55e', fontWeight: 'bold', fontSize: '1rem' }}>{rowTotal}</td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: 'rgba(234,179,8,0.08)', borderTop: '2px solid var(--accent-gold)' }}>
                            <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', color: 'var(--accent-gold-bright)' }}>รวมทั้งหมด</td>
                            {allSizes.map(s => {
                              const colTotal = products.reduce((sum, p) => sum + (sizeSummary[p][s] || 0), 0);
                              return <td key={s} style={{ padding: '8px 10px', color: 'var(--accent-gold-bright)', fontWeight: 'bold', fontSize: '1rem' }}>{colTotal}</td>;
                            })}
                            <td style={{ padding: '8px 10px', color: '#22c55e', fontWeight: 'bold', fontSize: '1.1rem' }}>{totalItemsCount}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Detailed Embroidery List Section */}
                    <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h5 style={{ color: 'var(--accent-gold-bright)', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🧵 รายชื่อผู้สั่งและข้อความปักชื่อแยกตามเสื้อ & ไซส์ ({itemizedList.length} รายการ)
                        </h5>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                        {itemizedList.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <span style={{ color: 'var(--accent-gold-bright)', fontWeight: 'bold', marginRight: '8px' }}>[{item.product}]</span>
                              <span style={{ color: '#38bdf8', fontWeight: 'bold', marginRight: '10px' }}>ไซส์: {item.size}</span>
                              <span style={{ color: '#fff', fontWeight: 'bold' }}>👤 {item.name} ({item.studentId})</span>
                              {item.phone && <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>📞 {item.phone}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ background: item.customName ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.05)', color: item.customName ? '#fde047' : 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px', border: item.customName ? '1px solid rgba(234,179,8,0.4)' : '1px solid transparent' }}>
                                🧵 {item.customName ? `ปักชื่อ: "${item.customName}"` : '(ไม่ปักชื่อ)'}
                              </span>
                              <span className={`status-badge status-${item.status}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                                {item.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Search and Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="🔍 ค้นหารหัสนักศึกษา 10 หลัก / เลขออเดอร์ / ชื่อ..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '8px 14px' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'teacher_orders', label: '👨‍🏫 ออเดอร์อาจารย์' },
                { id: 'remaining_completed', label: '💳 ชำระส่วนที่เหลือแล้ว' },
                { id: 'remaining_pending', label: '⏳ รออนุมัติส่วนที่เหลือ' },
                { id: 'pending', label: 'รอสลิป' },
                { id: 'paid', label: 'ชำระเงินแล้ว' },
                { id: 'preparing', label: 'กำลังผลิต' },
                { id: 'shipping', label: 'จัดส่งแล้ว' },
                { id: 'completed', label: 'สำเร็จแล้ว' }
              ].map(st => (
                <button 
                  key={st.id} 
                  className={`btn ${statusFilter === st.id ? 'btn-gold' : 'btn-outline'}`}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    borderColor: statusFilter === st.id ? 'var(--accent-gold)' : (st.id === 'teacher_orders' ? '#38bdf8' : (st.id === 'remaining_completed' ? '#22c55e' : (st.id === 'remaining_pending' ? '#eab308' : 'rgba(255,255,255,0.2)'))),
                    color: statusFilter === st.id ? '#000' : (st.id === 'teacher_orders' ? '#38bdf8' : (st.id === 'remaining_completed' ? '#86efac' : (st.id === 'remaining_pending' ? '#fde047' : '#fff'))),
                    fontWeight: 'bold'
                  }}
                  onClick={() => setStatusFilter(st.id)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders / Extra Deposits / Deposit Summary Table */}
          {productFilter === 'deposit_summary' ? (
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h4 style={{ color: '#22c55e', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  📊 สรุปจำนวนคนและยอดเงินมัดจำทั้งหมด
                </h4>
                <span style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                  รวมผู้จ่ายมัดจำทั้งหมด: <strong style={{ color: '#22c55e', fontSize: '1.05rem' }}>{orders.length} คน</strong>
                </span>
              </div>

              {/* Deposit Breakdown Stats Grid */}
              {(() => {
                const verifiedExtraOrderRefs = new Set(extraDeposits.filter(ed => ed.status === 'verified').map(ed => ed.orderRef));
                const upgradedOrders = orders.filter(o => verifiedExtraOrderRefs.has(o.id) || verifiedExtraOrderRefs.has(o.firestoreId));
                const original150Orders = orders.filter(o => (o.deposit || 50) === 150 && !verifiedExtraOrderRefs.has(o.id) && !verifiedExtraOrderRefs.has(o.firestoreId));
                const original50Orders = orders.filter(o => (o.deposit || 50) === 50);
                const count50 = original50Orders.length + upgradedOrders.length;
                const sum50 = count50 * 50;
                const count150 = original150Orders.length;
                const sum150 = count150 * 150;
                const countExtra100 = extraDeposits.filter(ed => ed.status === 'verified').length;
                const sumExtra100 = extraDeposits.filter(ed => ed.status === 'verified').reduce((sum, ed) => sum + (ed.amount || 100), 0);
                const countPendingExtra100 = extraDeposits.filter(ed => ed.status !== 'verified').length;
                const totalDepositMoney = sum50 + sum150 + sumExtra100;

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid #22c55e', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                        <span style={{ color: '#86efac', fontSize: '0.82rem', fontWeight: 600 }}>🟢 มัดจำ 50 บาท (ลูกค้าใหม่)</span>
                        <h3 style={{ color: '#22c55e', fontSize: '1.4rem', margin: '4px 0 2px' }}>{count50} คน</h3>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>รวมเงิน: ฿{sum50.toLocaleString()}</span>
                      </div>

                      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                        <span style={{ color: '#fde047', fontSize: '0.82rem', fontWeight: 600 }}>💳 มัดจำ 150 บาท (ลูกค้าเดิม)</span>
                        <h3 style={{ color: '#f59e0b', fontSize: '1.4rem', margin: '4px 0 2px' }}>{count150} คน</h3>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>รวมเงิน: ฿{sum150.toLocaleString()}</span>
                      </div>

                      <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid #38bdf8', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                        <span style={{ color: '#7dd3fc', fontSize: '0.82rem', fontWeight: 600 }}>⚡ มัดจำเพิ่ม 100 บาท (โอนแยก)</span>
                        <h3 style={{ color: '#38bdf8', fontSize: '1.4rem', margin: '4px 0 2px' }}>{countExtra100} รายการ</h3>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>รวมเงิน: ฿{sumExtra100.toLocaleString()}</span>
                        {countPendingExtra100 > 0 && (
                          <div style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 'bold', marginTop: '2px' }}>
                            ⏳ รออนุมัติ {countPendingExtra100} รายการ
                          </div>
                        )}
                      </div>

                      <div style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid #f5d061', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                        <span style={{ color: '#f5d061', fontSize: '0.82rem', fontWeight: 700 }}>🏆 รวมเงินมัดจำทั้งหมด</span>
                        <h3 style={{ color: '#f5d061', fontSize: '1.5rem', margin: '4px 0 2px' }}>฿{totalDepositMoney.toLocaleString()}</h3>
                        <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 600 }}>{orders.length} คนรวม</span>
                      </div>
                    </div>

                    {/* Complete Student Deposit Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff', fontSize: '0.88rem' }}>
                        <thead>
                          <tr style={{ background: '#090a0f', borderBottom: '1px solid var(--border-gold)' }}>
                            <th style={{ padding: '10px' }}>#</th>
                            <th style={{ padding: '10px' }}>รหัสนักศึกษา / ชื่อ</th>
                            <th style={{ padding: '10px' }}>ออเดอร์</th>
                            <th style={{ padding: '10px' }}>ประเภทมัดจำ</th>
                            <th style={{ padding: '10px' }}>ยอดมัดจำ</th>
                            <th style={{ padding: '10px' }}>ยอดเต็มออเดอร์</th>
                            <th style={{ padding: '10px' }}>สลิป</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o, idx) => (
                            <tr key={o.firestoreId || o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <td style={{ padding: '10px', color: '#666' }}>{idx + 1}</td>
                              <td style={{ padding: '10px' }}>
                                <strong style={{ color: '#fff' }}>{o.name}</strong>
                                <div style={{ color: '#38bdf8', fontSize: '0.78rem' }}>{o.studentId}</div>
                              </td>
                              <td style={{ padding: '10px', color: '#f5d061', fontWeight: 600 }}>{o.id}</td>
                              <td style={{ padding: '10px' }}>
                                {(o.deposit || 50) === 150 ? (
                                  <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    💳 ลูกค้าเดิม (150฿)
                                  </span>
                                ) : (
                                  <span style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    🟢 ลูกค้าใหม่ (50฿)
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px', color: '#22c55e', fontWeight: 'bold', fontSize: '1rem' }}>
                                ฿{(o.deposit || 50).toLocaleString()}
                              </td>
                              <td style={{ padding: '10px', color: 'var(--text-sub)' }}>
                                ฿{getOrderTotal(o).toLocaleString()}
                              </td>
                              <td style={{ padding: '10px' }}>
                                {o.slipUrl ? (
                                  <button onClick={() => setPreviewSlipOrder(o)} style={{ padding: '4px 10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                                    📄 ดูสลิป
                                  </button>
                                ) : <span style={{ color: '#666', fontSize: '0.75rem' }}>ไม่มีสลิป</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : productFilter === 'remaining_payments' ? (
            <div style={{ background: '#0a0b10', border: '1px solid #22c55e', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h4 style={{ color: '#22c55e', margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💳 รายการแจ้งอนุมัติชำระส่วนที่เหลือ ({orders.filter(o => o.remainingPaidStatus === 'pending_verification' || o.remainingPaidStatus === 'approved' || o.remainingSlipUrl).length} รายการ)
                </h4>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={exportFullyPaidPDF}
                    style={{
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(22,163,74,0.3)'
                    }}
                  >
                    📄 ปริ้นท์ PDF สรุปคนชำระครบถ้วน (100%)
                  </button>
                  <span style={{ color: '#fde047', fontSize: '0.82rem', background: 'rgba(234,179,8,0.15)', padding: '4px 10px', borderRadius: '6px', border: '1px solid #eab308' }}>
                    ⏳ รออนุมัติ: <strong>{orders.filter(o => o.remainingPaidStatus === 'pending_verification').length} รายการ</strong>
                  </span>
                </div>
              </div>

              {(() => {
                const remainingOrdersList = orders.filter(o => o.remainingPaidStatus === 'pending_verification' || o.remainingPaidStatus === 'approved' || o.remainingSlipUrl);
                return remainingOrdersList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งโอนชำระเงินส่วนที่เหลือ</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ background: '#090a0f', borderBottom: '1px solid #22c55e' }}>
                          <th style={{ padding: '10px' }}>ออเดอร์</th>
                          <th style={{ padding: '10px' }}>ผู้สั่งซื้อ</th>
                          <th style={{ padding: '10px' }}>ยอดเต็มออเดอร์</th>
                          <th style={{ padding: '10px' }}>ยอดเงินชำระส่วนที่เหลือ</th>
                          <th style={{ padding: '10px' }}>สลิปหลักฐาน</th>
                          <th style={{ padding: '10px' }}>สถานะ</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>จัดการอนุมัติ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remainingOrdersList.map(o => (
                          <tr key={o.firestoreId || o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: o.remainingPaidStatus === 'pending_verification' ? 'rgba(234,179,8,0.06)' : 'rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '10px' }}>
                              <strong style={{ color: 'var(--accent-gold-bright)' }}>{o.id}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.date}</div>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <strong style={{ color: '#fff' }}>{o.name}</strong>
                              <div style={{ color: '#38bdf8', fontSize: '0.78rem' }}>รหัส: {o.studentId}</div>
                              <div style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>📞 {o.phone}</div>
                            </td>
                            <td style={{ padding: '10px', color: 'var(--text-sub)', fontWeight: 'bold' }}>
                              ฿{getOrderTotal(o).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px', color: '#22c55e', fontWeight: 'bold', fontSize: '1rem' }}>
                              ฿{(o.remainingAmountPaid || o.remaining || Math.max(0, getOrderTotal(o) - (o.deposit || 0))).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {o.remainingSlipUrl ? (
                                <button 
                                  onClick={() => setPreviewSlipOrder({ ...o, slipUrl: o.remainingSlipUrl, isRemainingSlip: true })}
                                  style={{ padding: '4px 10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}
                                >
                                  🖼️ ดูสลิปส่วนที่เหลือ
                                </button>
                              ) : <span style={{ color: '#666', fontSize: '0.78rem' }}>ไม่มีสลิป</span>}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {o.remainingPaidStatus === 'approved' ? (
                                <span style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e', color: '#22c55e', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                  ✅ อนุมัติแล้ว (ครบ 100%)
                                </span>
                              ) : o.remainingPaidStatus === 'pending_verification' ? (
                                <span style={{ background: 'rgba(234,179,8,0.2)', border: '1px solid #eab308', color: '#fde047', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                  ⏳ รออนุมัติ
                                </span>
                              ) : (
                                <span style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                  ❌ ปฏิเสธสลิป
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {o.remainingPaidStatus === 'pending_verification' ? (
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button 
                                    onClick={() => handleVerifyRemainingDeposit(o)}
                                    style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}
                                  >
                                    ⚡ อนุมัติสลิป
                                  </button>
                                  <button 
                                    onClick={() => handleRejectRemainingDeposit(o)}
                                    style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}
                                  >
                                    ❌ ปฏิเสธ
                                  </button>
                                </div>
                              ) : o.remainingPaidStatus === 'approved' ? (
                                <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 'bold' }}>✓ อนุมัติแล้ว</span>
                              ) : (
                                <button 
                                  onClick={() => handleVerifyRemainingDeposit(o)}
                                  style={{ padding: '4px 8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}
                                >
                                  🔄 ลองอนุมัติใหม่
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          ) : productFilter === 'extra_deposit' ? (
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '16px' }}>
              <h4 style={{ color: '#f5d061', marginTop: 0, marginBottom: '14px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💳 รายการแจ้งโอนมัดจำเพิ่ม 100 บาท ({extraDeposits.length} รายการ)
              </h4>
              {extraDeposits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งโอนมัดจำเพิ่ม</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#090a0f', borderBottom: '1px solid var(--border-gold)' }}>
                        <th style={{ padding: '10px' }}>วันที่ส่งหลักฐาน</th>
                        <th style={{ padding: '10px' }}>รหัสนักศึกษา</th>
                        <th style={{ padding: '10px' }}>ออเดอร์ที่อ้างอิง</th>
                        <th style={{ padding: '10px' }}>จำนวนเงิน</th>
                        <th style={{ padding: '10px' }}>สลิป</th>
                        <th style={{ padding: '10px' }}>สถานะ</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extraDeposits.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <td style={{ padding: '10px' }}>{d.date || '-'}</td>
                          <td style={{ padding: '10px', color: '#38bdf8', fontWeight: 'bold' }}>{d.studentId}</td>
                          <td style={{ padding: '10px', color: '#f5d061', fontWeight: 'bold' }}>{d.orderRef}</td>
                          <td style={{ padding: '10px', color: '#22c55e', fontWeight: 'bold' }}>฿{d.amount || 100}</td>
                          <td style={{ padding: '10px' }}>
                            {d.slipUrl ? (
                              <button onClick={() => setPreviewSlipOrder({ slipUrl: d.slipUrl, id: d.orderRef, name: d.studentId, deposit: d.amount })} style={{ padding: '4px 10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}>
                                📄 ดูสลิป
                              </button>
                            ) : <span style={{ color: '#666' }}>ไม่มีสลิป</span>}
                          </td>
                          <td style={{ padding: '10px' }}>
                            {d.status === 'verified' ? (
                              <span style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                ✅ ยืนยันแล้ว
                              </span>
                            ) : (
                              <button
                                onClick={() => handleVerifyExtraDeposit(d)}
                                style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}
                              >
                                ⚡ ยืนยันสลิป & หักยอดค้าง
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button onClick={() => handleDeleteExtraDeposit(d)} style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}>🗑️ ลบ</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>กำลังดึงข้อมูลออเดอร์จาก Firebase...</div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ไม่พบข้อมูลออเดอร์ที่ตรงกับการค้นหา</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#090a0f', borderBottom: '1px solid var(--border-gold)' }}>
                    <th style={{ padding: '10px' }}>เลขที่ออเดอร์ / วันที่</th>
                    <th style={{ padding: '10px' }}>ข้อมูลนักศึกษา</th>
                    <th style={{ padding: '10px' }}>รายการสินค้าสั่งซื้อ</th>
                    <th style={{ padding: '10px' }}>ยอดเงินรวม</th>
                    <th style={{ padding: '10px' }}>สลิปโอนเงิน</th>
                    <th style={{ padding: '10px' }}>สถานะการผลิต / พัสดุ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px' }}>
                        <strong style={{ color: 'var(--accent-gold-bright)', display: 'block' }}>{o.id}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.date}</span>
                      </td>
                      
                      <td style={{ padding: '10px' }}>
                        {(() => {
                          const isTeacherUser = o.isTeacher || o.role === 'teacher' || (o.studentId && o.studentId.toUpperCase().startsWith('T')) || (o.studentId && !/^\d{10}$/.test(o.studentId));
                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <strong style={{ color: '#fff' }}>{o.name}</strong>
                                {isTeacherUser && (
                                  <span style={{ background: 'rgba(56,189,248,0.18)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                    👨‍🏫 อาจารย์ / บุคลากร
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.8rem', color: '#38bdf8', display: 'block' }}>
                                {isTeacherUser ? `รหัสอาจารย์: ${o.studentId}` : `รหัส: ${o.studentId}`}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>📞 {o.phone}</span>
                            </>
                          );
                        })()}
                      </td>

                      <td style={{ padding: '10px' }}>
                        {o.items && o.items.map((it, idx) => (
                          <div key={idx} style={{ marginBottom: '4px', fontSize: '0.82rem' }}>
                            • {it.title} <span style={{ color: 'var(--accent-gold)' }}>(ไซส์ {it.size} x {it.qty || 1} ตัว)</span>
                            {it.customName && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-gold-bright)', paddingLeft: '8px' }}>
                                ปักชื่อ: {it.customName} <span style={{ color: '#F5D061', fontWeight: 'bold' }}>(+฿20)</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </td>

                      <td style={{ padding: '10px', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        {(() => {
                          const calcTotal = getOrderTotal(o);
                          const isFullyPaid = o.remainingPaidStatus === 'approved' || o.isTeacher || o.role === 'teacher' || o.remaining === 0 || (o.deposit && o.deposit >= calcTotal);
                          const effectiveDeposit = isFullyPaid ? calcTotal : (o.deposit || 50);
                          const effectiveRemaining = isFullyPaid ? 0 : Math.max(0, calcTotal - effectiveDeposit);

                          return isFullyPaid ? (
                            <>
                              <div style={{ color: '#22c55e', fontWeight: 'bold' }}>ชำระเต็มจำนวน: ฿{calcTotal.toLocaleString()}</div>
                              <div style={{ color: o.isTeacher || o.role === 'teacher' ? '#38bdf8' : '#22c55e', fontSize: '0.78rem' }}>
                                {o.isTeacher || o.role === 'teacher' ? 'อาจารย์ / บุคลากร 👨‍🏫' : '✅ ชำระครบ 100% แล้ว'}
                              </div>
                              <div style={{ color: '#22c55e', fontSize: '0.78rem' }}>✓ ไม่มียอดค้างชำระ</div>
                            </>
                          ) : (
                            <>
                              <div style={{ color: '#22c55e', fontWeight: 'bold' }}>มัดจำแล้ว: ฿{effectiveDeposit.toLocaleString()}</div>
                              <div style={{ color: 'var(--text-sub)' }}>ยอดเต็ม: ฿{calcTotal.toLocaleString()}</div>
                              <div style={{ color: '#eab308' }}>ค้าง: ฿{effectiveRemaining.toLocaleString()}</div>
                            </>
                          );
                        })()}
                      </td>

                      <td style={{ padding: '10px' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ 
                            padding: '4px 10px', 
                            fontSize: '0.78rem', 
                            borderColor: o.slipUrl ? '#22c55e' : 'var(--accent-gold)', 
                            color: o.slipUrl ? '#22c55e' : 'var(--accent-gold-bright)',
                            background: o.slipUrl ? 'rgba(34,197,94,0.1)' : 'transparent'
                          }}
                          onClick={() => setPreviewSlipOrder(o)}
                        >
                          {o.slipUrl ? '🖼️ ดูรูปสลิปจากลูกค้า (DB)' : '📄 ดูข้อมูลสลิปโอนเงิน'}
                        </button>

                        {o.remainingPaidStatus === 'approved' ? (
                          <div style={{ marginTop: '6px', background: 'rgba(34,197,94,0.18)', border: '1px solid #22c55e', color: '#22c55e', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', textAlign: 'center' }}>
                            ✅ ชำระส่วนที่เหลือครบ 100% (อนุมัติแล้ว)
                          </div>
                        ) : o.remainingSlipUrl || o.remainingPaidStatus === 'pending_verification' ? (
                          <div style={{ marginTop: '6px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', padding: '6px', borderRadius: '6px' }}>
                            <button 
                              className="btn" 
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.75rem', 
                                border: '1px solid #38bdf8', 
                                color: '#fff',
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'block',
                                width: '100%',
                                marginBottom: '4px'
                              }}
                              onClick={() => setPreviewSlipOrder({ ...o, slipUrl: o.remainingSlipUrl, isRemainingSlip: true })}
                            >
                              🔍 ดูสลิปส่วนที่เหลือ (฿{(o.remainingAmountPaid || 0).toLocaleString()})
                            </button>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button 
                                onClick={() => handleVerifyRemainingDeposit(o)}
                                style={{ flex: 1, padding: '4px 6px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold' }}
                              >
                                ⚡ อนุมัติ
                              </button>
                              <button 
                                onClick={() => handleRejectRemainingDeposit(o)}
                                style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold' }}
                              >
                                ❌ ปฏิเสธ
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: '10px' }}>
                        <select 
                          value={o.status || 'pending'}
                          onChange={(e) => handleStatusChange(o.id, e.target.value)}
                          style={{ 
                            background: '#090a0f', 
                            color: o.status === 'completed' ? '#22c55e' : o.status === 'shipping' ? '#38bdf8' : o.status === 'pending' ? '#f87171' : '#eab308',
                            border: '1px solid var(--border-gold)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontWeight: 'bold',
                            fontSize: '0.82rem'
                          }}
                        >
                          <option value="pending">0. รอตรวจสอบสลิป (Pending)</option>
                          <option value="paid">1. ชำระเงินแล้ว (Paid)</option>
                          <option value="preparing">2. กำลังผลิต/ปักลาย (Preparing)</option>
                          <option value="shipping">3. จัดส่งแล้ว (Shipping)</option>
                          <option value="completed">4. รับสินค้าสำเร็จ (Completed)</option>
                        </select>

                        <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
                          <input 
                            type="text" 
                            placeholder="เลขพัสดุ..." 
                            defaultValue={o.trackingNumber || ''}
                            onChange={(e) => setEditingTracking({ ...editingTracking, [o.id]: e.target.value })}
                            style={{ background: '#000', border: '1px solid #333', color: '#fff', fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px', width: '100px' }}
                          />
                          <button 
                            onClick={() => handleTrackingSave(o.id)}
                            style={{ background: 'var(--accent-gold)', border: 'none', color: '#000', fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            บันทึก
                          </button>
                        </div>
                       </td>
                       <td style={{ padding: '10px' }}>
                         <button
                           className="btn btn-outline"
                           style={{
                             background: 'rgba(255,77,79,0.1)',
                             borderColor: '#ff4d4f',
                             color: '#ff4d4f',
                             padding: '4px 8px',
                             fontSize: '0.78rem'
                           }}
                           onClick={() => handleDelete(o.id)}
                         >🗑️ ลบออเดอร์</button>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* Slip Preview Sub-Modal */}
      {previewSlipOrder && (
        <div className="modal-backdrop show" onClick={() => setPreviewSlipOrder(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200000, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1, pointerEvents: 'auto', padding: '16px' }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ position: 'relative', zIndex: 200001, maxWidth: '440px', width: '100%', padding: '18px', background: '#0a0b10', border: '1px solid var(--accent-gold)', borderRadius: '16px', textAlign: 'center', opacity: 1, visibility: 'visible', boxShadow: '0 25px 70px rgba(0,0,0,0.95)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ color: 'var(--accent-gold-bright)', fontSize: '1.05rem' }}>📸 สลิปหลักฐานการโอนเงิน (Payment Slip)</h4>
              <button className="close-btn" onClick={() => setPreviewSlipOrder(null)}>&times;</button>
            </div>
            
            {previewSlipOrder.slipUrl && previewSlipOrder.slipUrl !== 'assets/promptpay_qr.png' ? (
              <img 
                src={previewSlipOrder.slipUrl} 
                alt="Customer Payment Slip" 
                style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} 
              />
            ) : (
              <div style={{ background: '#ffffff', color: '#000', borderRadius: '12px', padding: '18px', textAlign: 'left', fontFamily: 'Kanit, sans-serif', boxShadow: '0 8px 25px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #22c55e', paddingBottom: '10px', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ color: '#22c55e', margin: 0, fontSize: '1.1rem' }}>✓ โอนเงินสำเร็จ (PromptPay)</h4>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>สลิปหลักฐานการโอนเงิน</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#000' }}>{previewSlipOrder.date}</span>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666', display: 'block' }}>ผู้โอน (Sender)</span>
                  <strong style={{ fontSize: '0.95rem' }}>{previewSlipOrder.name}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#333', display: 'block' }}>รหัสนักศึกษา: {previewSlipOrder.studentId}</span>
                </div>

                <div style={{ marginBottom: '10px', borderTop: '1px dashed #ccc', paddingTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666', display: 'block' }}>ผู้รับเงิน (Receiver)</span>
                  <strong style={{ fontSize: '0.95rem' }}>ด.ช. ธีรเดช ไพฑูรย์</strong>
                  <span style={{ fontSize: '0.8rem', color: '#333', display: 'block' }}>พร้อมเพย์: xxx-x-x4613-x</span>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginTop: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>จำนวนเงินโอนสุทธิ</span>
                  <h3 style={{ color: '#0f172a', fontSize: '1.4rem', margin: '2px 0' }}>฿{previewSlipOrder.total ? previewSlipOrder.total.toLocaleString() : '0'}.00</h3>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>เลขที่อ้างอิง: {previewSlipOrder.trackingNumber || previewSlipOrder.id}</span>
                </div>
              </div>
            )}

            <button className="btn btn-gold" onClick={() => setPreviewSlipOrder(null)} style={{ marginTop: '14px', width: '100%' }}>ปิดหน้าต่าง</button>
          </div>
        </div>
      )}

    </div>
  );
}

// 10. FOOTER COMPONENT
function Footer() {
  const { currentUser } = useContext(AuthContext);
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          
          <div className="footer-brand">
            <div className="brand-logo" style={{ marginBottom: '12px' }}>
              <img src="assets/logo.png" alt="CPE Logo" className="brand-icon" />
              <div className="brand-text">
                <h1>COMPUTER ENGINEERING</h1>
                <span>FACULTY OF ENGINEERING PSRU</span>
              </div>
            </div>
            <p>
              ระบบสั่งจองเสื้อโปโลสาขาและเสื้อคลุม CPE 69 สำหรับนักศึกษาและบุคลากร สาขาวิชาวิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยราชภัฏพิบูลสงคราม
            </p>
          </div>

          <div className="footer-column">
            <h4>ลิงก์ด่วน</h4>
            <ul className="footer-links">
              <li><a href="#hero">หน้าแรก</a></li>
              <li><a href="#ordering">สั่งซื้อเสื้อโปโล &amp; เสื้อคลุม</a></li>
              {currentUser && <li><a href="#tracking">ตรวจสอบสถานะการสั่งซื้อ</a></li>}
            </ul>
          </div>

          <div className="footer-column">
            <h4>ช่องทางติดต่อ &amp; Credits</h4>
            <div className="social-credits">
              <a href="https://instagram.com/trd_shel" target="_blank" className="social-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                @trd_shel
              </a>
              <a href="https://instagram.com/s.peeranart" target="_blank" className="social-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                @s.peeranart
              </a>
            </div>
          </div>

        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Computer Engineering Faculty of Engineering PSRU. All rights reserved. Powered by React &amp; Firebase Cloud Database.</p>
        </div>
      </div>
    </footer>
  );
}

// Render React App into #root
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
