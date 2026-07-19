-- ============================================================
--  Library Management System — Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS library_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library_db;

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(64)  NOT NULL,
    email         VARCHAR(100),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(64)  NOT NULL,
    email         VARCHAR(100),
    roll_number   VARCHAR(20)  NOT NULL UNIQUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(200) NOT NULL,
    author           VARCHAR(100) NOT NULL,
    category         VARCHAR(50)  NOT NULL,
    isbn             VARCHAR(20),
    total_copies     INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    description      TEXT,
    added_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_copies CHECK (available_copies >= 0 AND available_copies <= total_copies)
);

-- Issued books table
CREATE TABLE IF NOT EXISTS issued_books (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    book_id     INT  NOT NULL,
    student_id  INT  NOT NULL,
    issue_date  DATE NOT NULL,
    due_date    DATE NOT NULL,
    return_date DATE DEFAULT NULL,
    FOREIGN KEY (book_id)    REFERENCES books(id)    ON DELETE RESTRICT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

-- ── SEED DATA ────────────────────────────────────────────────────────────────

-- Default staff  (password: staff123)
INSERT IGNORE INTO staff (name, username, password_hash, email) VALUES
('Library Admin', 'admin',
 '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6',
 'admin@library.edu'),
('Priya Sharma', 'priya',
 '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6',
 'priya@library.edu');

-- Default students  (password: student123)
INSERT IGNORE INTO students (name, username, password_hash, email, roll_number) VALUES
('Kabil Rajan',   'kabil',   '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', 'kabil@college.edu',   'CS2024001'),
('Preethi S',     'preethi', '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', 'preethi@college.edu', 'CS2024002'),
('Arjun Kumar',   'arjun',   '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', 'arjun@college.edu',   'CS2024003');

-- Seed books
INSERT IGNORE INTO books (title, author, category, isbn, total_copies, available_copies, description) VALUES
('Thirukkural', 'Thiruvalluvar', 'Tamil Literature',
 '978-0-14-303065-1', 10, 10,
 'Ancient Tamil text consisting of 1330 couplets on ethics, political and economical matters, love.'),
('Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', 'Computer Science',
 '978-0-26-203384-8', 5, 5,
 'Comprehensive introduction to modern algorithms — the standard CS reference.'),
('Clean Code', 'Robert C. Martin', 'Computer Science',
 '978-0-13-235088-4', 4, 4,
 'A handbook of agile software craftsmanship. Essential for every developer.'),
('The Alchemist', 'Paulo Coelho', 'Fiction',
 '978-0-06-231500-7', 8, 8,
 'A magical story about following your dreams and listening to your heart.'),
('Wings of Fire', 'A.P.J. Abdul Kalam', 'Autobiography',
 '978-81-7371-146-6', 6, 6,
 'Autobiography of India''s Missile Man and former President.'),
('Atomic Habits', 'James Clear', 'Self-Help',
 '978-0-73-521129-2', 7, 7,
 'An easy and proven way to build good habits and break bad ones.'),
('Design Patterns', 'Gang of Four', 'Computer Science',
 '978-0-20-163361-5', 3, 3,
 'Elements of reusable object-oriented software — the classic patterns book.'),
('Rich Dad Poor Dad', 'Robert Kiyosaki', 'Finance',
 '978-1-61-268017-5', 5, 5,
 'What the rich teach their kids about money that the poor do not.'),
('Sapiens', 'Yuval Noah Harari', 'History',
 '978-0-06-231609-7', 4, 4,
 'A brief history of humankind from the Stone Age to the 21st century.'),
('The Pragmatic Programmer', 'Andrew Hunt & David Thomas', 'Computer Science',
 '978-0-13-595705-9', 3, 3,
 'Your journey to mastery — timeless advice for software developers.');
