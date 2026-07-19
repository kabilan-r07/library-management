// ── LOGIN PAGE ─────────────────────────────────────────────────

let selectedRole = 'staff';

// ROLE TABS
document.querySelectorAll('.role-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRole = btn.dataset.role;
  });
});

// DEMO CARDS — click to autofill
document.querySelectorAll('.demo-card').forEach(card => {
  card.addEventListener('click', () => {
    const { u, p, r } = card.dataset;
    document.getElementById('username').value = u;
    document.getElementById('password').value = p;
    // set role
    selectedRole = r;
    document.querySelectorAll('.role-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.role === r);
    });
  });
});

// TOGGLE PASSWORD
document.getElementById('togglePw').addEventListener('click', () => {
  const inp = document.getElementById('password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

// FORM SUBMIT
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('errorMsg');
  const btn      = document.getElementById('loginBtn');
  const btnText  = btn.querySelector('.btn-text');
  const loader   = btn.querySelector('.btn-loader');

  if (!username || !password) {
    showError('Please fill in all fields');
    return;
  }

  btnText.style.display = 'none';
  loader.style.display  = 'inline';
  btn.disabled = true;
  errorEl.classList.remove('visible');

  try {
    const data = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role: selectedRole }),
    });
    const json = await data.json();
    if (!data.ok) throw new Error(json.detail || 'Login failed');

    sessionStorage.setItem('lms_user', JSON.stringify(json.user));
    sessionStorage.setItem('lms_role', selectedRole);

    window.location.href = selectedRole === 'staff' ? 'staff.html' : 'student.html';
  } catch (err) {
    showError(err.message);
  } finally {
    btnText.style.display = 'inline';
    loader.style.display  = 'none';
    btn.disabled = false;
  }
});

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.add('visible');
}
