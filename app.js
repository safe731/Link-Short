import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
            apiKey: "AIzaSyDzrJEtCzXP2N7lms1JwlGElcZSQzgasms",
            authDomain: "sky-tools-aa38e.firebaseapp.com",
            projectId: "sky-tools-aa38e",
            storageBucket: "sky-tools-aa38e.firebasestorage.app",
            messagingSenderId: "433524203749",
            appId: "1:433524203749:web:f88d7901e6cd12b0a8f40c",
            measurementId: "G-7LR4NG8J6W"
        };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let userTokens = 0;
let userLinks = [];
let activeFilter = 'all';

// Global Navigation
window.navigate = function(view) {
  const views = ['home', 'auth', 'dashboard', 'html', 'shortener', 'multipage', 'unlock'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if(el) el.classList.add('hidden');
  });
  const target = document.getElementById(`view-${view}`);
  if(target) target.classList.remove('hidden');

  if(view === 'dashboard') {
    loadDashboardLinks();
  }
};

window.showToast = function(msg, isError = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');
  
  toastMsg.innerText = msg;
  toastIcon.className = isError ? "fa-solid fa-circle-exclamation text-red-400 text-lg" : "fa-solid fa-circle-check text-emerald-400 text-lg";
  
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
};

// Authentication State Observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('nav-login-btn').classList.add('hidden');
    document.getElementById('nav-logout-btn').classList.remove('hidden');
    document.getElementById('nav-tokens').classList.remove('hidden');
    document.getElementById('nav-tokens').classList.add('flex');
    document.getElementById('nav-dashboard-btn').classList.remove('hidden');
    document.getElementById('nav-dashboard-btn').classList.add('flex');

    const userRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      userTokens = snapshot.val().tokens || 0;
    } else {
      userTokens = 100;
      await set(userRef, { tokens: 100, email: user.email });
    }
    document.getElementById('user-tokens-count').innerText = userTokens;
    document.getElementById('stat-token-balance').innerText = userTokens;
  } else {
    currentUser = null;
    document.getElementById('nav-login-btn').classList.remove('hidden');
    document.getElementById('nav-logout-btn').classList.add('hidden');
    document.getElementById('nav-tokens').classList.add('hidden');
    document.getElementById('nav-tokens').classList.remove('flex');
    document.getElementById('nav-dashboard-btn').classList.add('hidden');
    document.getElementById('nav-dashboard-btn').classList.remove('flex');
  }
});

window.loginWithGoogle = async function() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    showToast("Signed in successfully!");
    navigate('home');
  } catch(e) {
    showToast(e.message, true);
  }
};

window.handleEmailAuth = async function(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const pass = document.getElementById('auth-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Signed in!");
    navigate('home');
  } catch(err) {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      showToast("Account created!");
      navigate('home');
    } catch(e2) {
      showToast(e2.message, true);
    }
  }
};

window.handleLogout = function() {
  signOut(auth);
  showToast("Logged out");
  navigate('home');
};

// Link Management Dashboard Functions
window.loadDashboardLinks = async function() {
  const container = document.getElementById('dashboard-links-list');
  if (!currentUser) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <p>Please Sign In to view your Link Management Dashboard.</p>
        <button onclick="navigate('auth')" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">Sign In Now</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="p-8 text-center text-slate-500 text-sm">Loading your links...</div>`;

  try {
    const linksRef = ref(db, `links`);
    const snapshot = await get(linksRef);
    userLinks = [];
    let totalClicks = 0;

    if (snapshot.exists()) {
      const allData = snapshot.val();
      Object.keys(allData).forEach(key => {
        const item = allData[key];
        if (item.userId === currentUser.uid) {
          item.id = key;
          userLinks.push(item);
          totalClicks += (item.clicks || 0);
        }
      });
    }

    document.getElementById('stat-total-links').innerText = userLinks.length;
    document.getElementById('stat-total-clicks').innerText = totalClicks;

    renderFilteredDashboard();
  } catch(err) {
    container.innerHTML = `<div class="p-8 text-center text-red-400 text-sm">Failed to load links: ${err.message}</div>`;
  }
};

window.filterDashboard = function(type) {
  activeFilter = type;
  ['all', 'short', 'html', 'multipage', 'unlock'].forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (btn) {
      if (t === type) {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white";
      } else {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700";
      }
    }
  });
  renderFilteredDashboard();
};

