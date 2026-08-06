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
  return (
    <div className={`toast-notification ${toast.type}`}>
      {toast.message}
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
  { id: '4XL', label: '4XL (48")', chest: '48"', isLarge: true },
  { id: '5XL', label: '5XL (50")', chest: '50"', isLarge: true },
  { id: '6XL', label: '6XL (52")', chest: '52"', isLarge: true },
  { id: '7XL', label: '7XL (54")', chest: '54"', isLarge: true },
  { id: '8XL', label: '8XL (56")', chest: '56"', isLarge: true }
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

  // Determine admin status – include fallback from localStorage in case auth state hasn't loaded yet
  const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('cpe_current_user') : null;
  const parsedStored = storedUser ? JSON.parse(storedUser) : null;
  const isAdmin = currentUser?.studentId === '6800000000' || currentUser?.role === 'admin' ||
                  parsedStored?.studentId === '6800000000' || parsedStored?.role === 'admin';
  
  const [selectedProductKey, setSelectedProductKey] = useState('polo');

  // Adjust default product based on student ID (68 → polo only, 69 → jacket only)
  useEffect(() => {
    if (!isAdmin && currentUser?.studentId) {
      if (currentUser.studentId.startsWith('68')) setSelectedProductKey('polo');
      else if (currentUser.studentId.startsWith('69')) setSelectedProductKey('jacket');
    }
  }, [currentUser, isAdmin]);
  const [searchTrackingQuery, setSearchTrackingQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);

  const [myOrdersHistory, setMyOrdersHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('cpe_my_orders');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Save Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem('cpe_cart', JSON.stringify(cart));
  }, [cart]);

  // Save My Orders History to LocalStorage
  useEffect(() => {
    localStorage.setItem('cpe_my_orders', JSON.stringify(myOrdersHistory));
  }, [myOrdersHistory]);

  // Auto load recent order on page load / refresh
  useEffect(() => {
    if (!trackedOrder && myOrdersHistory.length > 0) {
      setTrackedOrder(myOrdersHistory[0]);
      if (myOrdersHistory[0].id) setSearchTrackingQuery(myOrdersHistory[0].id);
    }
  }, [myOrdersHistory]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCurrentUser({ uid: user.uid, ...userDoc.data() });
          } else {
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              name: user.displayName || 'นักศึกษา CPE',
              studentId: '6812345678'
            });
          }
        } catch (e) {
          console.log("Firestore user fetch error:", e);
        }
      } else {
        const savedUser = localStorage.getItem('cpe_current_user');
        if (savedUser) {
          try { setCurrentUser(JSON.parse(savedUser)); } catch { setCurrentUser(null); }
        } else {
          setCurrentUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'info' }), 3500);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) { console.log("Signout:", e); }
    localStorage.removeItem('cpe_current_user');
    setCurrentUser(null);
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
              <a href="#tracking" className="nav-link">ติดตามสถานะ</a>
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
        <HeroSlider onSelectProduct={selectProductFromBanner} />

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
        />

        {/* ORDER TRACKING LOOKUP SECTION */}
        <OrderTracking 
          searchQuery={searchTrackingQuery}
          setSearchQuery={setSearchTrackingQuery}
          trackedOrder={trackedOrder}
          setTrackedOrder={setTrackedOrder}
        />

        {/* CART DRAWER */}
        <CartDrawer 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          setCart={setCart}
          onCheckout={() => {
            setIsCartOpen(false);
            setIsCheckoutOpen(true);
          }}
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

        {/* FOOTER */}
        <Footer />

      </div>
    </AuthContext.Provider>
  );
}

