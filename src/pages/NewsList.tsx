import React, { useEffect, useState } from 'react';
import { NewsItem, NewsStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, getStatusColor, getStatusLabel } from '../lib/utils';
import { Link, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const NewsList: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<NewsStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const isArchivePage = location.pathname === '/archive';
  const isReportsPage = location.pathname === '/reports';

  const fetchNews = async () => {
    try {
      const response = await fetch('/api/news');
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error('فشل في جلب البيانات');
      const data = await response.json();
      setNews(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('حدث خطأ أثناء جلب قائمة الأخبار. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    if (isArchivePage) {
      setStatusFilter('archived');
    } else if (isReportsPage) {
      setStatusFilter('all');
    } else {
      setStatusFilter('all');
    }
  }, [isArchivePage, isReportsPage]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخبر؟')) return;
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNews(news.filter(n => n.id !== id));
      } else {
        const err = await res.json();
        alert(err.error || 'فشل الحذف');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من أرشفة هذا الخبر؟ لن تتمكن من تعديله أو حذفه لاحقاً.')) return;
    try {
      const res = await fetch(`/api/news/${id}/archive`, { method: 'POST' });
      if (res.ok) {
        fetchNews();
      }
    } catch (error) {
      console.error('Archive failed:', error);
    }
  };

  const filteredNews = news.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
    const matchesType = typeFilter === 'all' ? true : item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredNews.map(n => ({
      العنوان: n.title,
      النوع: n.type,
      الحالة: getStatusLabel(n.status),
      التاريخ: formatDate(n.createdAt)
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الأخبار");
    XLSX.writeFile(workbook, "news_report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.addFont('https://fonts.gstatic.com/s/notosansarabic/v18/n4IF498y8mE49kn37f082_nZkbBP.ttf', 'NotoSansArabic', 'normal');
    doc.setFont('NotoSansArabic');
    
    const tableData = filteredNews.map(n => [
      formatDate(n.createdAt),
      getStatusLabel(n.status),
      n.type,
      n.title
    ]);

    (doc as any).autoTable({
      head: [['التاريخ', 'الحالة', 'النوع', 'العنوان']],
      body: tableData,
      styles: { font: 'NotoSansArabic', halign: 'right' },
      headStyles: { halign: 'right' }
    });

    doc.save('news_report.pdf');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded-2xl border border-error/20 text-center">
        <span className="material-symbols-rounded text-4xl mb-2 block">error</span>
        <p className="font-bold">{error}</p>
        <button onClick={fetchNews} className="mt-4 px-6 py-2 bg-error text-on-error rounded-full font-bold">إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in pb-20" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-primary tracking-tight">
          {isArchivePage ? 'الأرشيف الإعلامي' : isReportsPage ? 'البحث والتقارير' : 'قائمة الأخبار والمقالات'}
        </h1>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-all">
            <span className="material-symbols-rounded">download</span>
            <span>Excel</span>
          </button>
          <button onClick={exportToPDF} className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-all">
            <span className="material-symbols-rounded">picture_as_pdf</span>
            <span>PDF</span>
          </button>
          <Link to="/news/new" className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20">
            <span className="material-symbols-rounded">add</span>
            <span>إضافة جديد</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">search</span>
          <input
            type="text"
            placeholder="بحث في العناوين والمحتوى..."
            className="w-full pr-10 pl-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="review">قيد الانتظار</option>
          <option value="sector_approval">بانتظار اعتماد القطاع</option>
          <option value="final_approval">بانتظار الاعتماد النهائي</option>
          <option value="ready">جاهز للنشر</option>
          <option value="published">تم النشر</option>
          <option value="rejected">مرفوض / بحاجة لتعديل</option>
          <option value="archived">مؤرشف</option>
        </select>
        <select
          className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">كل الأنواع</option>
          <option value="خبر صحفي">خبر صحفي</option>
          <option value="مقال">مقال</option>
          <option value="بيان">بيان</option>
        </select>
      </div>

      {/* News Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-sm font-bold text-on-surface-variant">العنوان</th>
                <th className="px-6 py-4 text-sm font-bold text-on-surface-variant">النوع</th>
                <th className="px-6 py-4 text-sm font-bold text-on-surface-variant">الحالة</th>
                <th className="px-6 py-4 text-sm font-bold text-on-surface-variant">تاريخ الإنشاء</th>
                <th className="px-6 py-4 text-sm font-bold text-on-surface-variant">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredNews.map((item) => (
                <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-on-surface group-hover:text-primary transition-colors">{item.title}</span>
                      {item.isArchived && <span className="text-[10px] text-primary font-bold flex items-center gap-1 mt-1"><span className="material-symbols-rounded text-xs">archive</span> مؤرشف</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant">{item.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold", getStatusColor(item.status))}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant">{formatDate(item.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/news/${item.id}`} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" title="عرض">
                        <span className="material-symbols-rounded">visibility</span>
                      </Link>
                      
                      {!item.isArchived && (
                        <>
                          <Link to={`/news/edit/${item.id}`} className="p-2 hover:bg-secondary/10 text-secondary rounded-lg transition-colors" title="تعديل">
                            <span className="material-symbols-rounded">edit</span>
                          </Link>
                          <button 
                            onClick={() => handleArchive(item.id)} 
                            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" 
                            title="أرشفة"
                          >
                            <span className="material-symbols-rounded">archive</span>
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDelete(item.id)} 
                              className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors" 
                              title="حذف"
                            >
                              <span className="material-symbols-rounded">delete</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredNews.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-on-surface-variant/40">
                      <span className="material-symbols-rounded text-[64px]">
                        {news.length === 0 ? 'newspaper' : 'search_off'}
                      </span>
                      <p className="text-lg font-bold">
                        {news.length === 0 ? 'لا توجد أخبار مضافة بعد. ابدأ بإضافة أول خبر!' : 'لا توجد نتائج تطابق البحث'}
                      </p>
                      {news.length === 0 && (
                        <Link to="/news/new" className="mt-2 bg-primary text-on-primary px-6 py-2 rounded-full font-bold hover:opacity-90 transition-all">
                          إضافة خبر جديد
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NewsList;
