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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it';

async function startServer() {
  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  const dbPath = path.join(dataDir, 'news.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // SQLite config
  await db.run('PRAGMA foreign_keys = ON;');
  await db.run('PRAGMA journal_mode = WAL;');

  // Initialize tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      departmentId TEXT
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      departmentId TEXT NOT NULL,
      content TEXT NOT NULL,
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
      status TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (createdBy) REFERENCES users(uid)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      newsItemId TEXT NOT NULL,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      previousStatus TEXT,
      newStatus TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (newsItemId) REFERENCES news_items(id),
      FOREIGN KEY (userId) REFERENCES users(uid)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      newsItemId TEXT NOT NULL,
      userId TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (newsItemId) REFERENCES news_items(id),
      FOREIGN KEY (userId) REFERENCES users(uid)
    );
  `);

  // Migration from lowdb if database.json exists and SQLite is empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const lowdbPath = path.join(process.cwd(), 'database.json');
    if (fs.existsSync(lowdbPath)) {
      try {
        const lowdbData = JSON.parse(fs.readFileSync(lowdbPath, 'utf-8'));
        
        // Migrate users
        for (const user of lowdbData.users || []) {
          await db.run(
            'INSERT INTO users (uid, username, password, name, email, role, status, departmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user.uid, user.username, user.password, user.name, user.email, user.role, user.status, user.departmentId]
          );
        }

        // Migrate news items
        for (const item of lowdbData.news_items || []) {
          await db.run(
            `INSERT INTO news_items (
              id, title, type, departmentId, content, contentFileName, preparedBy, 
              isEdited, isReviewed, reviewerName, reviewerFileName, 
              isApprovedByDept, approverName, approverFileName, 
              isApprovedByFinal, finalApproverName, finalApproverFileName, 
              otherType, publishDate, notes, newsUrl, isArchived, status, createdBy, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id, item.title, item.type, item.departmentId, item.content, item.contentFileName, item.preparedBy,
              item.isEdited ? 1 : 0, item.isReviewed ? 1 : 0, item.reviewerName, item.reviewerFileName,
              item.isApprovedByDept ? 1 : 0, item.approverName, item.approverFileName,
              item.isApprovedByFinal ? 1 : 0, item.finalApproverName, item.finalApproverFileName,
              item.otherType, item.publishDate, item.notes, item.newsUrl, item.isArchived ? 1 : 0, item.status, item.createdBy, item.createdAt, item.updatedAt
            ]
          );
        }

        // Migrate logs
        for (const log of lowdbData.activity_logs || []) {
          await db.run(
            'INSERT INTO activity_logs (id, newsItemId, userId, action, previousStatus, newStatus, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [log.id, log.newsItemId, log.userId, log.action, log.previousStatus, log.newStatus, log.timestamp]
          );
        }

        // Migrate comments
        for (const comment of lowdbData.comments || []) {
          await db.run(
            'INSERT INTO comments (id, newsItemId, userId, text, createdAt) VALUES (?, ?, ?, ?, ?)',
            [comment.id, comment.newsItemId, comment.userId, comment.text, comment.createdAt]
          );
        }
        console.log('Successfully migrated data from lowdb to SQLite');
      } catch (err) {
        console.error('Error migrating data from lowdb:', err);
      }
    }
  }

  // Seed initial admin user if still empty
  const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin', 10);
    await db.run(
      'INSERT INTO users (uid, username, password, name, email, role, status, departmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['admin-uid', 'admin', hashedPassword, 'المسؤول الرئيسي', 'admin@mohre.gov.ae', 'admin', 'active', 'media_dept']
    );
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
      console.log('No token found in cookies');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        console.log('JWT verification failed:', err.message);
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ uid: user.uid, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    // Adjust cookie settings for better compatibility in iframe/proxy environments
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: false, // Set to false to ensure it works in preview environments
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    const user = await db.get('SELECT * FROM users WHERE uid = ?', [req.user.uid]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // User Management Routes (Admin only)
  app.get('/api/users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const users = await db.all('SELECT uid, username, name, email, role, status, departmentId FROM users');
    res.json(users);
  });

  app.post('/api/users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, name, email, role, status, departmentId } = req.body;
    
    const existing = await db.get('SELECT uid FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const uid = 'user-' + Date.now();
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await db.run(
      'INSERT INTO users (uid, username, password, name, email, role, status, departmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, username, hashedPassword, name, email, role, status, departmentId]
    );
    
    res.json({ uid, username, name, email, role, status, departmentId });
  });

  app.delete('/api/users/:uid', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.params.uid === req.user.uid) return res.status(400).json({ error: 'Cannot delete yourself' });
    
    await db.run('DELETE FROM users WHERE uid = ?', [req.params.uid]);
    res.json({ success: true });
  });

  // News Routes
  app.get('/api/news', authenticateToken, async (req, res) => {
    const news = await db.all('SELECT * FROM news_items ORDER BY createdAt DESC');
    // Map SQLite 0/1 back to booleans
    const mappedNews = news.map(n => ({
      ...n,
      isEdited: !!n.isEdited,
      isReviewed: !!n.isReviewed,
      isApprovedByDept: !!n.isApprovedByDept,
      isApprovedByFinal: !!n.isApprovedByFinal,
      isArchived: !!n.isArchived,
    }));
    res.json(mappedNews);
  });

  app.get('/api/news/:id', authenticateToken, async (req, res) => {
    const item = await db.get('SELECT * FROM news_items WHERE id = ?', [req.params.id]);
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

  app.post('/api/news', authenticateToken, async (req: any, res) => {
    const item = req.body;
    const id = item.id || 'news-' + Date.now();
    const now = new Date().toISOString();
    
    const status = item.status || 'review';
    const isEdited = !!item.isEdited ? 1 : 0;
    const isReviewed = !!item.isReviewed ? 1 : 0;
    const isApprovedByDept = !!item.isApprovedByDept ? 1 : 0;
    const isApprovedByFinal = !!item.isApprovedByFinal ? 1 : 0;
    const isArchived = !!item.isArchived ? 1 : 0;

    await db.run(
      `INSERT INTO news_items (
        id, title, type, departmentId, content, contentFileName, preparedBy, 
        isEdited, isReviewed, reviewerName, reviewerFileName, 
        isApprovedByDept, approverName, approverFileName, 
        isApprovedByFinal, finalApproverName, finalApproverFileName, 
        otherType, publishDate, notes, newsUrl, isArchived, status, createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, item.title, item.type, item.departmentId, item.content, item.contentFileName, item.preparedBy,
        isEdited, isReviewed, item.reviewerName, item.reviewerFileName,
        isApprovedByDept, item.approverName, item.approverFileName,
        isApprovedByFinal, item.finalApproverName, item.finalApproverFileName,
        item.otherType, item.publishDate, item.notes, item.newsUrl, isArchived, status, req.user.uid, now, now
      ]
    );
    
    const newItem = await db.get('SELECT * FROM news_items WHERE id = ?', [id]);
    res.json({
      ...newItem,
      isEdited: !!newItem.isEdited,
      isReviewed: !!newItem.isReviewed,
      isApprovedByDept: !!newItem.isApprovedByDept,
      isApprovedByFinal: !!newItem.isApprovedByFinal,
      isArchived: !!newItem.isArchived,
    });
  });

  app.put('/api/news/:id', authenticateToken, async (req, res) => {
    const item = req.body;
    const now = new Date().toISOString();
    
    const existing = await db.get('SELECT isArchived FROM news_items WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    
    if (existing.isArchived) {
      return res.status(403).json({ error: 'Archived items cannot be modified' });
    }

    const fieldsToUpdate = [
      'title', 'type', 'departmentId', 'content', 'contentFileName', 'preparedBy',
      'isEdited', 'isReviewed', 'reviewerName', 'reviewerFileName',
      'isApprovedByDept', 'approverName', 'approverFileName',
      'isApprovedByFinal', 'finalApproverName', 'finalApproverFileName',
      'otherType', 'publishDate', 'notes', 'newsUrl', 'isArchived', 'status', 'updatedAt'
    ];

    const values = [
      item.title, item.type, item.departmentId, item.content, item.contentFileName, item.preparedBy,
      item.isEdited ? 1 : 0, item.isReviewed ? 1 : 0, item.reviewerName, item.reviewerFileName,
      item.isApprovedByDept ? 1 : 0, item.approverName, item.approverFileName,
      item.isApprovedByFinal ? 1 : 0, item.finalApproverName, item.finalApproverFileName,
      item.otherType, item.publishDate, item.notes, item.newsUrl, item.isArchived ? 1 : 0, item.status, now,
      req.params.id
    ];

    await db.run(
      `UPDATE news_items SET 
        title = ?, type = ?, departmentId = ?, content = ?, contentFileName = ?, preparedBy = ?,
        isEdited = ?, isReviewed = ?, reviewerName = ?, reviewerFileName = ?,
        isApprovedByDept = ?, approverName = ?, approverFileName = ?,
        isApprovedByFinal = ?, finalApproverName = ?, finalApproverFileName = ?,
        otherType = ?, publishDate = ?, notes = ?, newsUrl = ?, isArchived = ?, status = ?, updatedAt = ?
      WHERE id = ?`,
      values
    );
    
    const updated = await db.get('SELECT * FROM news_items WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      isEdited: !!updated.isEdited,
      isReviewed: !!updated.isReviewed,
      isApprovedByDept: !!updated.isApprovedByDept,
      isApprovedByFinal: !!updated.isApprovedByFinal,
      isArchived: !!updated.isArchived,
    });
  });

  app.delete('/api/news/:id', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    const item = await db.get('SELECT isArchived FROM news_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    if (item.isArchived) {
      return res.status(403).json({ error: 'Archived items cannot be deleted' });
    }

    await db.run('DELETE FROM news_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // Archive Route
  app.post('/api/news/:id/archive', authenticateToken, async (req, res) => {
    const item = await db.get('SELECT id FROM news_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    await db.run('UPDATE news_items SET isArchived = 1, updatedAt = ? WHERE id = ?', [new Date().toISOString(), req.params.id]);
    res.json({ success: true });
  });

  // Activity Logs
  app.get('/api/activity-logs', authenticateToken, async (req, res) => {
    const newsItemId = req.query.newsItemId;
    let logs;
    
    if (newsItemId) {
      logs = await db.all('SELECT * FROM activity_logs WHERE newsItemId = ? ORDER BY timestamp DESC LIMIT 50', [newsItemId]);
    } else {
      logs = await db.all('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50');
    }
    
    res.json(logs);
  });

  app.post('/api/activity-logs', authenticateToken, async (req, res) => {
    const log = req.body;
    const id = 'log-' + Date.now();
    await db.run(
      'INSERT INTO activity_logs (id, newsItemId, userId, action, previousStatus, newStatus, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, log.newsItemId, log.userId, log.action, log.previousStatus, log.newStatus, log.timestamp]
    );
    res.json({ id, ...log });
  });

  // Comments
  app.get('/api/news/:id/comments', authenticateToken, async (req, res) => {
    const comments = await db.all('SELECT * FROM comments WHERE newsItemId = ? ORDER BY createdAt ASC', [req.params.id]);
    res.json(comments);
  });

  app.post('/api/news/:id/comments', authenticateToken, async (req: any, res) => {
    const { text } = req.body;
    const id = 'comment-' + Date.now();
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO comments (id, newsItemId, userId, text, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, req.user.uid, text, now]
    );
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
