// ── STAFF DASHBOARD ────────────────────────────────────────────

let currentUser = null;
let allIssues   = [];
let selectedStudentId = null;
let selectedBookId    = null;
let allStudents = [];
// ── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  currentUser = authGuard('staff');
  if (!currentUser) return;

  document.getElementById('staffName').textContent   = currentUser.name;
  document.getElementById('staffAvatar').textContent = currentUser.name[0].toUpperCase();

  initSidebar();
  initLogout();

  loadStats();
  loadOverdue();
  loadCategories();
  loadBooks();
  loadActiveIssues();
  loadActiveForReturn();
  loadStudents();

  // Book search debounce
  document.getElementById('bookSearch').addEventListener('input', debounce(loadBooks, 400));
  document.getElementById('catFilter').addEventListener('change', loadBooks);

  // Issue autocompletes
  document.getElementById('issueStudentSearch').addEventListener('input', debounce(searchStudents, 350));
  document.getElementById('issueBookSearch').addEventListener('input', debounce(searchBooksAC, 350));

  window.onSectionChange = sec => {
    if (sec === 'dashboard') { loadStats(); loadOverdue(); }
    if (sec === 'books') loadBooks();
    if (sec === 'issue') { loadActiveIssues(); }
    if (sec === 'returns') loadActiveForReturn();
    if (sec === 'students') loadStudents();
  };
});

// ── STATS ────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await api('/api/stats');
    document.getElementById('stat-books').textContent        = s.total_books;
    document.getElementById('stat-students').textContent     = s.total_students;
    document.getElementById('stat-issued').textContent       = s.active_issues;
    document.getElementById('stat-overdue').textContent      = s.overdue_count;
    document.getElementById('stat-total-copies').textContent = s.total_copies;
    document.getElementById('stat-avail-copies').textContent = s.available_copies;
  } catch(e) { showToast('Failed to load stats', 'error'); }
}

