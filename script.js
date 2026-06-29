// ========================================================================
//  ResVisist - Visitor Booking System
//  Complete client-side application with localStorage persistence
// ========================================================================
import {
  auth,
  db,
  storage,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setDoc,
  getDoc,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase.js";
let currentUser = null;
// ========================= IN-MEMORY CACHES (kept live by onSnapshot) =========================
let bookingsCache = [];
let usersCache = [];
let notificationsCache = [];
let unsubscribeBookings = null;
let unsubscribeUsers = null;
let unsubscribeNotifications = null;

function setupRealtimeListeners() {
  // Bookings — everyone needs to see relevant bookings (filtered in render functions)
  unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
    bookingsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentUser) renderDashboard();
  });

  // Users — needed for admin user management + "notify all security" lookups
  unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
    usersCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentUser && currentView === 'users') renderDashboard();
  });

  // Notifications — only this user's notifications
  const notifQuery = query(collection(db, "notifications"), where("userId", "==", currentUser.id));
  let isFirstNotifLoad = true;
  unsubscribeNotifications = onSnapshot(notifQuery, (snapshot) => {
    notificationsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!isFirstNotifLoad) {
      const hasNewNotif = snapshot.docChanges().some(change => change.type === 'added');
      if (hasNewNotif) {
        playNotificationSound();
      }
    }
    isFirstNotifLoad = false;

    updateNotificationBadge();
    if (document.getElementById('notif-panel') && !document.getElementById('notif-panel').classList.contains('hidden')) {
      renderNotificationList();
    }
    if (currentView === 'notifications') renderNotifPage();
  });
}
function playNotificationSound() {
  const sound = document.getElementById('notif-sound');
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {
      // Autoplay can be blocked by the browser until the user has interacted with the page once — safe to ignore.
    });
  }
}

function teardownRealtimeListeners() {
  if (unsubscribeBookings) unsubscribeBookings();
  if (unsubscribeUsers) unsubscribeUsers();
  if (unsubscribeNotifications) unsubscribeNotifications();
  bookingsCache = [];
  usersCache = [];
  notificationsCache = [];
}

// ========================= INITIALIZATION =========================
function initApp() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      if (snapshot.exists()) {
        currentUser = { id: user.uid, ...snapshot.data() };
        setupRealtimeListeners();
        showApp();
        renderDashboard();
      } else {
        await signOut(auth);
        showAuth();
      }
    } else {
      teardownRealtimeListeners();
      currentUser = null;
      showHome();
    }
    lucide.createIcons();
  });
}
// ========================= AUTH =========================
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('text-brand-600', 'border-brand-600');
    tabLogin.classList.remove('text-slate-400', 'border-transparent');
    tabRegister.classList.add('text-slate-400', 'border-transparent');
    tabRegister.classList.remove('text-brand-600', 'border-brand-600');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabRegister.classList.add('text-brand-600', 'border-brand-600');
    tabRegister.classList.remove('text-slate-400', 'border-transparent');
    tabLogin.classList.add('text-slate-400', 'border-transparent');
    tabLogin.classList.remove('text-brand-600', 'border-brand-600');
  }
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {

        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        const snapshot = await getDoc(
            doc(db, "users", credential.user.uid)
        );

        currentUser = {
            id: credential.user.uid,
            ...snapshot.data()
        };

        toast(`Welcome back, ${currentUser.name}!`, "success");

        showApp();
        renderDashboard();

    } catch (error) {
        toast("Invalid email or password", "error");
    }
}

async function handleRegister(e) {
  e.preventDefault();

  const name = document.getElementById('reg-name').value.trim();
  const studentId = document.getElementById('reg-studentid').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const room = document.getElementById('reg-room').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;

  if (password.length < 6) {
    toast('Password must be at least 6 characters', 'error');
    return;
  }

  try {

    // Create Firebase Authentication account
    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = userCredential.user;

    // Save additional user information in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      role: "student",
      name,
      studentId,
      email,
      roomNumber: room,
      phone,
      createdAt: serverTimestamp()
    });

    toast(
      "Account created successfully!",
      "success"
    );

    showApp();
    renderDashboard();

  } catch (error) {

    console.error(error);

    switch (error.code) {

      case "auth/email-already-in-use":
        toast("An account with this email already exists", "error");
        break;

      case "auth/invalid-email":
        toast("Invalid email address", "error");
        break;

      case "auth/weak-password":
        toast("Password is too weak", "error");
        break;

      default:
        toast(error.message, "error");
    }

  }
}

async function logout() {

    await signOut(auth);
    teardownRealtimeListeners();

    currentUser = null;

    document.getElementById("user-menu")
        .classList.add("hidden");

    showAuth();

    toast("Signed out successfully", "info");
}

function showHome() {
  document.getElementById('home-view').classList.remove('hidden');
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.add('hidden');
}

function goToAuth(tab) {
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('auth-view').classList.remove('hidden');
  switchAuthTab(tab);
}

function showAuth() {
  showHome();
}

function showApp() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  renderSidebar();
  renderTopBar();
  updateNotificationBadge();
}

function getCurrentUser() {
    return currentUser;
}

// ========================= SIDEBAR =========================
function renderSidebar() {
  const user = getCurrentUser();
  if (!user) return;

  const navItems = {
    student: [
      { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
      { id: 'new-booking', label: 'Book a Visitor', icon: 'user-plus' },
      { id: 'my-bookings', label: 'My Bookings', icon: 'calendar-days' },
      { id: 'notifications', label: 'Notifications', icon: 'bell' }
    ],
    security: [
      { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
      { id: 'pending', label: 'Pending Approvals', icon: 'clipboard-check' },
      { id: 'active', label: 'Active Visitors', icon: 'user-check' },
      { id: 'all-bookings', label: 'All Bookings', icon: 'calendar-days' },
      { id: 'notifications', label: 'Notifications', icon: 'bell' }
    ],
    admin: [
      { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
      { id: 'all-bookings', label: 'All Records', icon: 'file-text' },
      { id: 'users', label: 'User Management', icon: 'users' },
      { id: 'notifications', label: 'Notifications', icon: 'bell' }
    ]
  };

  const items = navItems[user.role] || [];
  const roleColors = {
    student: 'from-blue-500 to-indigo-600',
    security: 'from-amber-500 to-orange-600',
    admin: 'from-purple-500 to-pink-600'
  };

  const html = `
    <div class="p-5 border-b border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br ${roleColors[user.role]} rounded-xl flex items-center justify-center">
          <i data-lucide="building-2" class="w-5 h-5 text-white"></i>
        </div>
        <div>
          <h1 class="text-white font-bold text-lg leading-tight">ResVisist</h1>
          <p class="text-slate-400 text-xs capitalize">${user.role} Portal</p>
        </div>
      </div>
    </div>
    <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
      ${items.map(item => `
        <div class="nav-item ${item.id === currentView ? 'active' : ''}" onclick="navigateTo('${item.id}')">
          <i data-lucide="${item.icon}"></i>
          <span>${item.label}</span>
        </div>
      `).join('')}
    </nav>
    <div class="p-3 border-t border-slate-800">
      <div class="nav-item" onclick="logout()">
        <i data-lucide="log-out"></i>
        <span>Sign Out</span>
      </div>
    </div>
  `;

  document.getElementById('sidebar-content').innerHTML = html;
  lucide.createIcons();
}

let currentView = 'overview';
function navigateTo(view) {
  currentView = view;
  renderSidebar();
  renderDashboard();
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}

// ========================= TOP BAR =========================
function renderTopBar() {
  const user = getCurrentUser();
  if (!user) return;

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-role').textContent = user.role;
  document.getElementById('menu-user-name').textContent = user.name;
  document.getElementById('menu-user-email').textContent = user.email || user.username;
}

function toggleUserMenu() {
  document.getElementById('user-menu').classList.toggle('hidden');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('hidden');
}

// Close menus on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('#user-menu') && !e.target.closest('[onclick="toggleUserMenu()"]')) {
    document.getElementById('user-menu')?.classList.add('hidden');
  }
  if (!e.target.closest('#notif-panel') && !e.target.closest('[onclick="toggleNotifications()"]')) {
    document.getElementById('notif-panel')?.classList.add('hidden');
  }
});