function renderFilteredDashboard() {
  const container = document.getElementById('dashboard-links-list');
  let filtered = userLinks;
  if (activeFilter !== 'all') {
    filtered = userLinks.filter(l => l.type === activeFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-sm">No links found under this category.</div>`;
    return;
  }

  const baseUrl = window.location.origin + window.location.pathname;

  container.innerHTML = filtered.map(item => {
    let fullLink = "";
    let badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    let typeLabel = "Short Link";

    if (item.type === 'html') {
      fullLink = `${baseUrl}?site=${item.id}`;
      typeLabel = "HTML Page";
      badgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    } else if (item.type === 'multipage') {
      fullLink = `${baseUrl}?m=${item.id}`;
      typeLabel = "3-Page";
      badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
    } else if (item.type === 'unlock') {
      fullLink = `${baseUrl}?unlock=${item.id}`;
      typeLabel = "Sub4Sub Gate";
      badgeColor = "bg-red-500/10 text-red-400 border-red-500/20";
    } else {
      fullLink = `${baseUrl}?s=${item.id}`;
    }

    return `
      <div class="p-4 hover:bg-slate-800/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="space-y-1 min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}">${typeLabel}</span>
            <span class="text-xs text-slate-400">${item.title || item.alias || item.id}</span>
          </div>
          <div class="text-sm font-medium text-white truncate max-w-md">
            <a href="${fullLink}" target="_blank" class="hover:underline text-blue-400">${fullLink}</a>
          </div>
          <div class="text-xs text-slate-500 truncate">
            Target: ${item.targetUrl || item.target || 'Hosted Page'}
          </div>
        </div>

        <div class="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <div class="text-right">
            <div class="text-xs font-bold text-emerald-400"><i class="fa-solid fa-chart-simple mr-1"></i>${item.clicks || 0} Clicks</div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="copyToClipboard('${fullLink}')" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition">
              <i class="fa-solid fa-copy"></i>
            </button>
            <button onclick="deleteLink('${item.id}')" class="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text);
  showToast("Link copied to clipboard!");
};

window.deleteLink = async function(id) {
  if (!confirm("Are you sure you want to delete this link?")) return;
  try {
    await remove(ref(db, `links/${id}`));
    showToast("Link deleted successfully");
    loadDashboardLinks();
  } catch(e) {
    showToast(e.message, true);
  }
};

// Link Creation Handlers
window.generateHtmlHost = async function() {
  if(!currentUser) return navigate('auth');
  if(userTokens < 1) return showToast("Not enough tokens!", true);

  const title = document.getElementById('html-title').value || "Hosted HTML";
  const code = document.getElementById('html-code').value;
  if(!code) return showToast("Please enter HTML code", true);

  const id = Math.random().toString(36).substring(2, 8);
  await set(ref(db, `links/${id}`), {
    type: 'html',
    title: title,
    html: code,
    userId: currentUser.uid,
    clicks: 0,
    createdAt: Date.now()
  });

  userTokens -= 1;
  await update(ref(db, `users/${currentUser.uid}`), { tokens: userTokens });
  document.getElementById('user-tokens-count').innerText = userTokens;

  showToast("HTML Page Published!");
  navigate('dashboard');
};

window.generateShortUrl = async function() {
  if(!currentUser) return navigate('auth');
  const target = document.getElementById('short-url').value;
  const alias = document.getElementById('short-alias').value;
  if(!target) return showToast("Enter a URL", true);

  const id = alias ? alias : Math.random().toString(36).substring(2, 8);
  await set(ref(db, `links/${id}`), {
    type: 'short',
    targetUrl: target,
    userId: currentUser.uid,
    clicks: 0,
    createdAt: Date.now()
  });

  showToast("Short Link Created!");
  navigate('dashboard');
};

window.generateMultipageLink = async function() {
  if(!currentUser) return navigate('auth');
  const target = document.getElementById('multi-url').value;
  const timer = parseInt(document.getElementById('multi-timer').value) || 10;
  if(!target) return showToast("Enter target URL", true);

  const id = Math.random().toString(36).substring(2, 8);
  await set(ref(db, `links/${id}`), {
    type: 'multipage',
    targetUrl: target,
    timer: timer,
    userId: currentUser.uid,
    clicks: 0,
    createdAt: Date.now()
  });

  showToast("3-Page Link Created!");
  navigate('dashboard');
};

window.generateUnlockGate = async function() {
  if(!currentUser) return navigate('auth');
  const target = document.getElementById('unlock-target').value;
  const yt = document.getElementById('unlock-yt').value;
  const ig = document.getElementById('unlock-ig').value;
  if(!target || !yt) return showToast("Target URL and YouTube URL required", true);

  const id = Math.random().toString(36).substring(2, 8);
  await set(ref(db, `links/${id}`), {
    type: 'unlock',
    targetUrl: target,
    ytChannel: yt,
    igProfile: ig,
    userId: currentUser.uid,
    clicks: 0,
    createdAt: Date.now()
  });

  showToast("Unlock Gate Created!");
  navigate('dashboard');
};