// 1. HERO SLIDER COMPONENT
function HeroSlider({ onSelectProduct }) {
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
                  <button onClick={() => onSelectProduct('polo')} className="btn btn-gold">สั่งซื้อเสื้อโปโลสาขา</button>
                  <a href="#tracking" className="btn btn-outline">เช็คสถานะออเดอร์</a>
                </div>
              </div>
            </div>

            {/* Slide 1: CPE 69 Jacket */}
            <div className={`banner-slide ${currentSlide === 1 ? 'active' : ''}`}>
              <img src="assets/jacket_banner.png" alt="CPE 69 Jacket Banner" className="banner-img" />
              <div className="banner-overlay-bar">
                <div className="banner-tagline">
                  <span className="tech-pill">CPE 69 LXIX JACKET</span>
                  <div className="banner-text-content">
                    <h2>เสื้อคลุมสาขารุ่นใหม่ 69 สำหรับน้องวิศวกรรมคอมพิวเตอร์ (เสื้อคลุม ฿920)</h2>
                  </div>
                </div>
                <div className="banner-cta-group">
                  <button onClick={() => onSelectProduct('jacket')} className="btn btn-gold">สั่งซื้อเสื้อคลุม CPE 69</button>
                  <a href="#tracking" className="btn btn-outline">เช็คสถานะออเดอร์</a>
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
function ProductConfigurator({ selectedProductKey, setSelectedProductKey, cart, setCart, setIsSizeGuideOpen, setIsCartOpen }) {
  const { currentUser, showToast, setIsAuthModalOpen } = useContext(AuthContext);
  const [selectedSize, setSelectedSize] = useState('M');
  const [currentView, setCurrentView] = useState('front');
  const [customName, setCustomName] = useState('');
  const [studentIdInput, setStudentIdInput] = useState(currentUser?.studentId || '');
  const [qty, setQty] = useState(1);

  // Determine admin status – include fallback from localStorage in case auth state hasn't loaded yet
  const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('cpe_current_user') : null;
  const parsedStored = storedUser ? JSON.parse(storedUser) : null;
  const isAdmin = currentUser?.studentId === '6800000000' || currentUser?.role === 'admin' ||
                  parsedStored?.studentId === '6800000000' || parsedStored?.role === 'admin';

  const userStudentId = currentUser?.studentId;
  const showPolo = isAdmin || !userStudentId || userStudentId.startsWith('68') || (!userStudentId.startsWith('68') && !userStudentId.startsWith('69'));
  const showJacket = isAdmin || !userStudentId || userStudentId.startsWith('69') || (!userStudentId.startsWith('68') && !userStudentId.startsWith('69'));

  useEffect(() => {
    if (currentUser?.studentId) setStudentIdInput(currentUser.studentId);
  }, [currentUser]);

  useEffect(() => {
    if (selectedProductKey === 'polo' && currentView === 'sleeve') {
      setCurrentView('front');
    }
  }, [selectedProductKey]);

  const prod = PRODUCTS[selectedProductKey] || PRODUCTS.polo;

  // Calculate Unit Price
  let unitPrice = prod.basePrice;
  if (['3XL', '4XL', '5XL', '6XL', '7XL', '8XL'].includes(selectedSize)) {
    unitPrice += prod.largeFee;
  }
  // Custom name embroidery is now free

  const totalPrice = unitPrice * qty;

  const handleAddToCart = () => {
    if (!currentUser) {
      showToast('กรุณาเข้าสู่ระบบ (Login) ก่อนสั่งซื้อสินค้า', 'error');
      if (setIsAuthModalOpen) setIsAuthModalOpen(true);
      return;
    }
    if (!studentIdInput.trim() || studentIdInput.trim().length !== 10) {
      showToast('กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)', 'error');
      return;
    }

    const item = {
      id: Date.now(),
      productKey: selectedProductKey,
      title: prod.title,
      size: selectedSize,
      qty: qty,
      customName: customName.trim(),
      studentId: studentIdInput.trim() || currentUser?.studentId || '6812345678',
      price: unitPrice,
      totalPrice: totalPrice
    };

    setCart(prev => [...prev, item]);
    showToast(`เพิ่ม ${prod.title} ลงในตะกร้าเรียบร้อยแล้ว!`, 'success');
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
                {selectedProductKey !== 'polo' && (
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
                      objectPosition: selectedProductKey === 'jacket' ? 'center center' : (currentView === 'sleeve' ? 'center 35%' : 'center 10%'),
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

            <div className="shirt-detail-badges">
              {prod.specs.map((spec, idx) => (
                <div key={idx} className="detail-badge" dangerouslySetInnerHTML={{ __html: spec }}></div>
              ))}
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

            {/* Size Selector Grid */}
            <div className="config-group">
              <div className="config-label">
                <span>เลือกขนาดเสื้อ (Size): <strong style={{ color: 'var(--accent-gold)' }}>{selectedSize}</strong></span>
                <a href="javascript:void(0)" onClick={() => setIsSizeGuideOpen(true)} className="link-btn">ดูตารางขนาดเสื้อ</a>
              </div>

              <div className="size-grid">
                {SIZES.map(s => (
                  <div 
                    key={s.id}
                    className={`size-pill ${selectedSize === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedSize(s.id)}
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

            {/* Custom Embroidery Option */}
            <div className="config-group">
              <div className="config-label">
                <span>ปักชื่อ-นามสกุล / ชื่อเล่นบนอกเสื้อ (Optional):</span>
                <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>ฟรี ไม่คิดราคาเพิ่ม</span>
              </div>
              <input 
                type="text" 
                className="form-input" 
                placeholder="ตัวอย่าง: ต้อม CPE68 (หากไม่ปักปล่อยว่างไว้)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
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
                  <button className="qty-btn" onClick={() => setQty(prev => Math.max(1, prev - 1))}>-</button>
                  <input type="number" className="qty-input" value={qty} readOnly />
                  <button className="qty-btn" onClick={() => setQty(prev => Math.min(50, prev + 1))}>+</button>
                </div>

                {!currentUser ? (
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

// 4. ORDER TRACKING COMPONENT (Firestore Integration)
function OrderTracking({ searchQuery, setSearchQuery, trackedOrder, setTrackedOrder }) {
  const { showToast } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  // Real-time order update listener
  useEffect(() => {
    if (!trackedOrder || !trackedOrder.firestoreId || !db) return;
    const unsub = onSnapshot(doc(db, 'orders', trackedOrder.firestoreId), (docSnap) => {
      if (docSnap.exists()) {
        setTrackedOrder(prev => ({ ...prev, ...docSnap.data() }));
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
        const docSnap = querySnapshot.docs[0];
        const orderData = { firestoreId: docSnap.id, ...docSnap.data() };
        setTrackedOrder(orderData);
        showToast('พบข้อมูลออเดอร์ในระบบ Firebase!', 'success');
      } else {
        // Fallback demo lookup
        const demoOrder = {
          id: queryStr.startsWith('CPE') ? queryStr : 'CPE-2026-8819',
          studentId: queryStr.length === 10 ? queryStr : '6812345678',
          name: 'สมชาย ใจดี (CPE68)',
          items: [
            { title: 'เสื้อโปโลสาขาวิศวกรรมคอมพิวเตอร์ (CPE Polo Shirt)', size: 'L', qty: 1, customName: 'ต้อม CPE', price: 270 }
          ],
          total: 270,
          status: 'shipping',
          date: (() => {
            try {
              return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
            } catch (e) {
              return new Date(Date.now() + 25200000).toISOString().replace('T', ' ').substring(0, 16);
            }
          })(),
          trackingNumber: 'TH6800192837'
        };
        setTrackedOrder(demoOrder);
        showToast('ค้นหาออเดอร์สำเร็จ!', 'info');
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
      setTrackedOrder(null);
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

          {/* Render Tracking Results */}
          {trackedOrder && (
            <div className="tracking-result-box" style={{ marginTop: '24px', background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ color: 'var(--accent-gold-bright)', fontSize: '1.2rem' }}>{trackedOrder.id}</h4>
                  <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>ผู้สั่งซื้อ: {trackedOrder.name} (รหัส: {trackedOrder.studentId})</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tech-pill">ยอดรวม: ฿{trackedOrder.total.toLocaleString()}</span>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{trackedOrder.date}</p>
                </div>
              </div>

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
    e.preventDefault();
    if (isSubmitting) return;

    const name = regName.trim();
    const studentId = regStudentId.trim();
    const phone = regPhone.trim() || '-';
    const email = regEmail.trim() || `${studentId}@psru.ac.th`;
    const pass = regPass.trim();
    const confirmPass = regConfirmPass.trim();

    if (!name) {
      showToast('กรุณากรอกชื่อ-นามสกุล', 'error');
      return;
    }
    if (studentId.length !== 10) {
      showToast('กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)', 'error');
      return;
    }
    if (pass.length < 6) {
      showToast('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'error');
      return;
    }
    if (pass !== confirmPass) {
      showToast('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน', 'error');
      return;
    }

    const fb = window.CPEFirebase;
    setIsSubmitting(true);

    try {
      let finalUid = 'user-' + Date.now();

      if (fb && fb.auth && fb.createUserWithEmailAndPassword) {
        try {
          const authEmail = `${studentId}@psru.ac.th`;
          const res = await withTimeout(fb.createUserWithEmailAndPassword(fb.auth, authEmail, pass), 5000);
          if (res && res.user) {
            finalUid = res.user.uid;
          }
        } catch (err) {
          console.log("Firebase Register Error:", err);
          let msg = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
          if (err.code === 'auth/email-already-in-use') {
             msg = 'รหัสนักศึกษานี้มีอยู่ในระบบแล้ว กรุณาไปที่แท็บ "เข้าสู่ระบบ"';
          } else if (err.code === 'auth/weak-password') {
             msg = 'รหัสผ่านอ่อนเกินไป (ต้อง 6 ตัวอักษรขึ้นไป)';
          } else if (err.code === 'auth/invalid-email') {
             msg = 'รูปแบบรหัสนักศึกษาไม่ถูกต้อง';
          } else if (err.code === 'auth/operation-not-allowed') {
             console.warn("Firebase Auth is disabled! Falling back to Local Auth Mode.");
          } else if (err.message && err.message.includes('timeout')) {
             console.warn("Firebase Auth timed out, falling back to Local Mode.");
          } else {
             msg = `เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถสร้างบัญชีได้'}`;
          }

          if (['auth/email-already-in-use', 'auth/weak-password', 'auth/invalid-email'].includes(err.code)) {
             showToast(msg, 'error');
             return;
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
      
      // Save user profile to Firestore
      if (fb && fb.db && fb.setDoc && fb.doc) {
        try {
          await withTimeout(fb.setDoc(fb.doc(fb.db, 'users', finalUid), userData), 4000);
        } catch (docErr) {
          console.log("Firestore Doc Write Error:", docErr);
        }
      }
      
      setCurrentUser(userData);
      localStorage.setItem('cpe_current_user', JSON.stringify(userData));
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
              onClick={() => setActiveTab('login')}
            >
              เข้าสู่ระบบ
            </button>
            <button 
              className={`auth-tab-item ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
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
function CheckoutModal({ isOpen, onClose, cart, setCart, setTrackedOrder, setMyOrdersHistory, setSearchTrackingQuery }) {
  const { currentUser, showToast } = useContext(AuthContext);
  const [checkoutName, setCheckoutName] = useState(currentUser?.name || '');
  const [checkoutStudentId, setCheckoutStudentId] = useState(currentUser?.studentId || '');
  const [checkoutPhone, setCheckoutPhone] = useState(currentUser?.phone || '');
  const [slipFile, setSlipFile] = useState(null);
  const [slipDataUrl, setSlipDataUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setCheckoutName(currentUser.name);
      if (currentUser.studentId) setCheckoutStudentId(currentUser.studentId);
      if (currentUser.phone) setCheckoutPhone(currentUser.phone);
    }
  }, [currentUser]);

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
    if (!checkoutName || !checkoutStudentId || checkoutStudentId.length !== 10 || !checkoutPhone) {
      showToast('กรุณากรอกข้อมูลและรหัสนักศึกษา 10 หลักให้ครบถ้วน', 'error');
      return;
    }
    if (!slipDataUrl) {
      showToast('กรุณาอัพโหลดสลิปการโอนเงินก่อนดำเนินการ', 'error');
      return;
    }

    setIsSubmitting(true);

    const depositAmount = 50;
    const newOrder = {
      id: orderId,
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
          <h3 className="modal-title" style={{ color: 'var(--accent-gold-bright)', fontSize: '1.2rem' }}>💰 ชำระค่ามัดจำ 50 บาท (สแกน QR Code)</h3>
          <button className="close-btn" onClick={onClose} style={{ color: '#fff', fontSize: '1.8rem' }}>&times;</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <form onSubmit={handleSubmitOrder}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              
              {/* Left: PromptPay QR Code */}
              <div style={{ flex: '1 1 300px' }}>
                <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '10px' }}>1. สแกน QR Code ชำระค่ามัดจำ</h4>
                <div style={{ background: '#fff', padding: '14px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.5)' }}>
                  <img 
                    src="assets/deposit_qr.png" 
                    alt="QR Code ชำระค่ามัดจำ 50 บาท"
                    style={{ width: '100%', maxWidth: '260px', height: 'auto', margin: '0 auto', display: 'block', borderRadius: '8px' }}
                  />
                  <div style={{ background: '#0f1017', border: '1px solid #22c55e', borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                    <p style={{ color: '#22c55e', fontWeight: '700', fontSize: '1.4rem', margin: 0 }}>
                      💰 ค่ามัดจำ: ฿50
                    </p>
                    <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: '4px', margin: 0 }}>
                      ยอดรวมทั้งหมด: ฿{totalAmount.toLocaleString()} (ส่วนที่เหลือ ฿{(totalAmount - 50).toLocaleString()} จะแจ้งอีกที)
                    </p>
                  </div>
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
              <tr><td><strong>3XL - 8XL</strong> <span style={{ fontSize: '0.75rem', color: '#F5D061' }}>(+10฿)</span></td><td>46" - 56"</td><td>31" - 36"</td><td><strong style={{ color: '#F5D061' }}>360 บาท</strong></td></tr>
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
              <tr><td><strong>3XL - 8XL</strong> <span style={{ fontSize: '0.75rem', color: '#F5D061' }}>(+100฿)</span></td><td>48" - 58"</td><td>32" - 37"</td><td><strong style={{ color: '#F5D061' }}>1,020 บาท</strong></td></tr>
            </tbody>
          </table>

          <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid var(--border-gold)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--accent-gold-bright)', marginTop: '15px' }}>
            💡 คำแนะนำ: เสื้อโปโล 3XL+ เพิ่ม 10฿ / เสื้อคลุม Jacket 3XL+ เพิ่ม 100฿ | บริการปักชื่อฟรี
          </div>
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
  const [previewSlipOrder, setPreviewSlipOrder] = useState(null);
  const [editingTracking, setEditingTracking] = useState({});

  const fetchAllOrders = async () => {
    setLoading(true);
    let firestoreList = [];
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        firestoreList.push({ firestoreId: docSnap.id, ...docSnap.data() });
      });
    } catch (e) {
      console.log("Firestore fetch error:", e);
    }

    setOrders(firestoreList);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchAllOrders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStatusChange = async (orderId, newStatus) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setOrders(updated);
    localStorage.setItem('cpe_my_orders', JSON.stringify(updated));

    const target = orders.find(o => o.id === orderId);
    if (target && target.firestoreId) {
      try {
        await setDoc(doc(db, 'orders', target.firestoreId), { ...target, status: newStatus }, { merge: true });
      } catch (e) { console.log("Firestore update:", e); }
    }

    showToast(`อัปเดตสถานะออเดอร์ ${orderId} เป็น "${newStatus}" แล้ว`, 'success');
  };

  const handleDelete = async (orderId) => {
    const target = orders.find(o => o.id === orderId);
    if (!target?.firestoreId) return;
    try {
      await deleteDoc(doc(db, 'orders', target.firestoreId));
      const updated = orders.filter(o => o.id !== orderId);
      setOrders(updated);
      localStorage.setItem('cpe_my_orders', JSON.stringify(updated));
      showToast(`ลบออเดอร์ ${orderId} สำเร็จ`, 'success');
    } catch (e) {
      console.log('Delete error:', e);
      showToast('ลบออเดอร์ไม่สำเร็จ', 'error');
    }
  };


  const filteredOrders = orders.filter(o => {
    const matchSearch = (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (o.studentId || '').includes(searchTerm) || 
                        (o.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRev = orders.reduce((sum, o) => sum + (o.total || 0), 0);
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

          {/* Size Summary */}
          {(() => {
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
            return (
              <div style={{ background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--accent-gold-bright)', marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📊 สรุปจำนวนสั่งแยกตามไซส์
                </h4>
                {products.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>ยังไม่มีข้อมูลออเดอร์</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
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

          {/* Orders Table */}
          {loading ? (
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
                            • {it.title} <span style={{ color: 'var(--accent-gold)' }}>(ไซส์ {it.size} x {it.qty} ตัว)</span>
                            {it.customName && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-gold-bright)', paddingLeft: '8px' }}>ปักชื่อ: {it.customName}</span>}
                          </div>
                        ))}
                      </td>

                      <td style={{ padding: '10px', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        <div style={{ color: '#22c55e', fontWeight: 'bold' }}>มัดจำ: ฿{(o.deposit || 50).toLocaleString()}</div>
                        <div style={{ color: 'var(--text-sub)' }}>ยอดเต็ม: ฿{(o.total || 0).toLocaleString()}</div>
                        <div style={{ color: '#eab308' }}>ค้าง: ฿{((o.total || 0) - (o.deposit || 50)).toLocaleString()}</div>
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
              <li><a href="#tracking">ตรวจสอบสถานะการสั่งซื้อ</a></li>
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
