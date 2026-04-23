import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it';
const DB_PATH = path.join(__dirname, 'data', 'news.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

async function startServer() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // SQLite configuration
  await db.run('PRAGMA foreign_keys = ON;');
  await db.run('PRAGMA journal_mode = WAL;');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      department_id TEXT
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      department_id TEXT NOT NULL,
      content TEXT NOT NULL,
      content_file_name TEXT,
      prepared_by TEXT,
      is_edited INTEGER DEFAULT 0,
      is_reviewed INTEGER DEFAULT 0,
      reviewer_name TEXT,
      reviewer_file_name TEXT,
      is_approved_by_dept INTEGER DEFAULT 0,
      approver_name TEXT,
      approver_file_name TEXT,
      is_approved_by_final INTEGER DEFAULT 0,
      final_approver_name TEXT,
      final_approver_file_name TEXT,
      other_type TEXT,
      publish_date TEXT,
      notes TEXT,
      news_url TEXT,
      is_archived INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(uid)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      news_item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (news_item_id) REFERENCES news_items(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(uid)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      news_item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (news_item_id) REFERENCES news_items(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(uid)
    );

    CREATE INDEX IF NOT EXISTS idx_news_items_created_at ON news_items(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_news_item_id ON activity_logs(news_item_id);
    CREATE INDEX IF NOT EXISTS idx_comments_news_item_id ON comments(news_item_id);
  `);

  // Seed initial admin user if not exists
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@mohre.gov.ae';
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin';
  
  const adminExists = await db.get('SELECT uid FROM users WHERE username = ?', 'admin');

  if (!adminExists) {
    console.log('Seeding initial admin user...');
    const hashedPassword = bcrypt.hashSync(initialAdminPassword, 10);
    await db.run(
      'INSERT INTO users (uid, username, password, name, email, role, status, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['admin-uid', 'admin', hashedPassword, 'المسؤول الرئيسي', initialAdminEmail, 'admin', 'active', 'media_dept']
    );
    console.log('Admin user seeded successfully.');
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust proxy is required for secure cookies behind a proxy
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ uid: user.uid, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: false, 
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 
    });
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      ...userWithoutPassword,
      departmentId: user.department_id
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    const user = await db.get('SELECT * FROM users WHERE uid = ?', req.user.uid);

    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      ...userWithoutPassword,
      departmentId: user.department_id
    });
  });

  app.post('/api/auth/change-password', authenticateToken, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await db.get('SELECT * FROM users WHERE uid = ?', req.user.uid);

    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    await db.run('UPDATE users SET password = ? WHERE uid = ?', [hashedNewPassword, req.user.uid]);
    res.json({ success: true });
  });

  // User Management Routes (Admin only)
  app.get('/api/users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    const users = await db.all('SELECT uid, username, name, email, role, status, department_id FROM users');
    
    res.json(users.map(u => ({
      ...u,
      departmentId: u.department_id
    })));
  });

  app.post('/api/users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, name, email, role, status, departmentId } = req.body;
    
    const existing = await db.get('SELECT uid FROM users WHERE username = ? COLLATE NOCASE', username);

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const uid = 'user-' + Date.now();
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await db.run(
      'INSERT INTO users (uid, username, password, name, email, role, status, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, username, hashedPassword, name, email, role, status, departmentId]
    );

    res.json({ uid, username, name, email, role, status, departmentId });
  });

  app.put('/api/users/:uid', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, name, email, role, status, departmentId } = req.body;
    
    const user = await db.get('SELECT * FROM users WHERE uid = ?', req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let query = 'UPDATE users SET username = ?, name = ?, email = ?, role = ?, status = ?, department_id = ?';
    let params = [username, name, email, role, status, departmentId];

    if (password) {
      query += ', password = ?';
      params.push(bcrypt.hashSync(password, 10));
    }

    query += ' WHERE uid = ?';
    params.push(req.params.uid);

    try {
      await db.run(query, params);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/users/:uid', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.params.uid === req.user.uid) return res.status(400).json({ error: 'Cannot delete yourself' });
    
    await db.run('DELETE FROM users WHERE uid = ?', req.params.uid);
    res.json({ success: true });
  });

  // News Routes
  app.get('/api/news', authenticateToken, async (req, res) => {
    const news = await db.all('SELECT * FROM news_items ORDER BY created_at DESC');

    const mappedNews = news.map(n => ({
      ...n,
      isEdited: !!n.is_edited,
      isReviewed: !!n.is_reviewed,
      isApprovedByDept: !!n.is_approved_by_dept,
      isApprovedByFinal: !!n.is_approved_by_final,
      isArchived: !!n.is_archived,
      departmentId: n.department_id,
      contentFileName: n.content_file_name,
      preparedBy: n.prepared_by,
      reviewerName: n.reviewer_name,
      reviewerFileName: n.reviewer_file_name,
      approverName: n.approver_name,
      approverFileName: n.approver_file_name,
      finalApproverName: n.final_approver_name,
      finalApproverFileName: n.final_approver_file_name,
      otherType: n.other_type,
      publishDate: n.publish_date,
      newsUrl: n.news_url,
      createdBy: n.created_by,
      createdAt: n.created_at,
      updatedAt: n.updated_at
    }));
    res.json(mappedNews);
  });

  app.get('/api/news/:id', authenticateToken, async (req, res) => {
    const item = await db.get('SELECT * FROM news_items WHERE id = ?', req.params.id);

    if (!item) return res.status(404).json({ error: 'Not found' });

    res.json({
      ...item,
      isEdited: !!item.is_edited,
      isReviewed: !!item.is_reviewed,
      isApprovedByDept: !!item.is_approved_by_dept,
      isApprovedByFinal: !!item.is_approved_by_final,
      isArchived: !!item.is_archived,
      departmentId: item.department_id,
      contentFileName: item.content_file_name,
      preparedBy: item.prepared_by,
      reviewerName: item.reviewer_name,
      reviewerFileName: item.reviewer_file_name,
      approverName: item.approver_name,
      approverFileName: item.approver_file_name,
      finalApproverName: item.final_approver_name,
      finalApproverFileName: item.final_approver_file_name,
      otherType: item.other_type,
      publishDate: item.publish_date,
      newsUrl: item.news_url,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    });
  });

  app.post('/api/news', authenticateToken, async (req: any, res) => {
    const item = req.body;
    const id = item.id || 'news-' + Date.now();
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO news_items (
        id, title, type, department_id, content, content_file_name, prepared_by,
        is_edited, is_reviewed, reviewer_name, reviewer_file_name,
        is_approved_by_dept, approver_name, approver_file_name,
        is_approved_by_final, final_approver_name, final_approver_file_name,
        other_type, publish_date, notes, news_url, is_archived, status,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, item.title, item.type, item.departmentId, item.content, item.contentFileName, item.preparedBy,
      item.isEdited ? 1 : 0, item.isReviewed ? 1 : 0, item.reviewerName, item.reviewerFileName,
      item.isApprovedByDept ? 1 : 0, item.approverName, item.approverFileName,
      item.isApprovedByFinal ? 1 : 0, item.finalApproverName, item.finalApproverFileName,
      item.otherType, item.publishDate, item.notes, item.newsUrl, item.isArchived ? 1 : 0, item.status || 'review',
      req.user.uid, now, now
    ]);

    const newItem = await db.get('SELECT * FROM news_items WHERE id = ?', id);
    res.json(newItem);
  });

  app.put('/api/news/:id', authenticateToken, async (req, res) => {
    const item = req.body;
    const now = new Date().toISOString();
    
    const existing = await db.get('SELECT is_archived FROM news_items WHERE id = ?', req.params.id);

    if (!existing) return res.status(404).json({ error: 'Not found' });
    
    if (existing.is_archived) {
      return res.status(403).json({ error: 'Archived items cannot be modified' });
    }

    await db.run(`
      UPDATE news_items SET
        title = ?, type = ?, department_id = ?, content = ?, content_file_name = ?, prepared_by = ?,
        is_edited = ?, is_reviewed = ?, reviewer_name = ?, reviewer_file_name = ?,
        is_approved_by_dept = ?, approver_name = ?, approver_file_name = ?,
        is_approved_by_final = ?, final_approver_name = ?, final_approver_file_name = ?,
        other_type = ?, publish_date = ?, notes = ?, news_url = ?, is_archived = ?, status = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      item.title, item.type, item.departmentId, item.content, item.contentFileName, item.preparedBy,
      item.isEdited ? 1 : 0, item.isReviewed ? 1 : 0, item.reviewerName, item.reviewerFileName,
      item.isApprovedByDept ? 1 : 0, item.approverName, item.approverFileName,
      item.isApprovedByFinal ? 1 : 0, item.finalApproverName, item.finalApproverFileName,
      item.otherType, item.publishDate, item.notes, item.newsUrl, item.isArchived ? 1 : 0, item.status,
      now, req.params.id
    ]);

    const updated = await db.get('SELECT * FROM news_items WHERE id = ?', req.params.id);
    res.json(updated);
  });

  app.delete('/api/news/:id', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    const item = await db.get('SELECT is_archived FROM news_items WHERE id = ?', req.params.id);

    if (!item) return res.status(404).json({ error: 'Not found' });
    
    if (item.is_archived) {
      return res.status(403).json({ error: 'Archived items cannot be deleted' });
    }

    await db.run('DELETE FROM news_items WHERE id = ?', req.params.id);
    res.json({ success: true });
  });

  // Archive Route
  app.post('/api/news/:id/archive', authenticateToken, async (req, res) => {
    await db.run('UPDATE news_items SET is_archived = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), req.params.id]);
    res.json({ success: true });
  });

  // Activity Logs
  app.get('/api/activity-logs', authenticateToken, async (req, res) => {
    const newsItemId = req.query.newsItemId;
    let logs;
    
    if (newsItemId) {
      logs = await db.all('SELECT * FROM activity_logs WHERE news_item_id = ? ORDER BY timestamp DESC LIMIT 50', newsItemId);
    } else {
      logs = await db.all('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50');
    }

    const mappedLogs = logs.map(l => ({
      ...l,
      newsItemId: l.news_item_id,
      userId: l.user_id,
      previousStatus: l.previous_status,
      newStatus: l.new_status
    }));
    res.json(mappedLogs);
  });

  app.post('/api/activity-logs', authenticateToken, async (req, res) => {
    const log = req.body;
    const id = 'log-' + Date.now();
    
    await db.run(`
      INSERT INTO activity_logs (id, news_item_id, user_id, action, previous_status, new_status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, log.newsItemId, log.userId, log.action, log.previousStatus, log.newStatus, log.timestamp]);

    res.json({ id, ...log });
  });

  // Comments
  app.get('/api/news/:id/comments', authenticateToken, async (req, res) => {
    const comments = await db.all('SELECT * FROM comments WHERE news_item_id = ? ORDER BY created_at ASC', req.params.id);

    const mappedComments = comments.map(c => ({
      ...c,
      newsItemId: c.news_item_id,
      userId: c.user_id,
      createdAt: c.created_at
    }));
    res.json(mappedComments);
  });

  app.post('/api/news/:id/comments', authenticateToken, async (req: any, res) => {
    const { text } = req.body;
    const id = 'comment-' + Date.now();
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO comments (id, news_item_id, user_id, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, req.params.id, req.user.uid, text, now]);

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
