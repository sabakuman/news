import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it';
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Initialize Database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    name TEXT,
    email TEXT,
    role TEXT,
    status TEXT,
    departmentId TEXT
  );

  CREATE TABLE IF NOT EXISTS news_items (
    id TEXT PRIMARY KEY,
    title TEXT,
    type TEXT,
    departmentId TEXT,
    content TEXT,
    contentFileName TEXT,
    preparedBy TEXT,
    isEdited INTEGER DEFAULT 0,
    isReviewed INTEGER DEFAULT 0,
    reviewerName TEXT,
    reviewerFileName TEXT,
    isApprovedByDept INTEGER DEFAULT 0,
    approverName TEXT,
    approverFileName TEXT,
    isApprovedByFinal INTEGER DEFAULT 0,
    finalApproverName TEXT,
    finalApproverFileName TEXT,
    otherType TEXT,
    publishDate TEXT,
    notes TEXT,
    newsUrl TEXT,
    isArchived INTEGER DEFAULT 0,
    status TEXT,
    createdBy TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    newsItemId TEXT,
    userId TEXT,
    action TEXT,
    previousStatus TEXT,
    newStatus TEXT,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    newsItemId TEXT,
    userId TEXT,
    text TEXT,
    createdAt TEXT
  );
`);

// Seed initial admin user
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (uid, username, password, name, email, role, status, departmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('admin-uid', 'admin', hashedPassword, 'المسؤول الرئيسي', 'admin@mohre.gov.ae', 'admin', 'active', 'media_dept');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ uid: user.uid, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const user: any = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // User Management Routes (Admin only)
  app.get('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const users = db.prepare('SELECT uid, username, name, email, role, status, departmentId FROM users').all();
    res.json(users);
  });

  app.post('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, name, email, role, status, departmentId } = req.body;
    const uid = 'user-' + Date.now();
    const hashedPassword = bcrypt.hashSync(password, 10);
    try {
      db.prepare('INSERT INTO users (uid, username, password, name, email, role, status, departmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(uid, username, hashedPassword, name, email, role, status, departmentId);
      res.json({ uid, username, name, email, role, status, departmentId });
    } catch (e) {
      res.status(400).json({ error: 'Username already exists' });
    }
  });

  app.delete('/api/users/:uid', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.params.uid === req.user.uid) return res.status(400).json({ error: 'Cannot delete yourself' });
    
    db.prepare('DELETE FROM users WHERE uid = ?').run(req.params.uid);
    res.json({ success: true });
  });

  // News Routes
  app.get('/api/news', authenticateToken, (req, res) => {
    const news = db.prepare('SELECT * FROM news_items ORDER BY createdAt DESC').all();
    res.json(news.map((item: any) => ({
      ...item,
      isEdited: !!item.isEdited,
      isReviewed: !!item.isReviewed,
      isApprovedByDept: !!item.isApprovedByDept,
      isApprovedByFinal: !!item.isApprovedByFinal,
      isArchived: !!item.isArchived,
    })));
  });

  app.get('/api/news/:id', authenticateToken, (req, res) => {
    const item: any = db.prepare('SELECT * FROM news_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...item,
      isEdited: !!item.isEdited,
      isReviewed: !!item.isReviewed,
      isApprovedByDept: !!item.isApprovedByDept,
      isApprovedByFinal: !!item.isApprovedByFinal,
      isArchived: !!item.isArchived,
    });
  });

  app.post('/api/news', authenticateToken, (req: any, res) => {
    const item = req.body;
    const id = item.id || 'news-' + Date.now();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO news_items (
        id, title, type, departmentId, content, contentFileName, preparedBy, 
        isEdited, isReviewed, reviewerName, reviewerFileName, 
        isApprovedByDept, approverName, approverFileName, 
        isApprovedByFinal, finalApproverName, finalApproverFileName, 
        otherType, publishDate, notes, newsUrl, isArchived, status, createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, item.title, item.type, item.departmentId, item.content, item.contentFileName, item.preparedBy,
      item.isEdited ? 1 : 0, item.isReviewed ? 1 : 0, item.reviewerName, item.reviewerFileName,
      item.isApprovedByDept ? 1 : 0, item.approverName, item.approverFileName,
      item.isApprovedByFinal ? 1 : 0, item.finalApproverName, item.finalApproverFileName,
      item.otherType, item.publishDate, item.notes, item.newsUrl, item.isArchived ? 1 : 0, item.status, req.user.uid, now, now
    );

    res.json({ id, ...item });
  });

  app.put('/api/news/:id', authenticateToken, (req, res) => {
    const item = req.body;
    const now = new Date().toISOString();
    
    // Check if archived
    const existing: any = db.prepare('SELECT isArchived FROM news_items WHERE id = ?').get(req.params.id);
    if (existing?.isArchived) {
      return res.status(403).json({ error: 'Archived items cannot be modified' });
    }

    db.prepare(`
      UPDATE news_items SET 
        title = ?, type = ?, departmentId = ?, content = ?, contentFileName = ?, preparedBy = ?, 
        isEdited = ?, isReviewed = ?, reviewerName = ?, reviewerFileName = ?, 
        isApprovedByDept = ?, approverName = ?, approverFileName = ?, 
        isApprovedByFinal = ?, finalApproverName = ?, finalApproverFileName = ?, 
        otherType = ?, publishDate = ?, notes = ?, newsUrl = ?, isArchived = ?, status = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      item.title, item.type, item.departmentId, item.content, item.contentFileName, item.preparedBy,
      item.isEdited ? 1 : 0, item.isReviewed ? 1 : 0, item.reviewerName, item.reviewerFileName,
      item.isApprovedByDept ? 1 : 0, item.approverName, item.approverFileName,
      item.isApprovedByFinal ? 1 : 0, item.finalApproverName, item.finalApproverFileName,
      item.otherType, item.publishDate, item.notes, item.newsUrl, item.isArchived ? 1 : 0, item.status, now, req.params.id
    );

    res.json({ id: req.params.id, ...item });
  });

  app.delete('/api/news/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    // Check if archived
    const existing: any = db.prepare('SELECT isArchived FROM news_items WHERE id = ?').get(req.params.id);
    if (existing?.isArchived) {
      return res.status(403).json({ error: 'Archived items cannot be deleted' });
    }

    db.prepare('DELETE FROM news_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Archive Route
  app.post('/api/news/:id/archive', authenticateToken, (req, res) => {
    const now = new Date().toISOString();
    db.prepare('UPDATE news_items SET isArchived = 1, updatedAt = ? WHERE id = ?').run(now, req.params.id);
    res.json({ success: true });
  });

  // Activity Logs
  app.get('/api/activity-logs', authenticateToken, (req, res) => {
    const newsItemId = req.query.newsItemId;
    let logs;
    if (newsItemId) {
      logs = db.prepare('SELECT * FROM activity_logs WHERE newsItemId = ? ORDER BY timestamp DESC').all(newsItemId);
    } else {
      logs = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50').all();
    }
    res.json(logs);
  });

  app.post('/api/activity-logs', authenticateToken, (req, res) => {
    const log = req.body;
    const id = 'log-' + Date.now();
    db.prepare('INSERT INTO activity_logs (id, newsItemId, userId, action, previousStatus, newStatus, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, log.newsItemId, log.userId, log.action, log.previousStatus, log.newStatus, log.timestamp);
    res.json({ id, ...log });
  });

  // Comments
  app.get('/api/news/:id/comments', authenticateToken, (req, res) => {
    const comments = db.prepare('SELECT * FROM comments WHERE newsItemId = ? ORDER BY createdAt ASC').all(req.params.id);
    res.json(comments);
  });

  app.post('/api/news/:id/comments', authenticateToken, (req: any, res) => {
    const { text } = req.body;
    const id = 'comment-' + Date.now();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO comments (id, newsItemId, userId, text, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.params.id, req.user.uid, text, now);
    res.json({ id, newsItemId: req.params.id, userId: req.user.uid, text, createdAt: now });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
