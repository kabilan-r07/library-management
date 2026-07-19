# 📚 Biblioteca — Library Management System

A full-stack Library Management System with a dark glassmorphism UI, FastAPI backend, and MySQL database.

---

## 🗂 Project Structure

```
library-management/
├── backend/
│   ├── main.py          ← FastAPI application
│   ├── schema.sql       ← MySQL database schema + seed data
│   └── requirements.txt ← Python dependencies
└── frontend/
    ├── index.html       ← Login page
    ├── staff.html       ← Staff dashboard
    ├── student.html     ← Student dashboard
    ├── css/
    │   ├── global.css
    │   ├── login.css
    │   └── dashboard.css
    └── js/
        ├── config.js    ← API base URL
        ├── utils.js     ← Shared helpers
        ├── login.js
        ├── staff.js
        └── student.js
```

---

## ⚙️ Setup Instructions

### 1. MySQL Database

Open MySQL Workbench or terminal and run:

```sql
source backend/schema.sql
```

This creates the `library_db` database with tables and seed data.

---

### 2. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt

# Optional: create .env file for custom DB credentials
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=yourpassword
# DB_NAME=library_db

uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

### 3. Frontend

Simply open `frontend/index.html` in a browser, or serve it with any static server:

```bash
# Using Python
cd frontend
python -m http.server 5500

# Using VS Code Live Server
# Right-click index.html → Open with Live Server
```

> Make sure the API URL in `frontend/js/config.js` matches your FastAPI server.

---

## 🔐 Demo Credentials

| Role    | Username | Password   |
|---------|----------|------------|
| Staff   | admin    | staff123   |
| Staff   | priya    | staff123   |
| Student | kabil    | student123 |
| Student | preethi  | student123 |
| Student | arjun    | student123 |

---

## ✨ Features

### Staff Portal
- 📊 Dashboard with live stats (books, students, issues, overdue)
- 📖 Add, edit, delete books with total/available copy tracking
- 📤 Issue books with student + book autocomplete search
- 📥 Return books with one click
- ⚠️ Overdue tracking on dashboard
- 🎓 Add and manage students

### Student Portal
- 🏠 Dashboard showing borrowed books and due dates
- 🔍 Browse & search all books (by title, author, category)
- 📋 View currently borrowed books
- 🕐 Full borrowing history
- 🚫 Out-of-stock books clearly marked

### Copy Tracking
- Each book has `total_copies` and `available_copies`
- Issuing a book decrements available copies
- Returning a book increments available copies
- Out-of-stock books cannot be issued
- Staff can update total copies (e.g., library acquires more)

---

## 🛠 Tech Stack

| Layer     | Technology          |
|-----------|---------------------|
| Frontend  | HTML5, CSS3, Vanilla JS |
| Backend   | FastAPI (Python)    |
| Database  | MySQL               |
| Fonts     | Playfair Display, Inter, JetBrains Mono |
| Design    | Dark theme, CSS variables, Glassmorphism |
