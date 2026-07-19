// ── STUDENT DASHBOARD ──────────────────────────────────────────

let currentUser = null;

// ── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  currentUser = authGuard('student');
  if (!currentUser) return;

  document.getElementById('stuName').textContent    = currentUser.name;
  document.getElementById('stuAvatar').textContent  = currentUser.name[0].toUpperCase();
  document.getElementById('stuRoll').textContent    = currentUser.roll_number || 'Student';
  document.getElementById('welcomeName').textContent = currentUser.name.split(' ')[0];

  initSidebar();
  initLogout();

  loadStudentStats();
  loadCurrentBooks();
  loadBrowseCategories();
  browseBooks();

  window.onSectionChange = sec => {
    if (sec === 'dashboard') { loadStudentStats(); loadCurrentBooks(); }
    if (sec === 'browse')    browseBooks();
    if (sec === 'mybooks')   loadMyBooks();
    if (sec === 'history')   loadHistory();
  };
});

// ── STUDENT STATS ─────────────────────────────────────────────
async function loadStudentStats() {
  try {
    const s = await api(`/api/student/${currentUser.id}/stats`);
    document.getElementById('stu-active').textContent   = s.active_books;
    document.getElementById('stu-returned').textContent = s.returned_books;
    document.getElementById('stu-overdue').textContent  = s.overdue_books;
  } catch(e) {}
}

// ── CURRENT BOOKS (dashboard) ─────────────────────────────────
async function loadCurrentBooks() {
  const grid = document.getElementById('currentBooksGrid');
  try {
    const issues = await api(`/api/issued?student_id=${currentUser.id}`);
    const active  = issues.filter(i => !i.return_date);

    if (!active.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-mute)">
          <div style="font-size:40px;margin-bottom:12px">📚</div>
          <div>You have no books checked out.</div>
          <button class="btn btn-primary" style="margin-top:16px"
            onclick="document.querySelector('[data-section=browse]').click()">Browse Books</button>
        </div>`;
      return;
    }

    grid.innerHTML = active.map(i => {
      const od = isOverdue(i.due_date);
      return `
        <div class="due-card ${od ? 'overdue' : ''}">
          <div class="due-book-icon">📖</div>
          <div class="due-info">
            <div class="due-title">${i.title}</div>
            <div class="due-author">${i.author}</div>
            <div class="due-dates">
              <div class="due-date-item"><strong>Issued</strong>${fmt(i.issue_date)}</div>
              <div class="due-date-item"><strong>Due</strong>${fmt(i.due_date)}</div>
            </div>
          </div>
          ${od
            ? `<span class="badge badge-red">Overdue ${overdueDays(i.due_date)}d</span>`
            : `<span class="badge badge-amber">Active</span>`}
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = '<div class="loading-row">Error loading books</div>';
  }
}

// ── BROWSE BOOKS ──────────────────────────────────────────────
async function loadBrowseCategories() {
  try {
    const cats = await api('/api/categories');
    const sel = document.getElementById('browseCat');
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  } catch(e) {}
}

async function browseBooks() {
  const grid   = document.getElementById('browseGrid');
  const search = document.getElementById('browseSearch').value;
  const cat    = document.getElementById('browseCat').value;
  grid.innerHTML = '<div class="loading-row" style="grid-column:1/-1">Loading…</div>';

  try {
    let url = '/api/books?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (cat)    url += `category=${encodeURIComponent(cat)}`;
    const books = await api(url);

    if (!books.length) {
      grid.innerHTML = '<div class="loading-row" style="grid-column:1/-1">No books found</div>';
      return;
    }

    grid.innerHTML = books.map(b => {
      const color = getCatColor(b.category);
      const outOfStock = b.available_copies === 0;
      return `
        <div class="book-card" style="--card-accent:${color}">
          <div class="book-card-top">
            <span class="book-category" style="color:${color};background:${color}22">${b.category}</span>
            ${copyPill(b.available_copies, b.total_copies)}
          </div>
          <div class="book-title">${b.title}</div>
          <div class="book-author">by ${b.author}</div>
          ${b.description ? `<div class="book-desc">${b.description.slice(0,100)}${b.description.length>100?'…':''}</div>` : ''}
          <div class="book-copies-row">
            <span style="font-size:12px;color:var(--text-mute)">
              📚 ${b.total_copies} total &nbsp;·&nbsp; ✅ ${b.available_copies} available
            </span>
          </div>
          <div class="book-card-footer">
            ${outOfStock
              ? `<span class="badge badge-red">Out of Stock</span>`
              : `<span style="font-size:12px;color:var(--text-sec)">ISBN: ${b.isbn || 'N/A'}</span>`}
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = '<div class="loading-row" style="grid-column:1/-1">Error loading books</div>';
  }
}

// ── MY BOOKS ──────────────────────────────────────────────────
async function loadMyBooks() {
  const tbody = document.getElementById('myBooksBody');
  try {
    const issues = await api(`/api/issued?student_id=${currentUser.id}`);
    const active = issues.filter(i => !i.return_date);
    if (!active.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No books currently borrowed</td></tr>';
      return;
    }
    tbody.innerHTML = active.map(i => `
      <tr>
        <td><strong>${i.title}</strong></td>
        <td>${i.author}</td>
        <td><span class="badge badge-purple">${i.category}</span></td>
        <td>${fmt(i.issue_date)}</td>
        <td>${fmt(i.due_date)}</td>
        <td>${statusBadge(i)}</td>
      </tr>
    `).join('');
  } catch(e) {}
}

// ── HISTORY ───────────────────────────────────────────────────
async function loadHistory() {
  const tbody = document.getElementById('historyBody');
  try {
    const issues = await api(`/api/issued?student_id=${currentUser.id}`);
    if (!issues.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No borrowing history yet</td></tr>';
      return;
    }
    tbody.innerHTML = issues.map(i => `
      <tr>
        <td><strong>${i.title}</strong></td>
        <td>${i.author}</td>
        <td><span class="badge badge-purple">${i.category}</span></td>
        <td>${fmt(i.issue_date)}</td>
        <td>${fmt(i.due_date)}</td>
        <td>${i.return_date ? fmt(i.return_date) : '—'}</td>
        <td>${statusBadge(i)}</td>
      </tr>
    `).join('');
  } catch(e) {}
}
