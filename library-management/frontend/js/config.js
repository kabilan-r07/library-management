// ── API BASE URL ──────────────────────────────────────────────
// Change this to match your FastAPI server address
const API_BASE = 'http://localhost:8000';

// ── CATEGORY ACCENT COLORS ────────────────────────────────────
const CAT_COLORS = {
  'Computer Science': '#6C63FF',
  'Tamil Literature': '#F5A623',
  'Fiction':          '#00C9A7',
  'Autobiography':    '#FC5C65',
  'Self-Help':        '#45B7D1',
  'Finance':          '#96CEB4',
  'History':          '#E056D8',
  'Science':          '#F9CA24',
  'Mathematics':      '#6AB04C',
  'default':          '#6C63FF',
};

function getCatColor(cat) {
  return CAT_COLORS[cat] || CAT_COLORS['default'];
}
