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

// Create Auth Context
const AuthContext = createContext();

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
    largeFee: 10,
    originalPrice: 350,
    badgeText: 'ราคาเต็ม ฿350',
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
    largeFee: 10,
    originalPrice: 350,
    badgeText: 'ราคา ฿350',
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
  { id: '3XL', label: '3XL (46")', chest: '46"', isLarge: true },
  { id: '4XL', label: '4XL (48")', chest: '48"', isLarge: true }
];

// Main React App Provider & Root
function App() {
  const [currentUser, setCurrentUser] = useState(null);
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
  
  const [selectedProductKey, setSelectedProductKey] = useState('polo');

  // Adjust default product based on student ID (67/68 → polo only, 69 → jacket only)
  useEffect(() => {
    if (!isAdmin && currentUser?.studentId) {
      if (currentUser.studentId.startsWith('68') || currentUser.studentId.startsWith('67')) setSelectedProductKey('polo');
      else if (currentUser.studentId.startsWith('69')) setSelectedProductKey('jacket');
    }
  }, [currentUser, isAdmin]);
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

  // Auto load recent order on page load / refresh if trackedOrder not set
  useEffect(() => {
    if (!trackedOrder && myOrdersHistory.length > 0) {
      setTrackedOrder(myOrdersHistory[0]);
      if (myOrdersHistory[0].id) setSearchTrackingQuery(myOrdersHistory[0].id);
    }
  }, [myOrdersHistory]);

  const getSanitizedSavedUser = () => {
    const savedUser = localStorage.getItem('cpe_current_user');
    if (!savedUser) return null;
    try {
      const parsed = JSON.parse(savedUser);
      if (parsed && parsed.email && parsed.email !== '6812345678@psru.ac.th' && parsed.studentId === '6812345678') {
        parsed.studentId = parsed.email.split('@')[0];
        localStorage.setItem('cpe_current_user', JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {
      return null;
    }
  };

  // Firebase Auth Listener
  useEffect(() => {
    const fb = window.CPEFirebase || {};
    if (!fb.auth || !fb.onAuthStateChanged) {
      const user = getSanitizedSavedUser();
      setCurrentUser(user);
      return;
    }

    const unsubscribe = fb.onAuthStateChanged(fb.auth, async (user) => {
      if (user) {
        try {
          if (fb.getDoc && fb.doc && fb.db) {
            const userDoc = await fb.getDoc(fb.doc(fb.db, 'users', user.uid));
            if (userDoc.exists()) {
              const uData = { uid: user.uid, ...userDoc.data() };
              setCurrentUser(uData);
              localStorage.setItem('cpe_current_user', JSON.stringify(uData));
            } else {
              const saved = getSanitizedSavedUser();
              if (saved && (saved.uid === user.uid || saved.email === user.email)) {
                setCurrentUser(saved);
                return;
              }
              const derivedStudentId = user.email && user.email.includes('@') ? user.email.split('@')[0] : '';
              const newUser = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || 'นักศึกษา CPE',
                studentId: derivedStudentId
              };
              setCurrentUser(newUser);
              localStorage.setItem('cpe_current_user', JSON.stringify(newUser));
            }
          }
        } catch (e) {
          console.log("Firestore user fetch error:", e);
        }
      } else {
        const saved = getSanitizedSavedUser();
        setCurrentUser(saved);
      }
    });

    return () => unsubscribe();
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
              {currentUser && (
                <button
                  onClick={() => setIsExtraDepositModalOpen(true)}
                  style={{ background: 'none', border: 'none', color: '#f5d061', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, padding: '4px 8px', textDecoration: 'underline dotted' }}
                >
                  💳 จ่ายมัดจำเพิ่ม
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
                <div className="user-profile-menu">
                  <button className={`user-avatar-btn ${isAdmin ? 'admin-badge' : ''}`} onClick={() => {
                    const menu = document.getElementById('reactDropdownMenu');
                    if (menu) menu.classList.toggle('show');
                  }}>
                    <div className={`user-avatar-img ${isAdmin ? 'admin-avatar' : ''}`}>
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="user-name">{currentUser.name || 'นักศึกษา CPE'}</span>
                  </button>

                  <div id="reactDropdownMenu" className="dropdown-menu">
                    <div className="dropdown-header">
                      <strong>{currentUser.name}</strong>
                      <p>รหัส: {currentUser.studentId || '6812345678'}</p>
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
                    <div 
                      onClick={() => {
                        setIsExtraDepositModalOpen(true);
                        const menu = document.getElementById('reactDropdownMenu');
                        if (menu) menu.classList.remove('show');
                      }} 
                      className="dropdown-item" 
                      style={{ cursor: 'pointer', color: '#22c55e' }}
                    >
                      💳 จ่ายมัดจำเพิ่ม (100 บาท)
                    </div>
                    <div onClick={handleLogout} className="dropdown-item text-danger" style={{ cursor: 'pointer' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                      ออกจากระบบ
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* HERO BANNER AUTO ROTATING SLIDER */}
        <HeroSlider onSelectProduct={selectProductFromBanner} isExpired={isExpired} showToast={showToast} />

        {/* COUNTDOWN TIMER BANNER (BELOW HERO BANNER) */}
        {(() => { window._effectiveDeadline = effectiveDeadline; return null; })()}
        <CountdownBanner isExpired={isExpired} timeLeft={timeLeft} salesMode={salesSettings.salesMode} effectiveDeadline={effectiveDeadline} />

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
        />

        {/* ORDER TRACKING LOOKUP SECTION */}
        {currentUser && (
          <OrderTracking 
            searchQuery={searchTrackingQuery}
            setSearchQuery={setSearchTrackingQuery}
            trackedOrder={trackedOrder}
            setTrackedOrder={setTrackedOrder}
            myOrdersHistory={myOrdersHistory}
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

        {/* EXTRA DEPOSIT MODAL */}
        <ExtraDepositModal
          isOpen={isExtraDepositModalOpen}
          onClose={() => setIsExtraDepositModalOpen(false)}
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

// 1. HERO SLIDER COMPONENT
function HeroSlider({ onSelectProduct, isExpired, showToast }) {
  const { currentUser } = useContext(AuthContext);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 2);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="hero" className="hero-section">
      <div className="container">
        <div className="banner-container">
          
          <div className="banner-slider">
            {/* Slide 0: Polo Shirts */}
            <div className={`banner-slide ${currentSlide === 0 ? 'active' : ''}`}>
              <img src="assets/banner.png" alt="CPE Polo Shirts Banner" className="banner-img" />
              <div className="banner-overlay-bar">
                <div className="banner-tagline">
                  <span className="tech-pill">CPE BATCH LXVIII</span>
                  <div className="banner-text-content">
                    <h2>ดีไซน์เรียบเท่ โดดเด่นในสไตล์วิศวกรรมคอมพิวเตอร์ (เสื้อโปโล ฿350)</h2>
                  </div>
                </div>
                <div className="banner-cta-group">
                  <button 
                    onClick={() => {
                      if (isExpired) {
                        if (showToast) showToast('🚫 ระบบปิดรับการสั่งซื้อเสื้อแล้ว (หมดเวลาสั่งจองเมื่อ 14:40 น.)', 'error');
                        return;
                      }
                      onSelectProduct('polo');
                    }} 
                    className="btn btn-gold"
                    style={{ opacity: isExpired ? 0.6 : 1 }}
                  >
                    {isExpired ? '⛔ ปิดรับการสั่งซื้อแล้ว' : 'สั่งซื้อเสื้อโปโลสาขา'}
                  </button>
                  {currentUser && <a href="#tracking" className="btn btn-outline">เช็คสถานะออเดอร์</a>}
                </div>
              </div>
            </div>

            {/* Slide 1: CPE Navy Polo Poster */}
            <div className={`banner-slide ${currentSlide === 1 ? 'active' : ''}`}>
              <img src="assets/polo_navy_banner.jpg" alt="CPE Polo Navy Banner" className="banner-img" />
              <div className="banner-overlay-bar">
                <div className="banner-tagline">
                  <span className="tech-pill">CPE POLO SHIRT (NAVY BLUE)</span>
                  <div className="banner-text-content">
                    <h2>เสื้อโปโลสาขารุ่นใหม่ สีกรมท่า ดีไซน์เรียบหรู ใส่สบาย (ราคา ฿350)</h2>
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

          <button onClick={() => setCurrentSlide(prev => (prev === 0 ? 1 : 0))} className="slider-arrow prev">&#10094;</button>
          <button onClick={() => setCurrentSlide(prev => (prev === 1 ? 0 : 1))} className="slider-arrow next">&#10095;</button>

          <div className="slider-dots">
            <span className={`dot ${currentSlide === 0 ? 'active' : ''}`} onClick={() => setCurrentSlide(0)}></span>
            <span className={`dot ${currentSlide === 1 ? 'active' : ''}`} onClick={() => setCurrentSlide(1)}></span>
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
function ProductConfigurator({ selectedProductKey, setSelectedProductKey, cart, setCart, setIsSizeGuideOpen, setIsCartOpen, isExpired }) {
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
  const showPolo = isAdmin || !userStudentId || userStudentId.startsWith('68') || userStudentId.startsWith('67') || (!userStudentId.startsWith('68') && !userStudentId.startsWith('69') && !userStudentId.startsWith('67'));
  const showJacket = isAdmin || !userStudentId || userStudentId.startsWith('69') || (!userStudentId.startsWith('68') && !userStudentId.startsWith('69') && !userStudentId.startsWith('67'));

  useEffect(() => {
    if (currentUser?.studentId) setStudentIdInput(currentUser.studentId);
  }, [currentUser]);

  useEffect(() => {
    if ((selectedProductKey === 'polo' || selectedProductKey === 'polo_navy') && currentView === 'sleeve') {
      setCurrentView('front');
    }
  }, [selectedProductKey]);

  const prod = PRODUCTS[selectedProductKey] || PRODUCTS.polo;

  // Calculate Total Price dynamically across all items
  const totalPrice = itemsConfig.reduce((sum, item) => {
    let itemPrice = prod.basePrice;
    if (['3XL', '4XL'].includes(item.size)) {
      itemPrice += prod.largeFee;
    }
    if (item.customName && item.customName.trim() !== '') {
      itemPrice += 20;
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
    if (!studentIdInput.trim() || studentIdInput.trim().length !== 10) {
      showToast('กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)', 'error');
      return;
    }

    const newCartItems = itemsConfig.map((itemCfg, idx) => {
      let itemPrice = prod.basePrice;
      if (['3XL', '4XL'].includes(itemCfg.size)) {
        itemPrice += prod.largeFee;
      }
      if (itemCfg.customName && itemCfg.customName.trim() !== '') {
        itemPrice += 20;
      }
      return {
        id: Date.now() + idx,
        productKey: selectedProductKey,
        title: prod.title,
        size: itemCfg.size,
        qty: 1,
        customName: itemCfg.customName.trim(),
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
          <h2 className="title">สั่งซื้อเสื้อโปโล &amp; เสื้อคลุมสาขาวิศวกรรมคอมพิวเตอร์</h2>
        </div>

        {/* Product Selector Switcher Tabs - restricted by student ID */}
        <div className="product-select-tabs">
          {showPolo && (
            <button
              className={`product-tab-btn ${selectedProductKey === 'polo' ? 'active' : ''}`}
              onClick={() => setSelectedProductKey('polo')}
            >
              <span>👕 เสื้อโปโลสาขา CPE (LXVIII) - ฿350</span>
            </button>
          )}
          {showPolo && (
            <button
              className={`product-tab-btn ${selectedProductKey === 'polo_navy' ? 'active' : ''}`}
              onClick={() => setSelectedProductKey('polo_navy')}
            >
              <span>👕 เสื้อโปโลสาขา (สีกรมท่า Navy Blue) - ฿350</span>
            </button>
          )}
          {showJacket && (
            <button
              className={`product-tab-btn ${selectedProductKey === 'jacket' ? 'active' : ''}`}
              onClick={() => setSelectedProductKey('jacket')}
            >
              <span>🧥 เสื้อคลุมสาขา CPE 69 (LXIX) - ฿920</span>
            </button>
          )}
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
                  {customName.trim() && (
                    <div style={{
                      position: 'absolute',
                      bottom: '15px',
                      background: 'rgba(139,12,26,0.92)',
                      border: '1px solid var(--accent-gold)',
                      color: 'var(--accent-gold-bright)',
                      padding: '6px 16px',
                      borderRadius: '20px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      boxShadow: '0 4px 15px rgba(0,0,0,0.7)',
                      zIndex: 10
                    }}>
                      ปักชื่อ: {customName.trim()}
                    </div>
                  )}
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
                      <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: (['3XL', '4XL'].includes(item.size) || (item.customName && item.customName.trim() !== '')) ? '#F5D061' : '#22c55e' }}>
                        ฿{prod.basePrice + (['3XL', '4XL'].includes(item.size) ? prod.largeFee : 0) + (item.customName && item.customName.trim() !== '' ? 20 : 0)}
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
                  <div style={{ marginBottom: '14px' }}>
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

                  {/* Custom Embroidery Input */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>ปักชื่ออกเสื้อ {qty > 1 ? `(ตัวที่ ${idx + 1})` : ''}:</span>
                      <span style={{ color: item.customName && item.customName.trim() !== '' ? '#F5D061' : 'var(--text-sub)', fontWeight: item.customName && item.customName.trim() !== '' ? 600 : 400 }}>
                        {item.customName && item.customName.trim() !== '' ? '+฿20' : 'คิดเพิ่ม +฿20'}
                      </span>
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ height: '38px', fontSize: '0.85rem' }}
                      placeholder={`ตัวอย่าง: ต้อม CPE68 ${qty > 1 ? `(ตัวที่ ${idx + 1})` : '(ปล่อยว่างถ้าไม่ปัก)'}`}
                      value={item.customName}
                      onChange={e => updateItemConfig(idx, 'customName', e.target.value)}
                    />
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
function OrderTracking({ searchQuery, setSearchQuery, trackedOrder, setTrackedOrder, myOrdersHistory = [] }) {
  const { showToast } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [foundOrders, setFoundOrders] = useState([]);

  // Sync found orders with myOrdersHistory on change
  useEffect(() => {
    if (myOrdersHistory && myOrdersHistory.length > 0) {
      setFoundOrders(myOrdersHistory);
    }
  }, [myOrdersHistory]);

  // Real-time order update listener
  useEffect(() => {
    if (!trackedOrder || !trackedOrder.firestoreId || !db) return;
    const unsub = onSnapshot(doc(db, 'orders', trackedOrder.firestoreId), (docSnap) => {
      if (docSnap.exists()) {
        const updated = { firestoreId: docSnap.id, ...docSnap.data() };
        setTrackedOrder(prev => ({ ...prev, ...updated }));
        setFoundOrders(prevList => prevList.map(o => (o.firestoreId === docSnap.id || o.id === updated.id) ? { ...o, ...updated } : o));
      }
    });
    return () => unsub();
  }, [trackedOrder?.firestoreId]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) {
      showToast('กรุณากรอกเลขที่ออเดอร์ หรือ รหัสนักศึกษา 10 หลัก', 'error');
      return;
    }

    setLoading(true);
    try {
      // Query Firestore
      const ordersRef = collection(db, 'orders');
      let q = query(ordersRef, where('id', '==', queryStr));
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        q = query(ordersRef, where('studentId', '==', queryStr));
        querySnapshot = await getDocs(q);
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
    try {
      await deleteDoc(doc(db, 'orders', trackedOrder.firestoreId));
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
  const { showToast } = useContext(AuthContext);
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
            <span>💰 ค่ามัดจำ (ชำระตอนนี้)</span>
            <span style={{ color: '#22c55e', fontSize: '1.3rem', fontWeight: 'bold' }}>฿50</span>
          </div>
          <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', padding: '8px 10px', marginTop: '6px', fontSize: '0.78rem', color: '#eab308' }}>
            ⚠️ ชำระค่ามัดจำ 50 บาท/ออเดอร์ • ส่วนที่เหลือจะแจ้งอีกที
          </div>

          <button 
            className="btn btn-gold" 
            style={{ width: '100%', marginTop: '15px' }}
            disabled={cart.length === 0}
            onClick={onCheckout}
          >
            ดำเนินการชำระค่ามัดจำ ฿50
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
    if (studentId.length !== 10) {
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
      const authEmail = `${studentId}@psru.ac.th`;

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
              const authEmail = `${studentId}@psru.ac.th`;
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
        phone: phone,
        email: email,
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
          <span className="auth-brand-sub">68 &times; 69 &middot; UNIFORM PORTAL</span>
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
                  <label>รหัสนักศึกษา (10 หลัก) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="6812345678"
                    maxLength={10}
                    value={regStudentId}
                    onChange={e => setRegStudentId(e.target.value.replace(/\D/g, ''))}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>ชั้นปี / รุ่น <span style={{ color: '#ef4444' }}>*</span></label>
                  <select 
                    className="form-input" 
                    style={{ height: '44px' }}
                    value={regYear}
                    onChange={e => setRegYear(e.target.value)}
                  >
                    <option value="1">ปี 1 (CPE69)</option>
                    <option value="2">ปี 2 (CPE68)</option>
                    <option value="3">ปี 3 (CPE67)</option>
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

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setCheckoutName(currentUser.name);
      if (currentUser.studentId) setCheckoutStudentId(currentUser.studentId);
      if (currentUser.phone) setCheckoutPhone(currentUser.phone);
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

  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const orderId = 'CPE-2026-' + Math.floor(1000 + Math.random() * 9000);

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
    if (!checkoutName || !checkoutStudentId || checkoutStudentId.length !== 10 || !checkoutPhone) {
      showToast('กรุณากรอกข้อมูลและรหัสนักศึกษา 10 หลักให้ครบถ้วน', 'error');
      return;
    }
    if (!slipDataUrl) {
      showToast('กรุณาอัพโหลดสลิปการโอนเงินก่อนดำเนินการ', 'error');
      return;
    }

    setIsSubmitting(true);

    const depositAmount = hasExistingOrder ? 150 : 50;
    const newOrder = {
      id: orderId,
      userUid: currentUser?.uid || null,
      studentId: checkoutStudentId,
      name: checkoutName,
      phone: checkoutPhone,
      items: cart,
      total: totalAmount,
      deposit: depositAmount,
      remaining: totalAmount - depositAmount,
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
            {hasExistingOrder ? '💳 ชำระค่ามัดจำ 150 บาท (สแกน QR Code)' : '💰 ชำระค่ามัดจำ 50 บาท (สแกน QR Code)'}
          </h3>
          <button className="close-btn" onClick={onClose} style={{ color: '#fff', fontSize: '1.8rem' }}>&times;</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <form onSubmit={handleSubmitOrder}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              
              {/* Left: PromptPay QR Code */}
              <div style={{ flex: '1 1 300px' }}>
                <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '10px' }}>1. สแกน QR Code ชำระค่ามัดจำ</h4>
                <div style={{ background: '#fff', padding: '14px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.5)' }}>
                  {checkingExisting ? (
                    <div style={{ padding: '40px 0', color: '#888', fontSize: '0.9rem' }}>⏳ กำลังตรวจสอบออเดอร์เดิม...</div>
                  ) : (
                    <img 
                      src={hasExistingOrder ? 'assets/extra_deposit_qr.png' : 'assets/deposit_qr.png'}
                      alt={hasExistingOrder ? 'QR Code ชำระมัดจำ 150 บาท' : 'QR Code ชำระมัดจำ 50 บาท'}
                      style={{ width: '100%', maxWidth: '260px', height: 'auto', margin: '0 auto', display: 'block', borderRadius: '8px' }}
                    />
                  )}
                  <div style={{ background: '#0f1017', border: `1px solid ${hasExistingOrder ? '#f59e0b' : '#22c55e'}`, borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                    <p style={{ color: hasExistingOrder ? '#f59e0b' : '#22c55e', fontWeight: '700', fontSize: '1.4rem', margin: 0 }}>
                      {hasExistingOrder ? '💳 ค่ามัดจำ: ฿150 (รวม +฿100 สำหรับออเดอร์เพิ่ม)' : '💰 ค่ามัดจำ: ฿50'}
                    </p>
                    <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: '4px', margin: 0 }}>
                      ยอดรวมทั้งหมด: ฿{totalAmount.toLocaleString()} (ส่วนที่เหลือ ฿{(totalAmount - (hasExistingOrder ? 150 : 50)).toLocaleString()} จะแจ้งอีกที)
                    </p>
                  </div>
                  {hasExistingOrder && (
                    <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px', marginTop: '10px', textAlign: 'left' }}>
                      <p style={{ color: '#fbbf24', fontSize: '0.8rem', margin: 0, fontWeight: 600 }}>
                        ⚠️ คุณมีออเดอร์เดิมอยู่แล้ว จึงต้องชำระมัดจำเพิ่มอีก ฿100 รวมเป็น ฿150 ทั้งหมด — กรุณาสแกน QR ด้านบนและอัพโหลดสลิป
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Student Receiver Info & Slip Upload */}
              <div style={{ flex: '1 1 300px' }}>
                <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '10px' }}>2. ข้อมูลผู้รับเสื้อ &amp; หลักฐาน</h4>
                
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
                  <label style={{ color: '#fff' }}>รหัสนักศึกษา (10 หลัก)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    maxLength={10}
                    value={checkoutStudentId}
                    onChange={e => setCheckoutStudentId(e.target.value.replace(/\D/g, ''))}
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
                  <label style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>แนบสลิปค่ามัดจำ 50 บาท</label>
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
                  {isSubmitting ? 'กำลังบันทึกลง Firebase...' : 'ยืนยันการชำระค่ามัดจำ ฿50'}
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
              <tr><td><strong>SS - 2XL</strong></td><td>34" - 44"</td><td>25" - 30"</td><td>350 บาท</td></tr>
              <tr><td><strong>3XL - 4XL</strong> <span style={{ fontSize: '0.75rem', color: '#F5D061' }}>(+10฿)</span></td><td>46" - 48"</td><td>31" - 32"</td><td><strong style={{ color: '#F5D061' }}>360 บาท</strong></td></tr>
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
            💡 คำแนะนำ: เสื้อโปโล 3XL - 4XL เพิ่ม 10฿ / เสื้อคลุม Jacket 3XL - 4XL เพิ่ม 100฿ | บริการปักชื่อฟรี
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

  useEffect(() => {
    if (currentUser?.studentId) {
      setStudentId(currentUser.studentId);
    }
  }, [currentUser]);

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

  const handleSearch = async () => {
    if (!studentId || studentId.length < 8) {
      showToast('กรุณากรอกรหัสนักศึกษา 8-10 หลัก', 'error');
      return;
    }
    setSearching(true);
    setFoundOrders([]);
    try {
      const fb = window.CPEFirebase || {};
      if (fb.db && fb.collection && fb.query && fb.where && fb.getDocs) {
        const q = fb.query(fb.collection(fb.db, 'orders'), fb.where('studentId', '==', studentId));
        const snap = await fb.getDocs(q);
        const results = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        setFoundOrders(results);
        if (results.length === 0) showToast('ไม่พบออเดอร์ในระบบ ตรวจสอบรหัสอีกครั้ง', 'error');
        else if (results.length === 1) setSelectedOrderId(results[0].id || results[0].firestoreId);
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
    }
    setSearching(false);
  };

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
                <button type="submit" disabled={isSubmitting || !slipDataUrl || !selectedOrderId} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #f5d061, #d4af37)', color: '#000', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(245,208,97,0.4)' }}>
                  {isSubmitting ? '⏳ กำลังส่ง...' : '💳 ยืนยันการจ่ายมัดจำเพิ่ม 100 บาท'}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// 9. ADMIN DASHBOARD MODAL COMPONENT (Admin ID: 6800000000)
function AdminDashboardModal({ isOpen, onClose }) {
  const { showToast } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [previewSlipOrder, setPreviewSlipOrder] = useState(null);
  const [editingTracking, setEditingTracking] = useState({});
  const [activeBreakdownTab, setActiveBreakdownTab] = useState('summary');
  const [salesMode, setSalesMode] = useState('auto');
  const [customDeadline, setCustomDeadline] = useState('2026-08-08T14:40');
  const [savingSettings, setSavingSettings] = useState(false);
  const [extraDeposits, setExtraDeposits] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.collection || !fb.onSnapshot) return;
    let unsub = () => {};
    try {
      const q = fb.collection(fb.db, 'extra_deposits');
      unsub = fb.onSnapshot(q, (snap) => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setExtraDeposits(list);
      });
    } catch (e) { console.log(e); }
    return () => unsub();
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

  const handleVerifyExtraDeposit = async (depItem) => {
    const fb = window.CPEFirebase || {};
    if (!fb.db || !fb.setDoc || !fb.doc) return;
    try {
      // 1. Mark extra deposit as verified
      await fb.setDoc(fb.doc(fb.db, 'extra_deposits', depItem.id), {
        status: 'verified',
        verifiedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Find target order and deduct remaining balance / update deposit
      const targetOrder = orders.find(o => o.id === depItem.orderRef || o.firestoreId === depItem.orderRef);
      if (targetOrder && targetOrder.firestoreId) {
        const newDeposit = (targetOrder.deposit || 50) + (depItem.amount || 100);
        const newRemaining = Math.max(0, (targetOrder.total || 0) - newDeposit);
        await fb.setDoc(fb.doc(fb.db, 'orders', targetOrder.firestoreId), {
          deposit: newDeposit,
          remaining: newRemaining
        }, { merge: true });
        showToast(`✅ ยืนยันสลิปมัดจำเพิ่มแล้ว! อัปเดตยอดมัดจำออเดอร์ ${targetOrder.id} เป็น ฿${newDeposit} (ค้าง ฿${newRemaining})`, 'success');
      } else {
        showToast('✅ ยืนยันสลิปมัดจำเพิ่มเรียบร้อยแล้ว!', 'success');
      }
    } catch (e) {
      console.log('Verify extra deposit error:', e);
      showToast('เกิดข้อผิดพลาดในการยืนยันสลิป', 'error');
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    let unsub = () => {};

    try {
      const fb = window.CPEFirebase || {};
      if (!fb.db || !fb.collection || !fb.query || !fb.onSnapshot) {
        setLoading(false);
        return;
      }

      const ordersRef = fb.collection(fb.db, 'orders');
      const q = fb.orderBy ? fb.query(ordersRef, fb.orderBy('date', 'desc')) : fb.query(ordersRef);
      unsub = fb.onSnapshot(q, (querySnapshot) => {
        let firestoreList = [];
        querySnapshot.forEach((docSnap) => {
          firestoreList.push({ firestoreId: docSnap.id, ...docSnap.data() });
        });
        setOrders(firestoreList);
        setLoading(false);
      }, (err) => {
        console.log("Realtime orders snapshot error:", err);
        setLoading(false);
      });
    } catch (e) {
      console.log("Firestore real-time listener setup error:", e);
      setLoading(false);
    }

    return () => unsub();
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
    const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

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

  const exportSizeSummaryPDF = () => {
    if (!orders || orders.length === 0) {
      showToast('ไม่มีข้อมูลออเดอร์ในการส่งออก', 'error');
      return;
    }

    const sizeSummary = {};
    const itemizedList = [];
    const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

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
            product,
            size,
            qty,
            name: o.name || 'นักศึกษา',
            studentId: o.studentId || '',
            customName: it.customName || 'ไม่ปักชื่อ'
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

    const todayStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อเปิด PDF', 'error');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>ใบสรุปรายการสั่งผลิตเสื้อ & ข้อความปัก (ส่งร้าน)</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
          body { font-family: 'Sarabun', sans-serif; color: #000; background: #fff; padding: 24px; margin: 0; font-size: 13px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
          .header h2 { margin: 0 0 4px 0; font-size: 19px; color: #000; }
          .header p { margin: 0; font-size: 12px; color: #444; }
          .section-title { font-size: 15px; font-weight: bold; margin: 16px 0 8px 0; background: #f0f0f0; padding: 6px 10px; border-left: 4px solid #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: center; font-size: 12px; }
          th { background: #e8e8e8; font-weight: bold; }
          td.left { text-align: left; }
          .total-row { background: #f5f5f5; font-weight: bold; }
          .custom-name-cell { font-weight: bold; color: #000; background: #fafafa; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 18px; font-size: 13px; font-weight: bold; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
            🖨️ พิมพ์เอกสาร / บันทึกเป็น PDF (Save as PDF)
          </button>
        </div>

        <div class="header">
          <h2>ใบสรุปยอดสั่งผลิตเสื้อ & รายการปักชื่อ (สำหรับส่งโรงงาน/ร้านปัก)</h2>
          <p>สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏพิบูลสงคราม</p>
          <p>วันที่ออกเอกสาร: ${todayStr}</p>
        </div>

        <div class="section-title">1. สรุปจำนวนยอดสั่งผลิตแยกตามประเภทสินค้าและไซส์ (Size Totals)</div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">รายการสินค้า / สี</th>
              ${allSizes.map(s => `<th>${s}</th>`).join('')}
              <th>รวมทั้งหมด (ตัว)</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => {
              const rowTotal = allSizes.reduce((sum, s) => sum + (sizeSummary[p][s] || 0), 0);
              return `
                <tr>
                  <td class="left" style="font-weight: bold;">${p}</td>
                  ${allSizes.map(s => `<td>${sizeSummary[p][s] || 0}</td>`).join('')}
                  <td style="font-weight: bold;">${rowTotal}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td class="left">รวมทุกรายการสินค้า</td>
              ${allSizes.map(s => {
                const colTotal = products.reduce((sum, p) => sum + (sizeSummary[p][s] || 0), 0);
                return `<td>${colTotal}</td>`;
              }).join('')}
              <td style="font-size: 14px;">${itemizedList.reduce((sum, i) => sum + (i.qty || 1), 0)} ตัว</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">2. รายการข้อความปักชื่อแยกตามเสื้อและไซส์ (Embroidery Job Sheet)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">ลำดับ</th>
              <th style="text-align: left;">สินค้า / สี</th>
              <th style="width: 55px;">ไซส์</th>
              <th style="text-align: left;">ชื่อผู้สั่ง (รหัสนักศึกษา)</th>
              <th style="text-align: left;">ข้อความปักชื่อบนเสื้อ (ปักว่าอะไร)</th>
              <th style="width: 55px;">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            ${itemizedList.map((it, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td class="left">${it.product}</td>
                <td><strong>${it.size}</strong></td>
                <td class="left">${it.name} (${it.studentId})</td>
                <td class="left custom-name-cell">${it.customName || '- ไม่ปักชื่อ -'}</td>
                <td>${it.qty || 1} ตัว</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    showToast('📄 เปิดรายงาน PDF สำหรับส่งร้านเรียบร้อยแล้ว!', 'success');
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch = (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (o.studentId || '').includes(searchTerm) || 
                        (o.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    
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

  const totalRev = orders.reduce((sum, o) => {
    if (o.items && o.items.length > 0) {
      return sum + o.items.reduce((s, it) => {
        let p = it.totalPrice || it.price || 350;
        if (it.customName && it.customName.trim() !== '') {
          if (!it.totalPrice || it.totalPrice === 350 || it.totalPrice === 270) p = (p || 350) + 20;
        }
        return s + p;
      }, 0);
    }
    return sum + (o.total || 350);
  }, 0);

  const totalItemsCount = orders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.qty || 1), 0) : 1), 0);

  return (
    <div className="modal-backdrop show" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1, pointerEvents: 'auto', padding: '16px' }}>
      <div className="modal-card xl admin-modal-card" onClick={e => e.stopPropagation()} style={{ position: 'relative', zIndex: 10000, background: '#10121a', border: '1px solid var(--border-gold)', borderRadius: '16px', maxWidth: '1100px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', opacity: 1, visibility: 'visible' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #1b0a0e, #0a0b10)', borderBottom: '1px solid var(--accent-gold)', padding: '16px 24px' }}>
          <h3 className="modal-title" style={{ color: 'var(--accent-gold-bright)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>
            <span>👑 CPE ADMIN PORTAL (ผู้ดูแลระบบ: 6800000000)</span>
          </h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>ยอดมัดจำสะสมที่ได้รับ</span>
              <h3 style={{ color: '#22c55e', fontSize: '1.5rem', marginTop: '4px' }}>฿{(orders.reduce((sum, o) => sum + (o.deposit || 50), 0)).toLocaleString()}</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>ยอดขายรวมทั้งหมด: ฿{totalRev.toLocaleString()}</span>
            </div>
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>จำนวนออเดอร์ทั้งหมด</span>
              <h3 style={{ color: '#38bdf8', fontSize: '1.5rem', marginTop: '4px' }}>{orders.length} ออเดอร์</h3>
            </div>
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>ชำระเงินแล้ว / รอผลิต</span>
              <h3 style={{ color: '#eab308', fontSize: '1.5rem', marginTop: '4px' }}>
                {orders.filter(o => o.status === 'paid' || o.status === 'preparing').length} รายการ
              </h3>
            </div>
            <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>จำนวนเสื้อทั้งหมดที่สั่ง</span>
              <h3 style={{ color: '#22c55e', fontSize: '1.5rem', marginTop: '4px' }}>{totalItemsCount} ตัว</h3>
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
              { id: 'extra_deposit', label: '💳 มัดจำเพิ่ม 100 บาท', badgeBg: '#f59e0b' }
            ].map(tab => {
              const count = tab.id === 'deposit_summary' ? orders.length + extraDeposits.length : tab.id === 'extra_deposit' ? extraDeposits.length : tab.id === 'all' ? orders.length : orders.filter(o => {
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
            const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

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
                { id: 'pending', label: 'รอสลิป' },
                { id: 'paid', label: 'ชำระเงินแล้ว' },
                { id: 'preparing', label: 'กำลังผลิต' },
                { id: 'shipping', label: 'จัดส่งแล้ว' },
                { id: 'completed', label: 'สำเร็จแล้ว' }
              ].map(st => (
                <button 
                  key={st.id} 
                  className={`btn ${statusFilter === st.id ? 'btn-gold' : 'btn-outline'}`}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
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
                  รวมผู้จ่ายมัดจำทั้งหมด: <strong style={{ color: '#22c55e', fontSize: '1.05rem' }}>{orders.length + extraDeposits.length} รายการ</strong>
                </span>
              </div>

              {/* Deposit Breakdown Stats Grid */}
              {(() => {
                const count50 = orders.filter(o => (o.deposit || 50) === 50).length;
                const sum50 = count50 * 50;
                const count150 = orders.filter(o => (o.deposit || 50) === 150).length;
                const sum150 = count150 * 150;
                const countExtra100 = extraDeposits.length;
                const sumExtra100 = extraDeposits.reduce((sum, ed) => sum + (ed.amount || 100), 0);
                const totalDepositMoney = orders.reduce((sum, o) => sum + (o.deposit || 50), 0) + sumExtra100;

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
                      </div>

                      <div style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid #f5d061', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                        <span style={{ color: '#f5d061', fontSize: '0.82rem', fontWeight: 700 }}>🏆 รวมเงินมัดจำทั้งหมด</span>
                        <h3 style={{ color: '#f5d061', fontSize: '1.5rem', margin: '4px 0 2px' }}>฿{totalDepositMoney.toLocaleString()}</h3>
                        <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 600 }}>{orders.length + countExtra100} รายการรวม</span>
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
                                ฿{(o.total || 0).toLocaleString()}
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
                        <strong style={{ display: 'block', color: '#fff' }}>{o.name}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#38bdf8', display: 'block' }}>รหัส: {o.studentId}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>📞 {o.phone}</span>
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
                          const deposit = o.deposit || 50;
                          const calcTotal = (o.items && o.items.length > 0)
                            ? o.items.reduce((sum, it) => {
                                let itemP = it.totalPrice || it.price || 350;
                                if (it.customName && it.customName.trim() !== '') {
                                  if (!it.totalPrice || it.totalPrice === 350 || it.totalPrice === 270) itemP = (itemP || 350) + 20;
                                }
                                return sum + (itemP || 350);
                              }, 0)
                            : (o.total || 350);
                          const remaining = Math.max(0, calcTotal - deposit);
                          return (
                            <>
                              <div style={{ color: '#22c55e', fontWeight: 'bold' }}>มัดจำ: ฿{deposit.toLocaleString()}</div>
                              <div style={{ color: 'var(--text-sub)' }}>ยอดเต็ม: ฿{calcTotal.toLocaleString()}</div>
                              <div style={{ color: '#eab308' }}>ค้าง: ฿{remaining.toLocaleString()}</div>
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
