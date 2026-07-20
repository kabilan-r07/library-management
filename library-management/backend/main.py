from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import mysql.connector
from mysql.connector import Error
from datetime import date, timedelta
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Library Management System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB CONFIG ──────────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "library_db"),
}

def get_db():
    conn = mysql.connector.connect(**DB_CONFIG)
    try:
        yield conn
    finally:
        conn.close()

def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

# ── PYDANTIC MODELS ────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str
    role: str  # "staff" or "student"

class BookCreate(BaseModel):
    title: str
    author: str
    category: str
    isbn: str
    total_copies: int
    description: Optional[str] = ""

class BookUpdate(BaseModel):
    title: Optional[str]
    author: Optional[str]
    category: Optional[str]
    isbn: Optional[str]
    total_copies: Optional[int]
    description: Optional[str]

class IssueRequest(BaseModel):
    book_id: int
    student_id: int
    due_days: int = 14

class ReturnRequest(BaseModel):
    issue_id: int

class StudentCreate(BaseModel):
    name: str
    username: str
    password: str
    email: str
    roll_number: str

# ── AUTH ───────────────────────────────────────────────────────────────────────
@app.post("/api/login")
def login(req: LoginRequest, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    table = "staff" if req.role == "staff" else "students"
    cursor.execute(
        f"SELECT * FROM {table} WHERE username = %s AND password_hash = %s",
        (req.username, hash_password(req.password))
    )
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user.pop("password_hash", None)
    return {"success": True, "user": user, "role": req.role}

# ── BOOKS ──────────────────────────────────────────────────────────────────────
@app.get("/api/books")
def get_books(search: Optional[str] = None, category: Optional[str] = None, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    query = "SELECT * FROM books WHERE 1=1"
    params = []
    if search:
        query += " AND (title LIKE %s OR author LIKE %s OR isbn LIKE %s)"
        s = f"%{search}%"
        params.extend([s, s, s])
    if category:
        query += " AND category = %s"
        params.append(category)
    query += " ORDER BY title"
    cursor.execute(query, params)
    return cursor.fetchall()

@app.get("/api/books/{book_id}")
def get_book(book_id: int, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM books WHERE id = %s", (book_id,))
    book = cursor.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@app.post("/api/books")
def add_book(book: BookCreate, db=Depends(get_db)):
    cursor = db.cursor()
    cursor.execute(
        """INSERT INTO books (title, author, category, isbn, total_copies, available_copies, description)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (book.title, book.author, book.category, book.isbn,
         book.total_copies, book.total_copies, book.description)
    )
    db.commit()
    return {"success": True, "book_id": cursor.lastrowid, "message": "Book added successfully"}

@app.put("/api/books/{book_id}")
def update_book(book_id: int, book: BookUpdate, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM books WHERE id = %s", (book_id,))
    existing = cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Book not found")

    fields, params = [], []
    if book.title is not None:
        fields.append("title = %s"); params.append(book.title)
    if book.author is not None:
        fields.append("author = %s"); params.append(book.author)
    if book.category is not None:
        fields.append("category = %s"); params.append(book.category)
    if book.isbn is not None:
        fields.append("isbn = %s"); params.append(book.isbn)
    if book.description is not None:
        fields.append("description = %s"); params.append(book.description)
    if book.total_copies is not None:
        diff = book.total_copies - existing["total_copies"]
        new_available = max(0, existing["available_copies"] + diff)
        fields.append("total_copies = %s"); params.append(book.total_copies)
        fields.append("available_copies = %s"); params.append(new_available)

    if not fields:
        return {"success": True, "message": "No changes"}

    params.append(book_id)
    cursor.execute(f"UPDATE books SET {', '.join(fields)} WHERE id = %s", params)
    db.commit()
    return {"success": True, "message": "Book updated"}

@app.delete("/api/books/{book_id}")
def delete_book(book_id: int, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT COUNT(*) as cnt FROM issued_books WHERE book_id = %s AND return_date IS NULL", (book_id,))
    if cursor.fetchone()["cnt"] > 0:
        raise HTTPException(status_code=400, detail="Cannot delete book with active issues")
    cursor.execute("DELETE FROM books WHERE id = %s", (book_id,))
    db.commit()
    return {"success": True, "message": "Book deleted"}

@app.get("/api/categories")
def get_categories(db=Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT DISTINCT category FROM books ORDER BY category")
    return [row[0] for row in cursor.fetchall()]

# ── ISSUE / RETURN ─────────────────────────────────────────────────────────────
@app.post("/api/issue")
def issue_book(req: IssueRequest, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT * FROM books WHERE id = %s", (req.book_id,))
    book = cursor.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book["available_copies"] <= 0:
        raise HTTPException(status_code=400, detail="No copies available")

    cursor.execute(
        "SELECT id FROM issued_books WHERE book_id = %s AND student_id = %s AND return_date IS NULL",
        (req.book_id, req.student_id)
    )
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Student already has this book issued")

    due_date = date.today() + timedelta(days=req.due_days)
    cursor.execute(
        """INSERT INTO issued_books (book_id, student_id, issue_date, due_date)
           VALUES (%s, %s, %s, %s)""",
        (req.book_id, req.student_id, date.today(), due_date)
    )
    cursor.execute(
        "UPDATE books SET available_copies = available_copies - 1 WHERE id = %s",
        (req.book_id,)
    )
    db.commit()
    return {"success": True, "message": f"Book issued. Due date: {due_date}"}

@app.post("/api/return")
def return_book(req: ReturnRequest, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM issued_books WHERE id = %s AND return_date IS NULL", (req.issue_id,))
    issue = cursor.fetchone()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue record not found")

    cursor.execute(
        "UPDATE issued_books SET return_date = %s WHERE id = %s",
        (date.today(), req.issue_id)
    )
    cursor.execute(
        "UPDATE books SET available_copies = available_copies + 1 WHERE id = %s",
        (issue["book_id"],)
    )
    db.commit()
    return {"success": True, "message": "Book returned successfully"}

@app.get("/api/issued")
def get_issued_books(student_id: Optional[int] = None, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    query = """
        SELECT ib.*, b.title, b.author, b.category, b.isbn,
               s.name as student_name, s.roll_number,
               CASE WHEN ib.due_date < CURDATE() AND ib.return_date IS NULL
                    THEN DATEDIFF(CURDATE(), ib.due_date) ELSE 0 END as overdue_days
        FROM issued_books ib
        JOIN books b ON ib.book_id = b.id
        JOIN students s ON ib.student_id = s.id
        WHERE 1=1
    """
    params = []
    if student_id:
        query += " AND ib.student_id = %s"
        params.append(student_id)
    query += " ORDER BY ib.issue_date DESC"
    cursor.execute(query, params)
    return cursor.fetchall()

@app.get("/api/issued/active")
def get_active_issues(db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT ib.*, b.title, b.author, b.category,
               s.name as student_name, s.roll_number,
               CASE WHEN ib.due_date < CURDATE()
                    THEN DATEDIFF(CURDATE(), ib.due_date) ELSE 0 END as overdue_days
        FROM issued_books ib
        JOIN books b ON ib.book_id = b.id
        JOIN students s ON ib.student_id = s.id
        WHERE ib.return_date IS NULL
        ORDER BY ib.due_date ASC
    """)
    return cursor.fetchall()

# ── STUDENTS ───────────────────────────────────────────────────────────────────
@app.get("/api/students")
def get_students(search: Optional[str] = None, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    query = "SELECT id, name, username, email, roll_number, created_at FROM students WHERE 1=1"
    params = []
    if search:
        query += " AND (name LIKE %s OR roll_number LIKE %s OR email LIKE %s)"
        s = f"%{search}%"
        params.extend([s, s, s])
    query += " ORDER BY name"
    cursor.execute(query, params)
    return cursor.fetchall()

@app.post("/api/students")
def add_student(student: StudentCreate, db=Depends(get_db)):
    cursor = db.cursor()
    try:
        cursor.execute(
            """INSERT INTO students (name, username, password_hash, email, roll_number)
               VALUES (%s, %s, %s, %s, %s)""",
            (student.name, student.username, hash_password(student.password),
             student.email, student.roll_number)
        )
        db.commit()
        return {"success": True, "student_id": cursor.lastrowid}
    except Error as e:
        if "Duplicate" in str(e):
            raise HTTPException(status_code=400, detail="Username or roll number already exists")
        raise HTTPException(status_code=500, detail=str(e))

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    roll_number: Optional[str] = None
    password: Optional[str] = None

@app.put("/api/students/{student_id}")
def update_student(student_id: int, student: StudentUpdate, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM students WHERE id = %s", (student_id,))
    existing = cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Student not found")

    fields, params = [], []
    if student.name is not None:
        fields.append("name = %s"); params.append(student.name)
    if student.email is not None:
        fields.append("email = %s"); params.append(student.email)
    if student.roll_number is not None:
        fields.append("roll_number = %s"); params.append(student.roll_number)
    if student.password:
        fields.append("password_hash = %s"); params.append(hash_password(student.password))

    if not fields:
        return {"success": True, "message": "No changes"}

    params.append(student_id)
    try:
        cursor.execute(f"UPDATE students SET {', '.join(fields)} WHERE id = %s", params)
        db.commit()
        return {"success": True, "message": "Student updated"}
    except Error as e:
        if "Duplicate" in str(e):
            raise HTTPException(status_code=400, detail="Roll number already exists")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/students/{student_id}")
def delete_student(student_id: int, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM issued_books WHERE student_id = %s AND return_date IS NULL",
        (student_id,)
    )
    if cursor.fetchone()["cnt"] > 0:
        raise HTTPException(status_code=400, detail="Cannot delete: student has books not yet returned")
    cursor.execute("SELECT COUNT(*) as cnt FROM students WHERE id = %s", (student_id,))
    if cursor.fetchone()["cnt"] == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    cursor.execute("DELETE FROM students WHERE id = %s", (student_id,))
    db.commit()
    return {"success": True, "message": "Student removed"}


# ── DASHBOARD STATS ────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats(db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT COUNT(*) as total FROM books")
    total_books = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) as total FROM students")
    total_students = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) as total FROM issued_books WHERE return_date IS NULL")
    active_issues = cursor.fetchone()["total"]
    cursor.execute("""
        SELECT COUNT(*) as total FROM issued_books
        WHERE return_date IS NULL AND due_date < CURDATE()
    """)
    overdue = cursor.fetchone()["total"]
    cursor.execute("SELECT SUM(total_copies) as t, SUM(available_copies) as a FROM books")
    row = cursor.fetchone()
    return {
        "total_books": total_books,
        "total_students": total_students,
        "active_issues": active_issues,
        "overdue_count": overdue,
        "total_copies": row["t"] or 0,
        "available_copies": row["a"] or 0,
    }

@app.get("/api/student/{student_id}/stats")
def get_student_stats(student_id: int, db=Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT COUNT(*) as total FROM issued_books WHERE student_id = %s AND return_date IS NULL",
        (student_id,)
    )
    active = cursor.fetchone()["total"]
    cursor.execute(
        "SELECT COUNT(*) as total FROM issued_books WHERE student_id = %s AND return_date IS NOT NULL",
        (student_id,)
    )
    returned = cursor.fetchone()["total"]
    cursor.execute("""
        SELECT COUNT(*) as total FROM issued_books
        WHERE student_id = %s AND return_date IS NULL AND due_date < CURDATE()
    """, (student_id,))
    overdue = cursor.fetchone()["total"]
    return {"active_books": active, "returned_books": returned, "overdue_books": overdue}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
