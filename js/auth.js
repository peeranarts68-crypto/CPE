/**
 * Auth Module for CPE Polo Ordering System
 * Handles User Login, Registration, Session Management & Modals
 */

class AuthManager {
  constructor() {
    this.usersKey = 'cpe_registered_users';
    this.currentUserKey = 'cpe_current_user';
    this.currentUser = null;
    this.init();
  }

  init() {
    this.ensureDefaultUsers();
    this.loadSession();
    this.bindEvents();
    this.updateUI();
  }

  ensureDefaultUsers() {
    const existing = localStorage.getItem(this.usersKey);
    if (!existing) {
      const defaultUsers = [
        {
          studentId: '6812345678',
          name: 'สมชาย ใจดี (CPE68)',
          nickname: 'ต้อม',
          year: '2',
          phone: '0812345678',
          email: 'cpe68@psru.ac.th',
          password: 'password123'
        }
      ];
      localStorage.setItem(this.usersKey, JSON.stringify(defaultUsers));
    }
  }

  loadSession() {
    const session = localStorage.getItem(this.currentUserKey);
    if (session) {
      try {
        this.currentUser = JSON.parse(session);
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  saveSession(user) {
    this.currentUser = user;
    localStorage.setItem(this.currentUserKey, JSON.stringify(user));
    this.updateUI();
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.currentUserKey);
    this.updateUI();
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  }

  getUsers() {
    return JSON.parse(localStorage.getItem(this.usersKey) || '[]');
  }

  register(userData) {
    const users = this.getUsers();
    
    // Check if studentId or email already exists
    const exists = users.find(u => u.studentId === userData.studentId || u.email === userData.email);
    if (exists) {
      return { success: false, message: 'รหัสนักศึกษา หรือ อีเมลนี้ถูกลงทะเบียนไว้แล้ว' };
    }

    users.push(userData);
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    
    // Auto login
    this.saveSession(userData);
    return { success: true, message: 'ลงทะเบียนสำเร็จ! เข้าสู่ระบบอัตโนมัติ' };
  }

  login(identifier, password) {
    const users = this.getUsers();
    const user = users.find(u => (u.studentId === identifier || u.email === identifier) && u.password === password);
    
    if (!user) {
      return { success: false, message: 'รหัสนักศึกษา/อีเมล หรือ รหัสผ่านไม่ถูกต้อง' };
    }

    this.saveSession(user);
    return { success: true, message: `ยินดีต้อนรับกลับ ${user.name}!` };
  }

  updateUI() {
    const authBtnGroup = document.getElementById('authBtnGroup');
    const userProfileMenu = document.getElementById('userProfileMenu');

    if (this.currentUser) {
      if (authBtnGroup) authBtnGroup.style.display = 'none';
      if (userProfileMenu) {
        userProfileMenu.style.display = 'block';
        const nameEl = document.getElementById('userNameDisplay');
        const avatarEl = document.getElementById('userAvatarDisplay');
        const dropdownName = document.getElementById('dropdownUserName');
        const dropdownId = document.getElementById('dropdownStudentId');

        if (nameEl) nameEl.textContent = this.currentUser.name;
        if (avatarEl) avatarEl.textContent = this.currentUser.name.charAt(0).toUpperCase();
        if (dropdownName) dropdownName.textContent = this.currentUser.name;
        if (dropdownId) dropdownId.textContent = `รหัส: ${this.currentUser.studentId}`;
      }
    } else {
      if (authBtnGroup) authBtnGroup.style.display = 'flex';
      if (userProfileMenu) userProfileMenu.style.display = 'none';
    }
  }

  bindEvents() {
    // Auth Modal Triggers
    const openAuthBtn = document.getElementById('openAuthBtn');
    const authModal = document.getElementById('authModal');
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    
    if (openAuthBtn && authModal) {
      openAuthBtn.addEventListener('click', () => {
        authModal.classList.add('show');
      });
    }

    if (closeAuthBtn && authModal) {
      closeAuthBtn.addEventListener('click', () => {
        authModal.classList.remove('show');
      });
    }

    // Tabs
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const switchToRegLink = document.getElementById('switchToRegLink');
    const switchToLoginLink = document.getElementById('switchToLoginLink');

    if (loginTab && registerTab && loginForm && registerForm) {
      loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
      });

      registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
      });
    }

    if (switchToRegLink && registerTab) {
      switchToRegLink.addEventListener('click', () => registerTab.click());
    }

    if (switchToLoginLink && loginTab) {
      switchToLoginLink.addEventListener('click', () => loginTab.click());
    }

    // Demo Fill
    const fillDemoBtn = document.getElementById('fillDemoBtn');
    if (fillDemoBtn) {
      fillDemoBtn.addEventListener('click', () => {
        document.getElementById('loginId').value = '6812345678';
        document.getElementById('loginPass').value = 'password123';
        showToast('เติมข้อมูลบัญชีทดลองแล้ว', 'info');
      });
    }

    // Handle Login Submit
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('loginId').value.trim();
        const pass = document.getElementById('loginPass').value.trim();

        const res = this.login(id, pass);
        if (res.success) {
          showToast(res.message, 'success');
          authModal.classList.remove('show');
          loginForm.reset();
        } else {
          showToast(res.message, 'error');
        }
      });
    }

    // Handle Register Submit
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const studentId = document.getElementById('regStudentId').value.trim();
        const year = document.getElementById('regYear').value;
        const nickname = document.getElementById('regNickname').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPass').value.trim();
        const confirmPass = document.getElementById('regConfirmPass').value.trim();

        if (studentId.length !== 10) {
          showToast('กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)', 'error');
          return;
        }

        if (password !== confirmPass) {
          showToast('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน', 'error');
          return;
        }

        const userData = { studentId, name, nickname, year, email, phone, password };
        const res = this.register(userData);

        if (res.success) {
          showToast(res.message, 'success');
          authModal.classList.remove('show');
          registerForm.reset();
        } else {
          showToast(res.message, 'error');
        }
      });
    }

    // User Avatar & Dropdown toggle
    const avatarBtn = document.getElementById('userAvatarBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    if (avatarBtn && dropdownMenu) {
      avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !avatarBtn.contains(e.target)) {
          dropdownMenu.classList.remove('show');
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
        if (dropdownMenu) dropdownMenu.classList.remove('show');
      });
    }
  }
}

// Global Toast utility
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Instantiate AuthManager on DOM Content Loaded
let authApp;
document.addEventListener('DOMContentLoaded', () => {
  authApp = new AuthManager();
});
