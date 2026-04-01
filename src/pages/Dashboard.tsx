import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, seedInitialData } from '../firebase';
import { NewsItem, ActivityLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, getStatusColor, getStatusLabel } from '../lib/utils';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    published: 0,
    rejected: 0,
    total: 0,
  });
  const [recentNews, setRecentNews] = useState<NewsItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        await seedInitialData();
        const newsRef = collection(db, 'news_items');
        const allNews = await getDocs(newsRef);
        const newsData = allNews.docs.map(doc => doc.data() as NewsItem);
        
        setStats({
          pending: newsData.filter(n => ['review', 'sector_approval', 'final_approval'].includes(n.status)).length,
          approved: newsData.filter(n => n.status === 'ready').length,
          published: newsData.filter(n => n.status === 'published').length,
          rejected: newsData.filter(n => n.status === 'rejected').length,
          total: newsData.length,
        });

        const recentNewsQuery = query(newsRef, orderBy('createdAt', 'desc'), limit(3));
        const recentNewsSnap = await getDocs(recentNewsQuery);
        setRecentNews(recentNewsSnap.docs.map(doc => doc.data() as NewsItem));

        const activityRef = collection(db, 'activity_logs');
        const activityQuery = query(activityRef, orderBy('timestamp', 'desc'), limit(5));
        const activitySnap = await getDocs(activityQuery);
        setRecentActivity(activitySnap.docs.map(doc => doc.data() as ActivityLog));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 fade-in pb-20">
      {/* Greeting Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight mb-2">أهلاً بك مجدداً، {user?.name}</h1>
          <p className="text-on-surface-variant text-lg">إليك ملخص سريع لنشاطات اليوم في مركز الأخبار.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/news/new" className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20">
            <span className="material-symbols-rounded">add</span>
            <span>خبر جديد</span>
          </Link>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
        <div className="relative overflow-hidden group bg-surface-container-lowest rounded-xl p-8 shadow-[0_10px_30px_rgba(25,28,30,0.06)] flex flex-row justify-between items-center transition-transform hover:-translate-y-1">
          <div className="relative z-10 text-right">
            <p className="text-on-surface-variant font-medium mb-1">عناصر بانتظار المراجعة</p>
            <h2 className="text-5xl font-extrabold text-primary">{stats.pending}</h2>
          </div>
          <div className="bg-secondary-container p-5 rounded-full text-primary shrink-0">
            <span className="material-symbols-rounded text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-50"></div>
        </div>

        <div className="relative overflow-hidden group bg-surface-container-lowest rounded-xl p-8 shadow-[0_10px_30px_rgba(25,28,30,0.06)] flex flex-row justify-between items-center transition-transform hover:-translate-y-1 border-r-4 border-primary">
          <div className="relative z-10 text-right">
            <p className="text-on-surface-variant font-medium mb-1">تمت الموافقة عليها</p>
            <h2 className="text-5xl font-extrabold text-primary">{stats.approved + stats.published}</h2>
          </div>
          <div className="bg-primary-container/20 p-5 rounded-full text-primary shrink-0">
            <span className="material-symbols-rounded text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Current Tasks */}
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-primary">مهامي الحالية</h3>
            <Link to="/news" className="text-primary font-bold text-sm hover:underline">عرض الكل</Link>
          </div>
          <div className="space-y-4">
            {recentNews.map((news) => (
              <Link 
                key={news.id} 
                to={`/news/${news.id}`}
                className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_10px_30px_rgba(25,28,30,0.06)] hover:bg-surface-container transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center group"
              >
                <div className="w-full md:w-32 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-high flex items-center justify-center">
                  <span className="material-symbols-rounded text-4xl text-outline-variant">newspaper</span>
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {news.type}
                    </span>
                    <span className="text-on-surface-variant text-xs flex items-center gap-1">
                      <span className="material-symbols-rounded text-sm">schedule</span> {formatDate(news.createdAt)}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-on-surface leading-snug group-hover:text-primary transition-colors">
                    {news.title}
                  </h4>
                </div>
                <div className="flex flex-row md:flex-col items-center gap-2 shrink-0 self-end md:self-center">
                  <span className={cn("px-3 py-1 rounded-full text-xs font-bold", getStatusColor(news.status))}>
                    {getStatusLabel(news.status)}
                  </span>
                  <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                    <span className="material-symbols-rounded">more_vert</span>
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Latest Activity */}
        <section className="space-y-6" dir="rtl">
          <h3 className="text-2xl font-bold text-primary text-right">آخر النشاطات</h3>
          <div className="bg-surface-container-low rounded-xl p-8 relative">
            <div className="absolute right-[47px] top-8 bottom-8 w-0.5 bg-outline-variant/30"></div>
            <div className="space-y-8 relative">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex flex-row gap-4">
                  <div className="z-10 w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary shrink-0 shadow-sm">
                    <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {log.action.includes('نشر') ? 'publish' : log.action.includes('تعديل') ? 'edit' : 'info'}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-bold text-on-surface">{log.action}</span>
                    <span className="text-xs text-on-surface-variant">{formatDate(log.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-10 py-3 border border-outline-variant border-dashed rounded-lg text-on-surface-variant text-sm font-bold hover:bg-surface-container-high transition-colors">
              تحميل سجل النشاطات الكامل
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