// ── OVERDUE TABLE ─────────────────────────────────────────────
async function loadOverdue() {
  const tbody = document.getElementById('overdueBody');
  try {
    const issues = await api('/api/issued/active');
    const overdue = issues.filter(i => new Date(i.due_date) < new Date());
    if (!overdue.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No overdue books 🎉</td></tr>';
      return;
    }
    tbody.innerHTML = overdue.map(i => `
      <tr>
        <td><strong>${i.title}</strong></td>
        <td>${i.student_name}</td>
        <td><code>${i.roll_number}</code></td>
        <td>${fmt(i.due_date)}</td>
        <td><span class="overdue-tag">${overdueDays(i.due_date)}d overdue</span></td>
        <td>
          <button class="btn btn-success btn-sm" onclick="quickReturn(${i.id})">Return</button>
        </td>
      </tr>
    `).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Error loading data</td></tr>'; }
}

// ── BOOKS TABLE ───────────────────────────────────────────────
async function loadBooks() {
  const tbody  = document.getElementById('booksBody');
  const search = document.getElementById('bookSearch').value;
  const cat    = document.getElementById('catFilter').value;
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading…</td></tr>';
  try {
    let url = '/api/books?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (cat)    url += `category=${encodeURIComponent(cat)}`;
    const books = await api(url);
    if (!books.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No books found</td></tr>';
      return;
    }
    tbody.innerHTML = books.map(b => `
      <tr>
        <td><strong>${b.title}</strong></td>
        <td>${b.author}</td>
        <td><span class="badge badge-purple">${b.category}</span></td>
        <td><code style="font-size:12px">${b.isbn || '—'}</code></td>
        <td style="text-align:center">${b.total_copies}</td>
        <td style="text-align:center">${copyPill(b.available_copies, b.total_copies)}</td>
        <td>
          <div class="action-group">
            <button class="btn btn-sm btn-amber" onclick="openBookModal(${b.id})">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteBook(${b.id}, '${b.title.replace(/'/g,"\\'")}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Error</td></tr>'; }
}

async function loadCategories() {
  try {
    const cats = await api('/api/categories');
    const sel  = document.getElementById('catFilter');
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  } catch(e) {}
}

// ── BOOK MODAL ────────────────────────────────────────────────
async function openBookModal(bookId = null) {
  document.getElementById('editBookId').value = bookId || '';
  document.getElementById('bookModalTitle').textContent = bookId ? 'Edit Book' : 'Add Book';
  document.getElementById('bookFormMsg').className = 'form-msg';

  if (bookId) {
    try {
      const b = await api(`/api/books/${bookId}`);
      document.getElementById('fTitle').value    = b.title;
      document.getElementById('fAuthor').value   = b.author;
      document.getElementById('fCategory').value = b.category;
      document.getElementById('fIsbn').value     = b.isbn || '';
      document.getElementById('fCopies').value   = b.total_copies;
      document.getElementById('fDesc').value     = b.description || '';
    } catch(e) { showToast('Failed to load book', 'error'); return; }
  } else {
    ['fTitle','fAuthor','fCategory','fIsbn','fDesc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fCopies').value = '1';
  }
  document.getElementById('bookModal').classList.add('open');
}

function closeBookModal() {
  document.getElementById('bookModal').classList.remove('open');
}

async function saveBook() {
  const id    = document.getElementById('editBookId').value;
  const msgEl = document.getElementById('bookFormMsg');
  const payload = {
    title:        document.getElementById('fTitle').value.trim(),
    author:       document.getElementById('fAuthor').value.trim(),
    category:     document.getElementById('fCategory').value.trim(),
    isbn:         document.getElementById('fIsbn').value.trim(),
    total_copies: parseInt(document.getElementById('fCopies').value),
    description:  document.getElementById('fDesc').value.trim(),
  };
  if (!payload.title || !payload.author || !payload.category) {
    msgEl.textContent = 'Title, author and category are required';
    msgEl.className = 'form-msg error';
    return;
  }
  try {
    if (id) {
      await api(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/books', { method: 'POST', body: JSON.stringify(payload) });
    }
    showToast(id ? 'Book updated!' : 'Book added!', 'success');
    closeBookModal();
    loadBooks();
    loadStats();
  } catch(e) {
    msgEl.textContent = e.message;
    msgEl.className = 'form-msg error';
  }
}

async function deleteBook(id, title) {
  if (!confirm(`Delete "${title}"?\nThis cannot be undone.`)) return;
  try {
    await api(`/api/books/${id}`, { method: 'DELETE' });
    showToast('Book deleted', 'success');
    loadBooks();
    loadStats();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── ISSUE ─────────────────────────────────────────────────────
async function searchStudents() {
  const q = document.getElementById('issueStudentSearch').value.trim();
  const ac = document.getElementById('studentAutocomplete');
  if (q.length < 2) { ac.classList.remove('open'); return; }
  try {
    const students = await api(`/api/students?search=${encodeURIComponent(q)}`);
    ac.innerHTML = students.slice(0,8).map(s => `
      <div class="ac-item" onclick="selectStudent(${s.id}, '${s.name.replace(/'/g,"\\'")}', '${s.roll_number}')">
        <span>${s.name}</span>
        <span class="ac-item-sub">${s.roll_number}</span>
      </div>
    `).join('') || '<div class="ac-item" style="color:var(--text-mute)">No students found</div>';
    ac.classList.add('open');
  } catch(e) {}
}

function selectStudent(id, name, roll) {
  selectedStudentId = id;
  document.getElementById('issueStudentSearch').value = '';
  document.getElementById('studentAutocomplete').classList.remove('open');
  const chip = document.getElementById('selectedStudent');
  chip.style.display = 'inline-flex';
  chip.innerHTML = `🎓 ${name} (${roll}) <span class="chip-remove" onclick="clearStudent()">✕</span>`;
}

function clearStudent() {
  selectedStudentId = null;
  document.getElementById('selectedStudent').style.display = 'none';
}

async function searchBooksAC() {
  const q  = document.getElementById('issueBookSearch').value.trim();
  const ac = document.getElementById('bookAutocomplete');
  if (q.length < 2) { ac.classList.remove('open'); return; }
  try {
    const books = await api(`/api/books?search=${encodeURIComponent(q)}`);
    ac.innerHTML = books.slice(0,8).map(b => `
      <div class="ac-item ${b.available_copies===0?'style="opacity:.5;pointer-events:none"':''}"
           onclick="selectBook(${b.id}, '${b.title.replace(/'/g,"\\'")}', ${b.available_copies})">
        <span>${b.title}</span>
        <span class="ac-item-sub">${copyPill(b.available_copies, b.total_copies)}</span>
      </div>
    `).join('') || '<div class="ac-item" style="color:var(--text-mute)">No books found</div>';
    ac.classList.add('open');
  } catch(e) {}
}

function selectBook(id, title, avail) {
  if (avail === 0) { showToast('This book is out of stock', 'error'); return; }
  selectedBookId = id;
  document.getElementById('issueBookSearch').value = '';
  document.getElementById('bookAutocomplete').classList.remove('open');
  const chip = document.getElementById('selectedBook');
  chip.style.display = 'inline-flex';
  chip.innerHTML = `📖 ${title} <span class="chip-remove" onclick="clearBook()">✕</span>`;
}

function clearBook() {
  selectedBookId = null;
  document.getElementById('selectedBook').style.display = 'none';
}

async function issueBook() {
  const msgEl = document.getElementById('issueMsg');
  if (!selectedStudentId) { setMsg(msgEl, 'Please select a student', 'error'); return; }
  if (!selectedBookId)    { setMsg(msgEl, 'Please select a book', 'error');    return; }
  const dueDays = parseInt(document.getElementById('dueDays').value);
  try {
    await api('/api/issue', { method: 'POST', body: JSON.stringify({
      book_id: selectedBookId, student_id: selectedStudentId, due_days: dueDays
    })});
    showToast('Book issued successfully!', 'success');
    setMsg(msgEl, 'Book issued successfully!', 'success');
    clearStudent(); clearBook();
    loadActiveIssues();
    loadStats();
  } catch(e) { setMsg(msgEl, e.message, 'error'); }
}

async function loadActiveIssues() {
  const tbody = document.getElementById('activeIssuesBody');
  try {
    const issues = await api('/api/issued/active');
    if (!issues.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No active issues</td></tr>';
      return;
    }
    tbody.innerHTML = issues.map(i => `
      <tr>
        <td><strong>${i.title}</strong></td>
        <td>${i.student_name}</td>
        <td>${fmt(i.issue_date)}</td>
        <td>${fmt(i.due_date)}</td>
        <td>${statusBadge(i)}</td>
      </tr>
    `).join('');
  } catch(e) {}
}

// ── RETURNS ───────────────────────────────────────────────────
async function loadActiveForReturn() {
  const tbody = document.getElementById('returnsBody');
  try {
    const issues = await api('/api/issued/active');
    allIssues = issues;
    renderReturns(issues);
  } catch(e) { tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Error</td></tr>'; }
}

function filterReturns() {
  const q = document.getElementById('returnSearch').value.toLowerCase();
  const filtered = allIssues.filter(i =>
    i.title.toLowerCase().includes(q) ||
    i.student_name.toLowerCase().includes(q) ||
    i.roll_number.toLowerCase().includes(q)
  );
  renderReturns(filtered);
}

function renderReturns(issues) {
  const tbody = document.getElementById('returnsBody');
  if (!issues.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No active issues</td></tr>';
    return;
  }
  tbody.innerHTML = issues.map(i => `
    <tr>
      <td><strong>${i.title}</strong></td>
      <td>${i.author}</td>
      <td>${i.student_name}</td>
      <td><code>${i.roll_number}</code></td>
      <td>${fmt(i.issue_date)}</td>
      <td>${fmt(i.due_date)}</td>
      <td>${statusBadge(i)}</td>
      <td>
        <button class="btn btn-success btn-sm" onclick="quickReturn(${i.id})">📥 Return</button>
      </td>
    </tr>
  `).join('');
}

async function quickReturn(issueId) {
  if (!confirm('Confirm book return?')) return;
  try {
    await api('/api/return', { method: 'POST', body: JSON.stringify({ issue_id: issueId }) });
    showToast('Book returned!', 'success');
    loadActiveForReturn();
    loadActiveIssues();
    loadStats();
    loadOverdue();
    loadBooks();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── STUDENTS ──────────────────────────────────────────────────
async function loadStudents() {
  const tbody = document.getElementById('studentsBody');
  const q = document.getElementById('studentSearch').value;
  try {
    const students = await api(`/api/students?search=${encodeURIComponent(q)}`);
    allStudents = students;
    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No students found</td></tr>';
      return;
    }
    tbody.innerHTML = students.map(s => `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td><code>${s.username}</code></td>
        <td>${s.email || '—'}</td>
        <td><span class="badge badge-purple">${s.roll_number}</span></td>
        <td>${fmt(s.created_at)}</td>
        <td>
          <div class="action-group">
            <button class="btn btn-sm btn-amber" onclick="openStudentModal(${s.id})">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id}, '${s.name.replace(/'/g,"\\'")}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch(e) {}
}