// ========================= NOTIFICATIONS =========================
function toggleNotifications() {
  document.getElementById('notif-panel').classList.toggle('hidden');
  renderNotificationList();
}


async function createNotification(userId, message, type = 'info') {
  await addDoc(collection(db, "notifications"), {
    userId,
    message,
    type,
    read: false,
    createdAt: Date.now()
  });
}

function getUserNotifications(userId) {
  return notificationsCache
    .filter(n => n.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function markNotificationRead(id) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

async function markAllRead() {
  const user = getCurrentUser();
  const unread = notificationsCache.filter(n => n.userId === user.id && !n.read);
  for (const n of unread) {
    await updateDoc(doc(db, "notifications", n.id), { read: true });
  }
  toast('All notifications marked as read', 'success');
}

function updateNotificationBadge() {
  const user = getCurrentUser();
  if (!user) return;
  const unread = getUserNotifications(user.id).filter(n => !n.read);
  const badge = document.getElementById('notif-badge');
  if (unread.length > 0) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotificationList() {
  const user = getCurrentUser();
  if (!user) return;
  const notifications = getUserNotifications(user.id);

  const list = document.getElementById('notif-list');
  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i data-lucide="bell-off"></i>
        <p class="text-sm font-medium">No notifications yet</p>
        <p class="text-xs mt-1">You'll see updates here</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  list.innerHTML = notifications.map(n => {
    const timeAgo = getTimeAgo(n.createdAt);
    const icons = { info: 'info', success: 'check-circle', warning: 'alert-triangle', error: 'x-circle' };
    const colors = { info: 'text-blue-500', success: 'text-green-500', warning: 'text-amber-500', error: 'text-red-500' };
    return `
      <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="markNotificationRead('${n.id}')">
        <div class="flex items-start gap-2">
          <i data-lucide="${icons[n.type] || 'info'}" class="w-4 h-4 ${colors[n.type] || 'text-blue-500'} mt-0.5 flex-shrink-0"></i>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-slate-700 leading-snug">${n.message}</p>
            <p class="text-xs text-slate-400 mt-1">${timeAgo}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}



// ========================= DASHBOARD ROUTER =========================
function renderDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  const titles = {
    student: { overview: ['My Dashboard', 'Quick overview of your visits'], 'new-booking': ['Book a Visitor', 'Create a new visitor booking'], 'my-bookings': ['My Bookings', 'Track all your visitor bookings'], notifications: ['Notifications', 'Stay updated on your bookings'] },
    security: { overview: ['Security Dashboard', 'Monitor and manage visitor entries'], pending: ['Pending Approvals', 'Review and approve visitor bookings'], active: ['Active Visitors', 'Visitors currently on campus'], 'all-bookings': ['All Bookings', 'Complete visitor booking history'], notifications: ['Notifications', 'Stay updated on new bookings'] },
    admin: { overview: ['Admin Dashboard', 'Complete system overview'], 'all-bookings': ['All Records', 'Complete visitation records'], users: ['User Management', 'Manage all system users'], notifications: ['Notifications', 'System notifications'] }
  };

  const [title, subtitle] = (titles[user.role] || {})[currentView] || ['Dashboard', ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;

  const renderers = {
    student: { overview: renderStudentOverview, 'new-booking': renderNewBooking, 'my-bookings': renderMyBookings, notifications: renderNotifPage },
    security: { overview: renderSecurityOverview, pending: renderPendingApprovals, active: renderActiveVisitors, 'all-bookings': renderSecurityAllBookings, notifications: renderNotifPage },
    admin: { overview: renderAdminOverview, 'all-bookings': renderAdminAllRecords, users: renderUserManagement, notifications: renderNotifPage }
  };

  const renderer = (renderers[user.role] || {})[currentView];
  if (renderer) {
    renderer();
  } else {
    document.getElementById('main-content').innerHTML = '<div class="empty-state"><i data-lucide="construction"></i><p>Page not found</p></div>';
  }
  lucide.createIcons();
}

// ========================= STUDENT VIEWS =========================
function renderStudentOverview() {
  const user = getCurrentUser();
  const bookings = bookingsCache.filter(b => b.studentId === user.id);
  const pending = bookings.filter(b => b.status === 'pending').length;
  const approved = bookings.filter(b => b.status === 'approved').length;
  const active = bookings.filter(b => b.status === 'checked-in').length;

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-6">
      <!-- Welcome Banner -->
      <div class="bg-gradient-to-r from-brand-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 class="text-2xl font-extrabold mb-1">Hello, ${user.name.split(' ')[0]}! 👋</h2>
            <p class="text-brand-100 text-sm">Room ${user.roomNumber} • Student ID: ${user.studentId}</p>
          </div>
          <button onclick="navigateTo('new-booking')" class="bg-white/20 hover:bg-white/30 backdrop-blur px-5 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2">
            <i data-lucide="user-plus" class="w-4 h-4"></i> New Booking
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${statCard('Total Bookings', bookings.length, 'calendar-days', 'from-blue-500 to-blue-600')}
        ${statCard('Pending', pending, 'clock', 'from-amber-500 to-orange-600')}
        ${statCard('Approved', approved, 'check-circle', 'from-green-500 to-emerald-600')}
        ${statCard('Active Visits', active, 'user-check', 'from-indigo-500 to-purple-600')}
      </div>

      <!-- Recent Bookings -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-bold text-slate-800">Recent Bookings</h3>
          <button onclick="navigateTo('my-bookings')" class="text-sm text-brand-600 font-semibold hover:underline">View All →</button>
        </div>
        ${bookings.length === 0 ? emptyState('calendar-x', 'No bookings yet', 'Create your first visitor booking') : `
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead><tr><th>Visitor</th><th>Date</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                ${bookings.slice(-5).reverse().map(b => `
                  <tr>
                    <td><div class="font-semibold text-slate-800">${b.visitorName}</div><div class="text-xs text-slate-400">${b.visitorPhone}</div></td>
                    <td class="text-slate-600">${formatDate(b.visitDate)} at ${b.visitTime}</td>
                    <td><span class="badge badge-${b.type}">${b.type}</span></td>
                    <td>${statusBadge(b.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
  lucide.createIcons();
}

function renderNewBooking() {
  document.getElementById('main-content').innerHTML = `
    <div class="fade-in max-w-2xl mx-auto">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-indigo-50">
          <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
            <i data-lucide="user-plus" class="w-5 h-5 text-brand-600"></i> New Visitor Booking
          </h3>
          <p class="text-sm text-slate-500 mt-1">Fill in the details below to book a visitor</p>
        </div>

        <form onsubmit="createBooking(event)" class="p-6 space-y-5">
          <!-- Visitor Details -->
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Visitor Information</h4>
            <div class="grid sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Visitor Full Name *</label>
                <input type="text" id="bk-visitor-name" required placeholder="Jane Smith" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Visitor Phone *</label>
                <input type="tel" id="bk-visitor-phone" required placeholder="+1 234 567 890" />
              </div>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Visitor ID Number *</label>
                <input type="text" id="bk-visitor-id" required placeholder="ID / Passport Number" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Relationship *</label>
                <select id="bk-relationship" required>
                  <option value="">Select relationship</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Relative">Relative</option>
                  <option value="Friend">Friend</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Visit Details -->
          <div class="space-y-4 pt-2 border-t border-slate-100">
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Visit Details</h4>
            <div class="grid sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Visit Date *</label>
                <input type="date" id="bk-date" required min="${new Date().toISOString().split('T')[0]}" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Visit Time *</label>
                <input type="time" id="bk-time" required />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5">Duration (hours) *</label>
                <input type="number" id="bk-duration" required min="1" max="24" value="2" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">Visit Type *</label>
              <div class="grid sm:grid-cols-2 gap-3">
                <label class="cursor-pointer">
                  <input type="radio" name="visit-type" value="visit" checked class="peer hidden" onchange="toggleSleepoverUpload()" />
                  <div class="border-2 border-slate-200 rounded-xl p-4 peer-checked:border-brand-600 peer-checked:bg-brand-50 transition-all">
                    <div class="flex items-center gap-2">
                      <i data-lucide="user" class="w-5 h-5 text-brand-600"></i>
                      <span class="font-semibold text-sm text-slate-800">Day Visit</span>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">Visitor comes for a few hours</p>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="visit-type" value="sleepover" class="peer hidden" onchange="toggleSleepoverUpload()" />
                  <div class="border-2 border-slate-200 rounded-xl p-4 peer-checked:border-brand-600 peer-checked:bg-brand-50 transition-all">
                    <div class="flex items-center gap-2">
                      <i data-lucide="moon" class="w-5 h-5 text-brand-600"></i>
                      <span class="font-semibold text-sm text-slate-800">Sleepover</span>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">Overnight stay (requires payment proof)</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- PDF Upload for Sleepover -->
            <div id="sleepover-upload" class="hidden">
              <label class="block text-xs font-bold text-slate-600 mb-1.5">Proof of Payment (PDF) *</label>
              <div id="file-drop-zone" class="file-drop-zone" onclick="document.getElementById('bk-pdf').click()">
                <i data-lucide="upload-cloud" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                <p class="text-sm font-semibold text-slate-600">Click to upload PDF</p>
                <p class="text-xs text-slate-400 mt-1">Proof of payment for sleepover fee</p>
                <input type="file" id="bk-pdf" accept=".pdf,application/pdf" class="hidden" onchange="handlePdfUpload(event)" />
              </div>
              <div id="pdf-file-info" class="hidden mt-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                <i data-lucide="file-text" class="w-5 h-5 text-green-600"></i>
                <span id="pdf-file-name" class="text-sm text-green-700 font-medium flex-1 truncate"></span>
                <button type="button" onclick="removePdf()" class="text-red-500 hover:bg-red-50 p-1 rounded">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1.5">Additional Notes</label>
              <textarea id="bk-notes" rows="3" placeholder="Any additional information..."></textarea>
            </div>
          </div>

          <!-- Submit -->
          <div class="flex gap-3 pt-4 border-t border-slate-100">
            <button type="submit" class="btn-primary flex-1 justify-center">
              <i data-lucide="send" class="w-4 h-4"></i> Submit Booking
            </button>
            <button type="reset" onclick="navigateTo('overview')" class="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  lucide.createIcons();
}


function toggleSleepoverUpload() {
  const type = document.querySelector('input[name="visit-type"]:checked').value;
  const uploadDiv = document.getElementById('sleepover-upload');
  if (type === 'sleepover') {
    uploadDiv.classList.remove('hidden');
  } else {
    uploadDiv.classList.add('hidden');
    uploadedPdfFile = null;
    document.getElementById('pdf-file-info')?.classList.add('hidden');
  }
}

let uploadedPdfFile = null; // replaces uploadedPdfData

function handlePdfUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    toast('Please upload a PDF file', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast('File too large. Maximum 2MB.', 'error');
    return;
  }
  uploadedPdfFile = file;
  document.getElementById('pdf-file-name').textContent = file.name;
  document.getElementById('pdf-file-info').classList.remove('hidden');
  document.getElementById('file-drop-zone').classList.add('has-file');
  toast('PDF uploaded successfully', 'success');
}

function removePdf() {
  uploadedPdfFile = null;
  document.getElementById('bk-pdf').value = '';
  document.getElementById('pdf-file-info').classList.add('hidden');
  document.getElementById('file-drop-zone').classList.remove('has-file');
}


async function createBooking(e) {
  e.preventDefault();
  const user = getCurrentUser();
  const visitType = document.querySelector('input[name="visit-type"]:checked').value;

  if (visitType === 'sleepover' && !uploadedPdfFile) {
    toast('Please upload proof of payment for sleepover bookings', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    let proofOfPayment = null;
    if (visitType === 'sleepover' && uploadedPdfFile) {
      const fileRef = ref(storage, `payment-proofs/${user.id}_${Date.now()}_${uploadedPdfFile.name}`);
      await uploadBytes(fileRef, uploadedPdfFile);
      const url = await getDownloadURL(fileRef);
      proofOfPayment = { name: uploadedPdfFile.name, url, size: uploadedPdfFile.size };
    }

    const booking = {
      studentId: user.id,
      studentName: user.name,
      studentRoom: user.roomNumber,
      studentPhone: user.phone,
      visitorName: document.getElementById('bk-visitor-name').value.trim(),
      visitorPhone: document.getElementById('bk-visitor-phone').value.trim(),
      visitorIdNumber: document.getElementById('bk-visitor-id').value.trim(),
      relationship: document.getElementById('bk-relationship').value,
      visitDate: document.getElementById('bk-date').value,
      visitTime: document.getElementById('bk-time').value,
      duration: parseInt(document.getElementById('bk-duration').value),
      type: visitType,
      notes: document.getElementById('bk-notes').value.trim(),
      proofOfPayment,
      status: 'pending',
      securityId: null,
      securityName: null,
      signedInAt: null,
      signedOutAt: null,
      createdAt: Date.now()
    };

    const docRef = await addDoc(collection(db, "bookings"), booking);

    const securities = usersCache.filter(u => u.role === 'security');
    for (const sec of securities) {
      await createNotification(sec.id, `New booking from ${user.name} + Room ${user.roomNumber}`, 'info');
    }
    await createNotification(user.id, `Your booking for ${booking.visitorName} has been submitted and is pending approval`, 'info');

    toast('Booking submitted successfully! Securities have been notified.', 'success');
    uploadedPdfFile = null;
    navigateTo('my-bookings');
  } catch (error) {
    console.error(error);
    toast('Failed to submit booking: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Booking';
  }
}

function renderMyBookings() {
  const user = getCurrentUser();
  const bookings = bookingsCache.filter(b => b.studentId === user.id).sort((a, b) => b.createdAt - a.createdAt);

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-4">
      ${bookings.length === 0 ? `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200">
          ${emptyState('calendar-x', 'No bookings yet', 'Click "Book a Visitor" to create your first booking')}
          <div class="pb-8 text-center">
            <button onclick="navigateTo('new-booking')" class="btn-primary">
              <i data-lucide="plus" class="w-4 h-4"></i> Book a Visitor
            </button>
          </div>
        </div>
      ` : bookings.map(b => bookingCard(b, 'student')).join('')}
    </div>
  `;
  lucide.createIcons();
}

// ========================= SECURITY VIEWS =========================
function renderSecurityOverview() {
  const user = getCurrentUser();
  const bookings = bookingsCache;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const approved = bookings.filter(b => b.status === 'approved').length;
  const active = bookings.filter(b => b.status === 'checked-in').length;
  const today = bookings.filter(b => b.visitDate === new Date().toISOString().split('T')[0]).length;

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-6">
      <div class="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 class="text-2xl font-extrabold mb-1">Security Panel 🔐</h2>
            <p class="text-amber-100 text-sm">${user.name} • ${user.shift || 'Day'} Shift</p>
          </div>
          <button onclick="navigateTo('pending')" class="bg-white/20 hover:bg-white/30 backdrop-blur px-5 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2">
            <i data-lucide="clipboard-check" class="w-4 h-4"></i> Review Pending
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${statCard('Pending Approvals', pending, 'clock', 'from-amber-500 to-orange-600')}
        ${statCard('Approved (Waiting)', approved, 'check-circle', 'from-blue-500 to-indigo-600')}
        ${statCard('Active Visitors', active, 'user-check', 'from-green-500 to-emerald-600')}
        ${statCard("Today's Visits", today, 'calendar', 'from-purple-500 to-pink-600')}
      </div>

      <!-- Quick Actions -->
      <div class="grid sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md transition-all" onclick="navigateTo('pending')">
          <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
            <i data-lucide="clipboard-check" class="w-5 h-5 text-amber-600"></i>
          </div>
          <h4 class="font-bold text-slate-800 text-sm">Pending Approvals</h4>
          <p class="text-xs text-slate-500 mt-1">${pending} booking(s) awaiting review</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md transition-all" onclick="navigateTo('active')">
          <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <i data-lucide="user-check" class="w-5 h-5 text-green-600"></i>
          </div>
          <h4 class="font-bold text-slate-800 text-sm">Active Visitors</h4>
          <p class="text-xs text-slate-500 mt-1">${active} visitor(s) currently checked in</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md transition-all" onclick="navigateTo('all-bookings')">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <i data-lucide="calendar-days" class="w-5 h-5 text-blue-600"></i>
          </div>
          <h4 class="font-bold text-slate-800 text-sm">All Bookings</h4>
          <p class="text-xs text-slate-500 mt-1">${bookings.length} total booking(s)</p>
        </div>
      </div>

      <!-- Recent Pending -->
      ${pending > 0 ? `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
              <span class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span> Pending Approvals
            </h3>
            <button onclick="navigateTo('pending')" class="text-sm text-brand-600 font-semibold hover:underline">View All →</button>
          </div>
          <div class="divide-y divide-slate-100">
            ${bookings.filter(b => b.status === 'pending').slice(0, 3).map(b => `
              <div class="p-4 hover:bg-slate-50 transition-colors">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <i data-lucide="user" class="w-5 h-5 text-amber-600"></i>
                    </div>
                    <div>
                      <p class="font-semibold text-slate-800 text-sm">${b.visitorName}</p>
                      <p class="text-xs text-slate-500">from ${b.studentName} • Room ${b.studentRoom}</p>
                    </div>
                  </div>
                  <button onclick="openApprovalModal('${b.id}')" class="btn-primary text-xs px-3 py-2">
                    Review & Approve
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  lucide.createIcons();
}

function renderPendingApprovals() {
  const bookings = bookingsCache.filter(b => b.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-4">
      ${bookings.length === 0 ? `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200">
          ${emptyState('check-circle', 'No pending approvals', 'All bookings have been reviewed')}
        </div>
      ` : bookings.map(b => bookingCard(b, 'security-pending')).join('')}
    </div>
  `;
  lucide.createIcons();
}

function renderActiveVisitors() {
  const bookings = bookingsCache.filter(b => b.status === 'checked-in');

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-4">
      ${bookings.length === 0 ? `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200">
          ${emptyState('user-x', 'No active visitors', 'No visitors are currently checked in')}
        </div>
      ` : bookings.map(b => bookingCard(b, 'security-active')).join('')}
    </div>
  `;
  lucide.createIcons();
}

function renderSecurityAllBookings() {
  const bookings = bookingsCache.sort((a, b) => b.createdAt - a.createdAt);

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <h3 class="font-bold text-slate-800">All Bookings</h3>
        <div class="flex items-center gap-2">
          <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input type="text" id="sec-search" oninput="filterSecurityBookings()" placeholder="Search..." class="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-48" />
          </div>
          <select id="sec-filter" onchange="filterSecurityBookings()" class="text-sm border border-slate-200 rounded-lg px-3 py-2">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="checked-in">Checked In</option>
            <option value="checked-out">Checked Out</option>
          </select>
        </div>
      </div>
      ${bookings.length === 0 ? emptyState('calendar-x', 'No bookings found', 'Bookings will appear here') : `
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Student</th><th>Room</th><th>Visitor</th><th>Phone</th><th>Date</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
            <tbody id="sec-bookings-body">
              ${bookings.map(b => `
                <tr>
                  <td class="font-semibold text-slate-800">${b.studentName}</td>
                  <td>${b.studentRoom}</td>
                  <td>${b.visitorName}</td>
                  <td class="text-slate-600">${b.visitorPhone}</td>
                  <td class="text-slate-600">${formatDate(b.visitDate)}</td>
                  <td><span class="badge badge-${b.type}">${b.type}</span></td>
                  <td>${statusBadge(b.status)}</td>
                  <td>
                    <button onclick="viewBookingDetail('${b.id}')" class="btn-ghost text-xs">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i> View
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
  lucide.createIcons();
}

function filterSecurityBookings() {
  const search = document.getElementById('sec-search')?.value.toLowerCase() || '';
  const filter = document.getElementById('sec-filter')?.value || 'all';
  const bookings = bookingsCache.sort((a, b) => b.createdAt - a.createdAt);
  const filtered = bookings.filter(b => {
    const matchSearch = !search || b.studentName.toLowerCase().includes(search) || b.visitorName.toLowerCase().includes(search) || b.studentRoom.toLowerCase().includes(search);
    const matchFilter = filter === 'all' || b.status === filter;
    return matchSearch && matchFilter;
  });

  const body = document.getElementById('sec-bookings-body');
  if (!body) return;
  body.innerHTML = filtered.length === 0 ? `<tr><td colspan="8" class="text-center py-8 text-slate-400">No bookings found</td></tr>` : filtered.map(b => `
    <tr>
      <td class="font-semibold text-slate-800">${b.studentName}</td>
      <td>${b.studentRoom}</td>
      <td>${b.visitorName}</td>
      <td class="text-slate-600">${b.visitorPhone}</td>
      <td class="text-slate-600">${formatDate(b.visitDate)}</td>
      <td><span class="badge badge-${b.type}">${b.type}</span></td>
      <td>${statusBadge(b.status)}</td>
      <td><button onclick="viewBookingDetail('${b.id}')" class="btn-ghost text-xs"><i data-lucide="eye" class="w-3.5 h-3.5"></i> View</button></td>
    </tr>
  `).join('');
  lucide.createIcons();
}

// ========================= ADMIN VIEWS =========================
function renderAdminOverview() {
  const bookings = bookingsCache;
  const users = usersCache;
  const students = users.filter(u => u.role === 'student');
  const securities = users.filter(u => u.role === 'security');
  const pending = bookings.filter(b => b.status === 'pending').length;
  const active = bookings.filter(b => b.status === 'checked-in').length;
  const completed = bookings.filter(b => b.status === 'checked-out').length;
  const sleepovers = bookings.filter(b => b.type === 'sleepover').length;

  // Recent activity
  const recent = bookings.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-6">
      <div class="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-lg">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 class="text-2xl font-extrabold mb-1">Admin Control Center 🎛️</h2>
            <p class="text-purple-100 text-sm">Complete system overview and management</p>
          </div>
          <button onclick="navigateTo('users')" class="bg-white/20 hover:bg-white/30 backdrop-blur px-5 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2">
            <i data-lucide="users" class="w-4 h-4"></i> Manage Users
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${statCard('Total Students', students.length, 'graduation-cap', 'from-blue-500 to-blue-600')}
        ${statCard('Security Staff', securities.length, 'shield-check', 'from-amber-500 to-orange-600')}
        ${statCard('Total Bookings', bookings.length, 'calendar-days', 'from-purple-500 to-indigo-600')}
        ${statCard('Sleepovers', sleepovers, 'moon', 'from-pink-500 to-rose-600')}
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${statCard('Pending', pending, 'clock', 'from-amber-500 to-orange-600')}
        ${statCard('Active Visits', active, 'user-check', 'from-green-500 to-emerald-600')}
        ${statCard('Completed', completed, 'check-circle', 'from-slate-500 to-slate-600')}
        ${statCard('Declined', bookings.filter(b => b.status === 'declined').length, 'x-circle', 'from-red-500 to-red-600')}
      </div>

      <!-- Recent Activity -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="font-bold text-slate-800">Recent Activity</h3>
          <button onclick="navigateTo('all-bookings')" class="text-sm text-brand-600 font-semibold hover:underline">View All Records →</button>
        </div>
        ${recent.length === 0 ? emptyState('inbox', 'No recent activity', 'Bookings will appear here') : `
          <div class="divide-y divide-slate-100">
            ${recent.map(b => `
              <div class="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${b.type === 'sleepover' ? 'moon' : 'user'}" class="w-5 h-5 text-slate-600"></i>
                  </div>
                  <div class="min-w-0">
                    <p class="font-semibold text-slate-800 text-sm truncate">${b.visitorName} → ${b.studentName}</p>
                    <p class="text-xs text-slate-500">Room ${b.studentRoom} • ${formatDate(b.visitDate)} at ${b.visitTime}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  ${statusBadge(b.status)}
                  ${b.securityName ? `<span class="text-xs text-slate-400">by ${b.securityName}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
  lucide.createIcons();
}

function renderAdminAllRecords() {
  const bookings = bookingsCache.sort((a, b) => b.createdAt - a.createdAt);

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-4">
      <!-- Stats Summary -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-2xl font-extrabold text-slate-800">${bookings.length}</p>
          <p class="text-xs text-slate-500 font-medium">Total Records</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-2xl font-extrabold text-amber-600">${bookings.filter(b => b.status === 'pending').length}</p>
          <p class="text-xs text-slate-500 font-medium">Pending</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-2xl font-extrabold text-green-600">${bookings.filter(b => b.status === 'checked-in').length}</p>
          <p class="text-xs text-slate-500 font-medium">Active</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-2xl font-extrabold text-slate-500">${bookings.filter(b => b.status === 'checked-out').length}</p>
          <p class="text-xs text-slate-500 font-medium">Completed</p>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-2xl font-extrabold text-red-500">${bookings.filter(b => b.status === 'declined').length}</p>
          <p class="text-xs text-slate-500 font-medium">Declined</p>
        </div>
      </div>

      <!-- Records Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 class="font-bold text-slate-800">All Visitation Records</h3>
          <div class="flex items-center gap-2">
            <div class="relative">
              <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
              <input type="text" id="admin-search" oninput="filterAdminRecords()" placeholder="Search..." class="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-48" />
            </div>
            <select id="admin-filter" onchange="filterAdminRecords()" class="text-sm border border-slate-200 rounded-lg px-3 py-2">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
            </select>
          </div>
        </div>
        ${bookings.length === 0 ? emptyState('file-x', 'No records found', 'Visitation records will appear here') : `
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead><tr><th>Student</th><th>Room</th><th>Visitor</th><th>Visitor ID</th><th>Phone</th><th>Date</th><th>Type</th><th>Status</th><th>Security</th><th>Action</th></tr></thead>
              <tbody id="admin-records-body">
                ${bookings.map(b => `
                  <tr>
                    <td class="font-semibold text-slate-800">${b.studentName}</td>
                    <td>${b.studentRoom}</td>
                    <td>${b.visitorName}</td>
                    <td class="text-slate-600 text-xs">${b.visitorIdNumber}</td>
                    <td class="text-slate-600 text-xs">${b.visitorPhone}</td>
                    <td class="text-slate-600 text-xs">${formatDate(b.visitDate)} ${b.visitTime}</td>
                    <td><span class="badge badge-${b.type}">${b.type}</span></td>
                    <td>${statusBadge(b.status)}</td>
                    <td class="text-xs text-slate-600">${b.securityName || '-'}</td>
                    <td><button onclick="viewBookingDetail('${b.id}')" class="btn-ghost text-xs"><i data-lucide="eye" class="w-3.5 h-3.5"></i> View</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
  lucide.createIcons();
}

function filterAdminRecords() {
  const search = document.getElementById('admin-search')?.value.toLowerCase() || '';
  const filter = document.getElementById('admin-filter')?.value || 'all';
  const bookings = bookingsCache.sort((a, b) => b.createdAt - a.createdAt);
  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.studentName.toLowerCase().includes(search) ||
      b.visitorName.toLowerCase().includes(search) ||
      b.studentRoom.toLowerCase().includes(search) ||
      b.visitorIdNumber.toLowerCase().includes(search) ||
      (b.securityName || '').toLowerCase().includes(search);
    const matchFilter = filter === 'all' || b.status === filter;
    return matchSearch && matchFilter;
  });

  const body = document.getElementById('admin-records-body');
  if (!body) return;
  body.innerHTML = filtered.length === 0 ? `<tr><td colspan="10" class="text-center py-8 text-slate-400">No records found</td></tr>` : filtered.map(b => `
    <tr>
      <td class="font-semibold text-slate-800">${b.studentName}</td>
      <td>${b.studentRoom}</td>
      <td>${b.visitorName}</td>
      <td class="text-slate-600 text-xs">${b.visitorIdNumber}</td>
      <td class="text-slate-600 text-xs">${b.visitorPhone}</td>
      <td class="text-slate-600 text-xs">${formatDate(b.visitDate)} ${b.visitTime}</td>
      <td><span class="badge badge-${b.type}">${b.type}</span></td>
      <td>${statusBadge(b.status)}</td>
      <td class="text-xs text-slate-600">${b.securityName || '-'}</td>
      <td><button onclick="viewBookingDetail('${b.id}')" class="btn-ghost text-xs"><i data-lucide="eye" class="w-3.5 h-3.5"></i> View</button></td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function renderUserManagement() {
  const users = usersCache.sort((a, b) => (a.role > b.role ? 1 : -1));

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in space-y-4">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 class="font-bold text-slate-800">User Management</h3>
          <button onclick="openAddUserModal()" class="btn-primary text-sm">
            <i data-lucide="user-plus" class="w-4 h-4"></i> Add Security/Admin
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Name</th><th>Role</th><th>Email/Username</th><th>Details</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${users.map(u => {
                const roleBadge = { admin: 'bg-purple-100 text-purple-700', security: 'bg-amber-100 text-amber-700', student: 'bg-blue-100 text-blue-700' };
                const extra = u.role === 'student' ? `Room ${u.roomNumber} • ${u.studentId}` : u.shift ? `Shift: ${u.shift}` : '-';
                return `
                  <tr>
                    <td class="font-semibold text-slate-800">${u.name}</td>
                    <td><span class="badge ${roleBadge[u.role]}">${u.role}</span></td>
                    <td class="text-slate-600 text-xs">${u.email || u.username}</td>
                    <td class="text-slate-600 text-xs">${extra}</td>
                    <td class="text-slate-600 text-xs">${formatDate(new Date(u.createdAt).toISOString().split('T')[0])}</td>
                    <td>
                      ${u.role !== 'admin' ? `<button onclick="deleteUser('${u.id}')" class="btn-ghost text-xs text-red-600 hover:bg-red-50"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : '<span class="text-xs text-slate-300">—</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons();
}

function openAddUserModal() {
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-slate-800">Add Security / Admin</h3>
        <button onclick="closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><i data-lucide="x" class="w-5 h-5 text-slate-500"></i></button>
      </div>
      <form onsubmit="addUser(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1.5">Full Name *</label>
          <input type="text" id="new-user-name" required class="w-full" placeholder="John Smith" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1.5">Role *</label>
            <select id="new-user-role" required class="w-full">
              <option value="security">Security</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 mb-1.5">Shift (Security)</label>
            <input type="text" id="new-user-shift" class="w-full" placeholder="Day / Night" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1.5">Email *</label>
          <input type="email" id="new-user-email" required class="w-full" placeholder="user@campus.edu" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1.5">Password *</label>
          <input type="text" id="new-user-password" required class="w-full" placeholder="Temporary password" />
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="btn-primary flex-1 justify-center"><i data-lucide="check" class="w-4 h-4"></i> Create User</button>
          <button type="button" onclick="closeModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `);
}

async function addUser(e) {
  e.preventDefault();
  const name = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;
  const shift = document.getElementById('new-user-shift').value.trim();
  const email = document.getElementById('new-user-email').value.trim().toLowerCase();
  const password = document.getElementById('new-user-password').value;

  const adminUser = getCurrentUser();
  const adminPassword = prompt(`Re-enter your admin password to confirm (this restores your session after creating the account):`);
  if (!adminPassword) {
    toast('Cancelled — admin password required', 'error');
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      name, role, email,
      shift: role === 'security' ? shift : null,
      username: email.split('@')[0],
      createdAt: Date.now()
    });

    // Firebase auto-signed-in as the new user — sign back in as admin
    await signInWithEmailAndPassword(auth, adminUser.email, adminPassword);

    toast(`${role === 'admin' ? 'Admin' : 'Security'} account created successfully`, 'success');
    closeModal();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function deleteUser(id) {
  const user = usersCache.find(u => u.id === id);
  if (!user) return;
  showConfirmModal(`Delete ${user.name}?`, `This will permanently remove ${user.name} from the system. This action cannot be undone.`, async () => {
    await deleteDoc(doc(db, "users", id));
    toast('User deleted successfully (Firestore record only — Auth account must be removed separately in Firebase Console)', 'info');
  });
}
// ========================= BOOKING CARD =========================
function bookingCard(b, context) {
  const user = getCurrentUser();
  const timeline = bookingTimeline(b);

  let actions = '';
  if (context === 'student') {
    if (b.status === 'pending') {
      actions = `<button onclick="cancelBooking('${b.id}')" class="btn-danger text-xs"><i data-lucide="x" class="w-3.5 h-3.5"></i> Cancel Booking</button>`;
    }
    if (b.proofOfPayment) {
      actions += `<button onclick="viewPdf('${b.id}')" class="btn-secondary text-xs"><i data-lucide="file-text" class="w-3.5 h-3.5"></i> View Payment Proof</button>`;
    }
  } else if (context === 'security-pending') {
    actions = `
      <button onclick="openApprovalModal('${b.id}')" class="btn-primary text-xs">
        <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i> Review Details
      </button>
    `;
  } else if (context === 'security-active') {
    actions = `
      <button onclick="signOutVisitor('${b.id}')" class="btn-danger text-xs">
        <i data-lucide="log-out" class="w-3.5 h-3.5"></i> Sign Out Visitor
      </button>
    `;
  }

  return `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden fade-in">
      <div class="p-5">
        <div class="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-gradient-to-br from-brand-500 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              ${b.visitorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h4 class="font-bold text-slate-800">${b.visitorName}</h4>
              <p class="text-xs text-slate-500">${b.relationship} • ${b.visitorPhone}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-${b.type}">${b.type}</span>
            ${statusBadge(b.status)}
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
          <div>
            <p class="text-xs text-slate-400 font-bold uppercase">Student</p>
            <p class="text-sm font-semibold text-slate-700">${b.studentName}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 font-bold uppercase">Room</p>
            <p class="text-sm font-semibold text-slate-700">${b.studentRoom}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 font-bold uppercase">Date & Time</p>
            <p class="text-sm font-semibold text-slate-700">${formatDate(b.visitDate)}</p>
            <p class="text-xs text-slate-500">at ${b.visitTime} (${b.duration}h)</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 font-bold uppercase">ID Number</p>
            <p class="text-sm font-semibold text-slate-700">${b.visitorIdNumber}</p>
          </div>
        </div>

        ${b.notes ? `<div class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"><strong>Notes:</strong> ${b.notes}</div>` : ''}

        ${b.securityName ? `<div class="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4"></i> Handled by: <strong>${b.securityName}</strong></div>` : ''}

        <!-- Timeline -->
        <div class="flex items-center gap-3 flex-wrap mb-4">
          ${timeline}
        </div>

        ${actions ? `<div class="flex gap-2 flex-wrap pt-3 border-t border-slate-100">${actions}</div>` : ''}
      </div>
    </div>
  `;
}

function bookingTimeline(b) {
  const steps = [
    { label: 'Submitted', done: true },
    { label: 'Approved', done: ['approved', 'checked-in', 'checked-out'].includes(b.status) },
    { label: 'Signed In', done: ['checked-in', 'checked-out'].includes(b.status) },
    { label: 'Signed Out', done: b.status === 'checked-out' }
  ];

  return steps.map((s, i) => `
    <div class="timeline-step">
      <div class="timeline-dot ${s.done ? 'completed' : 'pending'}"></div>
      <span class="${s.done ? 'text-slate-700 font-medium' : 'text-slate-400'}">${s.label}</span>
      ${i < steps.length - 1 ? '<span class="text-slate-300">→</span>' : ''}
    </div>
  `).join('');
}

// ========================= SECURITY ACTIONS =========================
function openApprovalModal(bookingId) {
  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) return;

  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-slate-800">Review Booking</h3>
        <button onclick="closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><i data-lucide="x" class="w-5 h-5 text-slate-500"></i></button>
      </div>

      <!-- Verification Checklist -->
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <h4 class="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
          <i data-lucide="shield-alert" class="w-4 h-4"></i> Double-Check Visitor Details
        </h4>
        <div class="space-y-2">
          ${[
            ['Visitor Name', booking.visitorName],
            ['Visitor ID Number', booking.visitorIdNumber],
            ['Visitor Phone', booking.visitorPhone],
            ['Relationship to Student', booking.relationship],
            ['Student Name', booking.studentName],
            ['Student Room', booking.studentRoom],
            ['Visit Date & Time', `${formatDate(booking.visitDate)} at ${booking.visitTime}`],
            ['Duration', `${booking.duration} hour(s)`],
            ['Visit Type', booking.type]
          ].map(([label, value]) => `
            <div class="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
              <span class="text-xs font-semibold text-amber-700">${label}</span>
              <span class="text-sm text-slate-800 font-medium">${value}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${booking.proofOfPayment ? `
        <div class="mb-5">
          <div class="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <i data-lucide="file-text" class="w-8 h-8 text-green-600"></i>
            <div class="flex-1">
              <p class="text-sm font-semibold text-green-800">Proof of Payment</p>
              <p class="text-xs text-green-600">${booking.proofOfPayment.name}</p>
            </div>
            <button onclick="viewPdf('${booking.id}')" class="btn-secondary text-xs">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> View PDF
            </button>
          </div>
        </div>
      ` : ''}

      ${booking.notes ? `<div class="mb-5 p-3 bg-slate-50 rounded-xl text-sm"><strong class="text-slate-600">Student Notes:</strong> ${booking.notes}</div>` : ''}

      <div class="mb-5">
        <label class="block text-xs font-bold text-slate-600 mb-1.5">Verification Notes (optional)</label>
        <textarea id="approval-notes" rows="2" class="w-full" placeholder="Add any verification notes..."></textarea>
      </div>

      <div class="flex gap-3">
        <button onclick="approveBooking('${booking.id}')" class="btn-success flex-1 justify-center">
          <i data-lucide="check" class="w-4 h-4"></i> Approve & Ready for Check-In
        </button>
        <button onclick="declineBooking('${booking.id}')" class="btn-danger flex-1 justify-center">
          <i data-lucide="x" class="w-4 h-4"></i> Decline
        </button>
      </div>
    </div>
  `);
}

async function approveBooking(bookingId) {
  const user = getCurrentUser();
  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) return;

  await updateDoc(doc(db, "bookings", bookingId), {
    status: 'approved',
    securityId: user.id,
    securityName: user.name,
    approvedAt: Date.now(),
    verificationNotes: document.getElementById('approval-notes')?.value || ''
  });

  await createNotification(booking.studentId, `Booking approved by ${user.name}. Your visitor ${booking.visitorName} can now arrive for check-in.`, 'success');
  toast(`Booking approved! ${booking.visitorName} can now be checked in upon arrival.`, 'success');
  closeModal();
}

async function declineBooking(bookingId) {
  const user = getCurrentUser();
  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) return;

  const reason = document.getElementById('approval-notes')?.value || 'No reason provided';

  await updateDoc(doc(db, "bookings", bookingId), {
    status: 'declined',
    securityId: user.id,
    securityName: user.name,
    declinedAt: Date.now(),
    declineReason: reason
  });

  await createNotification(booking.studentId, `Booking declined by ${user.name}. Reason: ${reason}`, 'error');
  toast('Booking declined', 'warning');
  closeModal();
}

async function signInVisitor(bookingId) {
  const user = getCurrentUser();
  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) return;

  await updateDoc(doc(db, "bookings", bookingId), {
    status: 'checked-in',
    securityId: user.id,
    securityName: user.name,
    signedInAt: new Date().toISOString()
  });

  await createNotification(booking.studentId, `Visitor ${booking.visitorName} has been signed in by ${user.name}`, 'info');
  toast(`Visitor ${booking.visitorName} signed in successfully`, 'success');
}

function signOutVisitor(bookingId) {
  const booking = bookingsCache.find(b => b.id === bookingId);
  if (!booking) return;

  showConfirmModal(
    'Sign Out Visitor?',
    `Confirm that ${booking.visitorName} (visited ${booking.studentName}, Room ${booking.studentRoom}) is leaving the campus.`,
    async () => {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: 'checked-out',
        signedOutAt: new Date().toISOString()
      });
      await createNotification(booking.studentId, `Visitor ${booking.visitorName} has been signed out. Visit completed.`, 'info');
      toast(`Visitor ${booking.visitorName} signed out successfully`, 'success');
    }
  );
}

function cancelBooking(bookingId) {
  showConfirmModal('Cancel Booking?', 'Are you sure you want to cancel this booking? This cannot be undone.', async () => {
    await deleteDoc(doc(db, "bookings", bookingId));
    toast('Booking cancelled', 'info');
  });
}

// ========================= VIEW BOOKING DETAIL =========================
function viewBookingDetail(bookingId) {
  const b = bookingsCache.find(x => x.id === bookingId);
  if (!b) return;

  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-slate-800">Booking Details</h3>
        <button onclick="closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><i data-lucide="x" class="w-5 h-5 text-slate-500"></i></button>
      </div>

      <!-- Status & Type -->
      <div class="flex items-center gap-2 mb-5">
        ${statusBadge(b.status)}
        <span class="badge badge-${b.type}">${b.type}</span>
      </div>

      <!-- Student Info -->
      <div class="mb-5">
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Student Information</h4>
        <div class="grid grid-cols-2 gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
          ${detailRow('Name', b.studentName)}
          ${detailRow('Room', b.studentRoom)}
          ${detailRow('Phone', b.studentPhone || 'N/A')}
        </div>
      </div>

      <!-- Visitor Info -->
      <div class="mb-5">
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visitor Information</h4>
        <div class="grid grid-cols-2 gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
          ${detailRow('Name', b.visitorName)}
          ${detailRow('ID Number', b.visitorIdNumber)}
          ${detailRow('Phone', b.visitorPhone)}
          ${detailRow('Relationship', b.relationship)}
        </div>
      </div>

      <!-- Visit Info -->
      <div class="mb-5">
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visit Details</h4>
        <div class="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          ${detailRow('Date', formatDate(b.visitDate))}
          ${detailRow('Time', b.visitTime)}
          ${detailRow('Duration', `${b.duration} hour(s)`)}
          ${detailRow('Type', b.type)}
        </div>
      </div>

      <!-- Security Info -->
      ${b.securityName ? `
        <div class="mb-5">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Security Information</h4>
          <div class="grid grid-cols-2 gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
            ${detailRow('Handled By', b.securityName)}
            ${detailRow('Status', b.status)}
            ${b.signedInAt ? detailRow('Signed In', formatDateTime(b.signedInAt)) : ''}
            ${b.signedOutAt ? detailRow('Signed Out', formatDateTime(b.signedOutAt)) : ''}
            ${b.declineReason ? detailRow('Decline Reason', b.declineReason) : ''}
            ${b.verificationNotes ? detailRow('Verification Notes', b.verificationNotes) : ''}
          </div>
        </div>
      ` : ''}

      ${b.proofOfPayment ? `
        <div class="mb-5">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Proof</h4>
          <div class="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <i data-lucide="file-text" class="w-8 h-8 text-green-600"></i>
            <div class="flex-1">
              <p class="text-sm font-semibold text-green-800">${b.proofOfPayment.name}</p>
              <p class="text-xs text-green-600">${(b.proofOfPayment.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onclick="viewPdf('${b.id}')" class="btn-secondary text-xs"><i data-lucide="eye" class="w-3.5 h-3.5"></i> View</button>
          </div>
        </div>
      ` : ''}

      ${b.notes ? `<div class="p-3 bg-amber-50 rounded-xl text-sm"><strong>Student Notes:</strong> ${b.notes}</div>` : ''}

      <!-- Security Actions (if security user) -->
      ${getCurrentUser()?.role === 'security' && b.status === 'approved' ? `
        <div class="mt-6 pt-4 border-t border-slate-100">
          <button onclick="signInVisitor('${b.id}'); closeModal();" class="btn-success w-full justify-center">
            <i data-lucide="user-check" class="w-4 h-4"></i> Sign In Visitor (Visitor has arrived)
          </button>
        </div>
      ` : ''}

      ${getCurrentUser()?.role === 'security' && b.status === 'pending' ? `
        <div class="mt-6 pt-4 border-t border-slate-100 flex gap-3">
          <button onclick="closeModal(); openApprovalModal('${b.id}')" class="btn-primary flex-1 justify-center">
            <i data-lucide="clipboard-check" class="w-4 h-4"></i> Review & Approve
          </button>
        </div>
      ` : ''}
    </div>
  `);
}

function detailRow(label, value) {
  return `<div><p class="text-xs text-slate-400 font-bold uppercase">${label}</p><p class="text-sm font-semibold text-slate-700">${value}</p></div>`;
}

// ========================= PDF VIEWER =========================
function viewPdf(bookingId) {
  const b = bookingsCache.find(x => x.id === bookingId);
  if (!b?.proofOfPayment) return;
  window.open(b.proofOfPayment.url, '_blank');
}

// ========================= NOTIFICATIONS PAGE =========================
function renderNotifPage() {
  const user = getCurrentUser();
  const notifications = getUserNotifications(user.id);

  document.getElementById('main-content').innerHTML = `
    <div class="fade-in bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="font-bold text-slate-800">All Notifications</h3>
        ${notifications.some(n => !n.read) ? `<button onclick="markAllRead(); renderNotifPage();" class="text-sm text-brand-600 font-semibold hover:underline">Mark All Read</button>` : ''}
      </div>
      <div class="p-4 space-y-2">
        ${notifications.length === 0 ? emptyState('bell-off', 'No notifications', 'You have no notifications') : notifications.map(n => {
          const icons = { info: 'info', success: 'check-circle', warning: 'alert-triangle', error: 'x-circle' };
          const colors = { info: 'text-blue-500 bg-blue-50', success: 'text-green-500 bg-green-50', warning: 'text-amber-500 bg-amber-50', error: 'text-red-500 bg-red-50' };
          return `
            <div class="flex items-start gap-3 p-3 rounded-xl border ${!n.read ? 'bg-brand-50 border-brand-200' : 'border-slate-200'}" onclick="markNotificationRead('${n.id}'); renderNotifPage();">
              <div class="w-9 h-9 ${colors[n.type] || colors.info} rounded-lg flex items-center justify-center flex-shrink-0">
                <i data-lucide="${icons[n.type] || 'info'}" class="w-4 h-4"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-700 leading-snug">${n.message}</p>
                <p class="text-xs text-slate-400 mt-1">${getTimeAgo(n.createdAt)}</p>
              </div>
              ${!n.read ? '<div class="w-2 h-2 bg-brand-600 rounded-full mt-2 flex-shrink-0"></div>' : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  lucide.createIcons();
}

// ========================= HELPERS =========================
function statCard(label, value, icon, gradient) {
  return `
    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center">
          <i data-lucide="${icon}" class="w-5 h-5 text-white"></i>
        </div>
      </div>
      <p class="text-3xl font-extrabold text-slate-800">${value}</p>
      <p class="text-xs text-slate-500 font-semibold mt-1">${label}</p>
    </div>
  `;
}

function statusBadge(status) {
  const badges = {
    'pending': '<span class="badge badge-pending"><i data-lucide="clock" class="w-3 h-3"></i> Pending</span>',
    'approved': '<span class="badge badge-approved"><i data-lucide="check" class="w-3 h-3"></i> Approved</span>',
    'declined': '<span class="badge badge-declined"><i data-lucide="x" class="w-3 h-3"></i> Declined</span>',
    'checked-in': '<span class="badge badge-checked-in"><i data-lucide="user-check" class="w-3 h-3"></i> Checked In</span>',
    'checked-out': '<span class="badge badge-checked-out"><i data-lucide="log-out" class="w-3 h-3"></i> Checked Out</span>'
  };
  return badges[status] || `<span class="badge">${status}</span>`;
}

function emptyState(icon, title, subtitle) {
  return `
    <div class="empty-state py-12">
      <i data-lucide="${icon}"></i>
      <p class="font-semibold text-slate-600">${title}</p>
      <p class="text-sm mt-1">${subtitle}</p>
    </div>
  `;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(new Date(timestamp).toISOString().split('T')[0]);
}

// ========================= TOAST =========================
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'check-circle', error: 'x-circle', info: 'info', warning: 'alert-triangle' };
  const colors = { success: 'text-green-600', error: 'text-red-600', info: 'text-blue-600', warning: 'text-amber-600' };

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i data-lucide="${icons[type]}" class="w-5 h-5 ${colors[type]} flex-shrink-0"></i>
    <p class="text-sm text-slate-700 font-medium flex-1">${message}</p>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(el);
  lucide.createIcons();

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    el.style.transition = 'all 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ========================= MODAL =========================
function showModal(content) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal-content max-w-lg">
        ${content}
      </div>
    </div>
  `;
  lucide.createIcons();
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function showConfirmModal(title, message, onConfirm) {
  showModal(`
    <div class="p-6">
      <div class="flex items-start gap-4 mb-5">
        <div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold text-slate-800">${title}</h3>
          <p class="text-sm text-slate-500 mt-1">${message}</p>
        </div>
      </div>
      <div class="flex gap-3">
        <button onclick="closeModal(); (${onConfirm})()" class="btn-danger flex-1 justify-center">
          <i data-lucide="check" class="w-4 h-4"></i> Confirm
        </button>
        <button onclick="closeModal()" class="btn-secondary flex-1 justify-center">Cancel</button>
      </div>
    </div>
  `);
}

// ========================= EXPOSE TO WINDOW (required since script.js is a module) =========================
window.switchAuthTab = switchAuthTab;
window.showHome = showHome;
window.goToAuth = goToAuth;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.toggleSleepoverUpload = toggleSleepoverUpload;
window.handlePdfUpload = handlePdfUpload;
window.removePdf = removePdf;
window.createBooking = createBooking;
window.navigateTo = navigateTo;
window.logout = logout;
window.toggleNotifications = toggleNotifications;
window.toggleUserMenu = toggleUserMenu;
window.toggleSidebar = toggleSidebar;
window.markAllRead = markAllRead;
window.markNotificationRead = markNotificationRead;
window.openApprovalModal = openApprovalModal;
window.approveBooking = approveBooking;
window.declineBooking = declineBooking;
window.signInVisitor = signInVisitor;
window.signOutVisitor = signOutVisitor;
window.cancelBooking = cancelBooking;
window.viewBookingDetail = viewBookingDetail;
window.viewPdf = viewPdf;
window.openAddUserModal = openAddUserModal;
window.addUser = addUser;
window.deleteUser = deleteUser;
window.closeModal = closeModal;
window.filterSecurityBookings = filterSecurityBookings;
window.filterAdminRecords = filterAdminRecords;
window.renderNotifPage = renderNotifPage;

// ========================= START =========================
initApp();