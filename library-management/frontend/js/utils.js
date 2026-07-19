// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.animation = 'none'; el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// ── API HELPER ─────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'API error');
  return data;
}

// ── DATE HELPERS ───────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate, returnDate) {
  if (returnDate) return false;
  return new Date(dueDate) < new Date();
}

function overdueDays(dueDate) {
  const diff = Math.floor((new Date() - new Date(dueDate)) / 86400000);
  return diff > 0 ? diff : 0;
}

// ── AVAILABILITY PILL ──────────────────────────────────────────
function copyPill(avail, total) {
  if (avail === 0) return `<span class="copy-pill out">0/${total} Out of Stock</span>`;
  if (avail <= 2)  return `<span class="copy-pill low">${avail}/${total} Low</span>`;
  return `<span class="copy-pill ok">${avail}/${total} Available</span>`;
}

// ── STATUS BADGE ───────────────────────────────────────────────
function statusBadge(issue) {
  if (issue.return_date) return `<span class="badge badge-green">Returned</span>`;
  if (isOverdue(issue.due_date)) return `<span class="badge badge-red">Overdue ${overdueDays(issue.due_date)}d</span>`;
  return `<span class="badge badge-amber">Active</span>`;
}

// ── SIDEBAR + TOPBAR SETUP ─────────────────────────────────────
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const closeBtn = document.getElementById('sidebarClose');
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  hamburger?.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
  });
  closeBtn?.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  }

  // NAV
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const sec = link.dataset.section;
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(`sec-${sec}`)?.classList.add('active');
      const title = link.textContent.trim();
      document.getElementById('pageTitle').textContent = title;
      closeSidebar();
      // fire section-specific loaders
      window.onSectionChange?.(sec);
    });
  });

  // Date
  const d = new Date();
  document.getElementById('topbarDate').textContent =
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ── LOGOUT ─────────────────────────────────────────────────────
function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('lms_user');
    sessionStorage.removeItem('lms_role');
    window.location.href = 'index.html';
  });
}

// ── AUTH GUARD ──────────────────────────────────────────────────
function authGuard(expectedRole) {
  const user = JSON.parse(sessionStorage.getItem('lms_user') || 'null');
  const role = sessionStorage.getItem('lms_role');
  if (!user || role !== expectedRole) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

// ── DEBOUNCE ────────────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
