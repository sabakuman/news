import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSONFilePreset } from 'lowdb/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it';

interface Data {
  users: any[];
  news_items: any[];
  activity_logs: any[];
  comments: any[];
}

async function startServer() {
  const defaultData: Data = { 
    users: [], 
    news_items: [], 
    activity_logs: [], 
    comments: [] 
  };
  
  const db = await JSONFilePreset<Data>('database.json', defaultData);

  // Seed initial admin user
  const adminExists = db.data.users.find(u => u.username === 'admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin', 10);
    db.data.users.push({
      uid: 'admin-uid',
      username: 'admin',
      password: hashedPassword,
      name: 'المسؤول الرئيسي',
      email: 'admin@mohre.gov.ae',
      role: 'admin',
      status: 'active',
      departmentId: 'media_dept'
    });
    await db.write();
  }

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
    const user = db.data.users.find(u => u.username === username);

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
    const user = db.data.users.find(u => u.uid === req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // User Management Routes (Admin only)
  app.get('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const users = db.data.users.map(({ password, ...u }) => u);
    res.json(users);
  });

  app.post('/api/users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, name, email, role, status, departmentId } = req.body;
    
    if (db.data.users.some(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const uid = 'user-' + Date.now();
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const newUser = { uid, username, password: hashedPassword, name, email, role, status, departmentId };
    db.data.users.push(newUser);
    await db.write();
    
    const { password: _, ...userWithoutPassword } = newUser;
    res.json(userWithoutPassword);
  });

  app.delete('/api/users/:uid', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.params.uid === req.user.uid) return res.status(400).json({ error: 'Cannot delete yourself' });
    
    db.data.users = db.data.users.filter(u => u.uid !== req.params.uid);
    await db.write();
    res.json({ success: true });
  });

  // News Routes
  app.get('/api/news', authenticateToken, (req, res) => {
    const news = [...db.data.news_items].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(news);
  });

  app.get('/api/news/:id', authenticateToken, (req, res) => {
    const item = db.data.news_items.find(n => n.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  });

  app.post('/api/news', authenticateToken, async (req: any, res) => {
    const item = req.body;
    const id = item.id || 'news-' + Date.now();
    const now = new Date().toISOString();
    
    const newItem = {
      ...item,
      id,
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
      isEdited: !!item.isEdited,
      isReviewed: !!item.isReviewed,
      isApprovedByDept: !!item.isApprovedByDept,
      isApprovedByFinal: !!item.isApprovedByFinal,
      isArchived: !!item.isArchived,
    };
    
    db.data.news_items.push(newItem);
    await db.write();
    res.json(newItem);
  });

  app.put('/api/news/:id', authenticateToken, async (req, res) => {
    const item = req.body;
    const now = new Date().toISOString();
    
    const index = db.data.news_items.findIndex(n => n.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    
    if (db.data.news_items[index].isArchived) {
      return res.status(403).json({ error: 'Archived items cannot be modified' });
    }

    db.data.news_items[index] = {
      ...db.data.news_items[index],
      ...item,
      updatedAt: now,
      isEdited: !!item.isEdited,
      isReviewed: !!item.isReviewed,
      isApprovedByDept: !!item.isApprovedByDept,
      isApprovedByFinal: !!item.isApprovedByFinal,
      isArchived: !!item.isArchived,
    };
    
    await db.write();
    res.json(db.data.news_items[index]);
  });

  app.delete('/api/news/:id', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    const item = db.data.news_items.find(n => n.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    if (item.isArchived) {
      return res.status(403).json({ error: 'Archived items cannot be deleted' });
    }

    db.data.news_items = db.data.news_items.filter(n => n.id !== req.params.id);
    await db.write();
    res.json({ success: true });
  });

  // Archive Route
  app.post('/api/news/:id/archive', authenticateToken, async (req, res) => {
    const index = db.data.news_items.findIndex(n => n.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    
    db.data.news_items[index].isArchived = true;
    db.data.news_items[index].updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true });
  });

  // Activity Logs
  app.get('/api/activity-logs', authenticateToken, (req, res) => {
    const newsItemId = req.query.newsItemId;
    let logs = [...db.data.activity_logs];
    
    if (newsItemId) {
      logs = logs.filter(l => l.newsItemId === newsItemId);
    }
    
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(logs.slice(0, 50));
  });

  app.post('/api/activity-logs', authenticateToken, async (req, res) => {
    const log = req.body;
    const id = 'log-' + Date.now();
    const newLog = { id, ...log };
    db.data.activity_logs.push(newLog);
    await db.write();
    res.json(newLog);
  });

  // Comments
  app.get('/api/news/:id/comments', authenticateToken, (req, res) => {
    const comments = db.data.comments
      .filter(c => c.newsItemId === req.params.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json(comments);
  });

  app.post('/api/news/:id/comments', authenticateToken, async (req: any, res) => {
    const { text } = req.body;
    const id = 'comment-' + Date.now();
    const now = new Date().toISOString();
    const newComment = { id, newsItemId: req.params.id, userId: req.user.uid, text, createdAt: now };
    db.data.comments.push(newComment);
    await db.write();
    res.json(newComment);
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
