/**
 * In-memory Dummy Store
 * จำลอง Firestore CRUD สำหรับ local testing (USE_DUMMY=true)
 * state จะ reset ทุกครั้ง server restart แต่ใช้ทดสอบ flow ได้ครบ
 */

import { DUMMY_HINTS, DUMMY_USERS } from './dummy-data.js';

// ── deep-clone เพื่อไม่ให้ไปแก้ source array ──────────────
function cloneArr(arr) {
  return arr.map((item) => ({ ...item }));
}

// ── Global state (singleton ใน Node.js process) ───────────
let _hints = null;
let _users = null;

function getHints() {
  if (!_hints) _hints = cloneArr(DUMMY_HINTS);
  return _hints;
}
function getUsers() {
  if (!_users) _users = cloneArr(DUMMY_USERS);
  return _users;
}

// ── ID generator ──────────────────────────────────────────
let _seq = 1;
function newId(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${_seq++}`;
}

// ═══════════════════════════════════════════════════════════
// HINTS STORE
// ═══════════════════════════════════════════════════════════

export const hintsStore = {
  /** คืน array ตาม filter object (AND logic) */
  find(filter = {}) {
    return getHints().filter((h) =>
      Object.entries(filter).every(([k, v]) => h[k] === v)
    );
  },

  /** คืน doc เดียว */
  findOne(filter = {}) {
    return getHints().find((h) =>
      Object.entries(filter).every(([k, v]) => h[k] === v)
    ) ?? null;
  },

  /** คืน doc ตาม _id */
  findById(id) {
    return getHints().find((h) => h._id === id) ?? null;
  },

  /** เพิ่ม doc ใหม่ คืน _id */
  insert(data) {
    const doc = { _id: newId('hint'), ...data };
    getHints().push(doc);
    return doc._id;
  },

  /** update fields ของ doc ที่ตรง _id */
  update(id, fields) {
    const doc = getHints().find((h) => h._id === id);
    if (!doc) throw new Error(`Hint ${id} not found`);
    Object.assign(doc, fields);
  },

  /** ลบ docs ที่ตรง filter ทั้งหมด คืนจำนวนที่ลบ */
  deleteWhere(filter = {}) {
    const before = getHints().length;
    _hints = getHints().filter(
      (h) => !Object.entries(filter).every(([k, v]) => h[k] === v)
    );
    return before - _hints.length;
  },

  /** ลบ docs ตาม array ของ _id */
  deleteByIds(ids) {
    const set = new Set(ids);
    const before = getHints().length;
    _hints = getHints().filter((h) => !set.has(h._id));
    return before - _hints.length;
  },

  /** คืน hints ทั้งหมด (สำหรับ admin/backup) */
  all() {
    return [...getHints()];
  },

  /** โหลด hints จาก external array (ใช้ตอน seed จาก /backup) */
  seed(docs) {
    _hints = cloneArr(docs);
  },
};

// ═══════════════════════════════════════════════════════════
// USERS STORE
// ═══════════════════════════════════════════════════════════

export const usersStore = {
  findByUsername(username) {
    return getUsers().find((u) => u.username === username) ?? null;
  },

  insert(data) {
    const doc = { _id: newId('user'), ...data };
    getUsers().push(doc);
    return doc._id;
  },

  all() {
    return [...getUsers()];
  },

  seed(docs) {
    _users = cloneArr(docs);
  },
};