function openStudentModal(id = null) {
  document.getElementById('editStudentId').value = id || '';
  document.getElementById('studentModalTitle').textContent = id ? 'Edit Student' : 'Add Student';
  document.getElementById('studentFormMsg').className = 'form-msg';

  if (id) {
    const s = allStudents.find(x => x.id === id);
    if (s) {
      document.getElementById('sName').value  = s.name;
      document.getElementById('sRoll').value  = s.roll_number;
      document.getElementById('sUser').value  = s.username;
      document.getElementById('sEmail').value = s.email || '';
    }
    document.getElementById('sPass').value = '';
    document.getElementById('sPass').placeholder = 'Leave blank to keep current password';
    document.getElementById('sPassLabel').textContent = 'Reset Password (optional)';
  } else {
    ['sName','sRoll','sUser','sPass','sEmail'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('sPass').placeholder = 'password';
    document.getElementById('sPassLabel').textContent = 'Password *';
  }
  document.getElementById('studentModal').classList.add('open');
}

function closeStudentModal() {
  document.getElementById('studentModal').classList.remove('open');
}

async function saveStudent() {
  const id    = document.getElementById('editStudentId').value;
  const msgEl = document.getElementById('studentFormMsg');
  const name  = document.getElementById('sName').value.trim();
  const roll  = document.getElementById('sRoll').value.trim();
  const user  = document.getElementById('sUser').value.trim();
  const pass  = document.getElementById('sPass').value;
  const email = document.getElementById('sEmail').value.trim();

  if (!name || !roll || !user) {
    setMsg(msgEl, 'Name, roll number and username are required', 'error');
    return;
  }
  if (!id && !pass) {
    setMsg(msgEl, 'Password is required for new students', 'error');
    return;
  }

  try {
    if (id) {
      const payload = { name, roll_number: roll, email };
      if (pass) payload.password = pass;
      await api(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Student updated!', 'success');
    } else {
      await api('/api/students', { method: 'POST', body: JSON.stringify({ name, roll_number: roll, username: user, password: pass, email }) });
      showToast('Student added!', 'success');
    }
    closeStudentModal();
    loadStudents();
    loadStats();
  } catch(e) { setMsg(msgEl, e.message, 'error'); }
}

async function deleteStudent(id, name) {
  if (!confirm(`Remove "${name}"?\nThey will no longer be able to log in.`)) return;
  try {
    await api(`/api/students/${id}`, { method: 'DELETE' });
    showToast('Student removed', 'success');
    loadStudents();
    loadStats();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── HELPERS ────────────────────────────────────────────────────
function setMsg(el, msg, type) {
  el.textContent = msg;
  el.className = `form-msg ${type}`;
}
