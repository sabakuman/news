import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db, seedInitialData } from '../firebase';
import { NewsItem, NewsStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, getStatusColor, getStatusLabel } from '../lib/utils';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const NewsList: React.FC = () => {
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<NewsStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        await seedInitialData();
        const newsRef = collection(db, 'news_items');
        let q = query(newsRef, orderBy('createdAt', 'desc'));
        
        const querySnapshot = await getDocs(q);
        const newsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
        setNews(newsData);
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const filteredNews = news.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const exportToExcel = () => {
    const data = filteredNews.map(item => ({
      'العنوان': item.title,
      'النوع': item.type,
      'القطاع': item.departmentId,
      'الحالة': getStatusLabel(item.status),
      'تاريخ الإضافة': formatDate(item.createdAt),
      'تاريخ النشر': item.publishDate || 'غير محدد'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأخبار');
    XLSX.writeFile(wb, 'قائمة_الأخبار.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.addFont('https://fonts.gstatic.com/s/tajawal/v9/I0vp6df6E_66iNjzJuQ_3A.ttf', 'Tajawal', 'normal');
    doc.setFont('Tajawal');
    
    const tableData = filteredNews.map(item => [
      item.title,
      item.type,
      getStatusLabel(item.status),
      formatDate(item.createdAt)
    ]);

    (doc as any).autoTable({
      head: [['العنوان', 'النوع', 'الحالة', 'تاريخ الإضافة']],
      body: tableData,
      styles: { font: 'Tajawal', halign: 'right' },
      headStyles: { fillColor: [25, 28, 30] },
    });

    doc.save('قائمة_الأخبار.pdf');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الخبر؟ لا يمكن التراجع عن هذه العملية.')) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'news_items', id));
      setNews(news.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting news:', error);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'news_items', id), {
        status: 'archived',
        isArchived: true,
        updatedAt: new Date().toISOString()
      });
      setNews(news.map(item => item.id === id ? { ...item, status: 'archived', isArchived: true } : item));
    } catch (error) {
      console.error('Error archiving news:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-2">مركز الأخبار والمقالات</h1>
          <p className="text-on-surface-variant text-lg">إدارة وتتبع جميع المحتويات الإعلامية في النظام.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container-low border border-outline-variant rounded-full overflow-hidden p-1">
            <button onClick={exportToExcel} className="p-2 hover:bg-surface-container-high text-on-surface-variant flex items-center gap-2 px-4 rounded-full transition-colors">
              <span className="material-symbols-rounded text-xl">table_view</span>
              <span className="text-xs font-bold">Excel</span>
            </button>
            <button onClick={exportToPDF} className="p-2 hover:bg-surface-container-high text-on-surface-variant flex items-center gap-2 px-4 rounded-full transition-colors">
              <span className="material-symbols-rounded text-xl">picture_as_pdf</span>
              <span className="text-xs font-bold">PDF</span>
            </button>
          </div>
          {(user?.role === 'admin' || user?.role === 'editor') && (
            <Link to="/news/new" className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95">
              <span className="material-symbols-rounded">add</span>
              <span>إضافة خبر</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_10px_30px_rgba(25,28,30,0.04)] border border-outline-variant/30 grid grid-cols-1 md:grid-cols-12 gap-6 items-end" dir="rtl">
        <div className="md:col-span-5 space-y-2">
          <label className="text-xs font-black text-outline uppercase tracking-widest px-1 text-right block">البحث في المحتوى</label>
          <div className="relative group">
            <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              placeholder="ابحث عن عنوان أو محتوى..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3.5 bg-surface-container border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all text-right"
            />
          </div>
        </div>
        
        <div className="md:col-span-3 space-y-2">
          <label className="text-xs font-black text-outline uppercase tracking-widest px-1">حالة الخبر</label>
          <div className="relative">
            <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">filter_list</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pr-12 pl-4 py-3.5 bg-surface-container border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm appearance-none transition-all"
            >
              <option value="all">جميع الحالات</option>
              <option value="draft">مسودة</option>
              <option value="review">قيد المراجعة</option>
              <option value="sector_approval">اعتماد القطاع</option>
              <option value="final_approval">الاعتماد النهائي</option>
              <option value="ready">جاهز للنشر</option>
              <option value="published">منشور</option>
              <option value="archived">مؤرشف</option>
              <option value="rejected">معاد للتعديل</option>
            </select>
          </div>
        </div>

        <div className="md:col-span-3 space-y-2">
          <label className="text-xs font-black text-outline uppercase tracking-widest px-1">نوع المحتوى</label>
          <div className="relative">
            <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">category</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full pr-12 pl-4 py-3.5 bg-surface-container border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm appearance-none transition-all"
            >
              <option value="all">جميع الأنواع</option>
              <option value="خبر صحفي">خبر صحفي</option>
              <option value="مقال">مقال</option>
              <option value="تقرير">تقرير</option>
              <option value="إعلان">إعلان</option>
            </select>
          </div>
        </div>

        <div className="md:col-span-1 flex justify-center">
          <button 
            onClick={() => {setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all');}}
            className="w-12 h-12 rounded-2xl bg-surface-container-high text-on-surface-variant hover:bg-error/10 hover:text-error transition-all flex items-center justify-center"
            title="إعادة ضبط"
          >
            <span className="material-symbols-rounded">restart_alt</span>
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_20px_50px_rgba(25,28,30,0.08)] border border-outline-variant/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-outline text-[10px] font-black uppercase tracking-[0.2em] border-b border-outline-variant/30">
                <th className="px-8 py-5">عنوان الخبر</th>
                <th className="px-8 py-5">النوع</th>
                <th className="px-8 py-5">القطاع / الإدارة</th>
                <th className="px-8 py-5">الحالة</th>
                <th className="px-8 py-5">تاريخ الإضافة</th>
                <th className="px-8 py-5 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredNews.length > 0 ? (
                filteredNews.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-row items-center gap-4">
                        <div className={cn("w-1.5 h-8 rounded-full shrink-0", 
                          item.status === 'published' ? "bg-primary" : 
                          item.status === 'rejected' ? "bg-error" : 
                          item.status === 'ready' ? "bg-secondary" : "bg-outline"
                        )}></div>
                        <p className="text-base font-bold text-on-surface group-hover:text-primary transition-colors truncate max-w-md">{item.title}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="bg-secondary-container/50 text-on-secondary-container text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-medium text-on-surface-variant">{item.departmentId}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border", getStatusColor(item.status))}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="material-symbols-rounded text-sm">calendar_today</span>
                        <span className="text-xs font-medium">{formatDate(item.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-left">
                      <div className="flex items-center justify-end gap-1">
                        <Link 
                          to={`/news/${item.id}`} 
                          className="w-10 h-10 flex items-center justify-center text-primary hover:bg-primary-container rounded-xl transition-all"
                          title="عرض التفاصيل"
                        >
                          <span className="material-symbols-rounded text-xl">visibility</span>
                        </Link>
                        {(user?.role === 'admin' || user?.role === 'editor') && item.status !== 'archived' && (
                          <Link 
                            to={`/news/edit/${item.id}`} 
                            className="w-10 h-10 flex items-center justify-center text-secondary hover:bg-secondary-container rounded-xl transition-all"
                            title="تعديل"
                          >
                            <span className="material-symbols-rounded text-xl">edit</span>
                          </Link>
                        )}
                        {user?.role === 'admin' && item.status === 'published' && (
                          <button 
                            onClick={() => handleArchive(item.id)}
                            className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                            title="أرشفة"
                          >
                            <span className="material-symbols-rounded text-xl">archive</span>
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="w-10 h-10 flex items-center justify-center text-error hover:bg-error/10 rounded-xl transition-all"
                            title="حذف"
                          >
                            <span className="material-symbols-rounded text-xl">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <span className="material-symbols-rounded text-6xl">search_off</span>
                      <p className="text-lg font-bold italic">لا توجد نتائج تطابق معايير البحث</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Area */}
        <div className="px-8 py-6 border-t border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest">
          <p className="text-xs font-bold text-on-surface-variant">عرض {filteredNews.length} من إجمالي {news.length} خبر</p>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant text-outline hover:bg-surface-container-high disabled:opacity-30 transition-all" disabled>
              <span className="material-symbols-rounded">chevron_right</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-on-primary font-black text-xs shadow-md shadow-primary/20">1</button>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant text-outline hover:bg-surface-container-high disabled:opacity-30 transition-all" disabled>
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsList;
