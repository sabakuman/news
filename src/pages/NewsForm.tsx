import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { NewsItem, NewsStatus } from '../types';
import { cn } from '../lib/utils';

const NewsForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewerFileRef = useRef<HTMLInputElement>(null);
  const approverFileRef = useRef<HTMLInputElement>(null);
  const finalApproverFileRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(id ? true : false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    type: 'خبر صحفي',
    otherType: '',
    departmentId: '',
    content: '', // This will store the file name or mock URL
    contentFileName: '',
    preparedBy: '',
    publishDate: '',
    notes: '',
    newsUrl: '',
    isEdited: false,
    isReviewed: false,
    reviewerName: '',
    reviewerFileName: '',
    isApprovedByDept: false,
    approverName: '',
    approverFileName: '',
    isApprovedByFinal: false,
    finalApproverName: '',
    finalApproverFileName: '',
    isArchived: false
  });

  useEffect(() => {
    if (id) {
      const fetchNews = async () => {
        try {
          const docRef = doc(db, 'news_items', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as NewsItem;
            setFormData({
              title: data.title,
              type: data.type,
              otherType: data.otherType || '',
              departmentId: data.departmentId,
              content: data.content,
              contentFileName: data.contentFileName || '',
              preparedBy: data.preparedBy || '',
              publishDate: data.publishDate || '',
              notes: data.notes || '',
              newsUrl: data.newsUrl || '',
              isEdited: data.isEdited || false,
              isReviewed: data.isReviewed || false,
              reviewerName: data.reviewerName || '',
              reviewerFileName: data.reviewerFileName || '',
              isApprovedByDept: data.isApprovedByDept || false,
              approverName: data.approverName || '',
              approverFileName: data.approverFileName || '',
              isApprovedByFinal: data.isApprovedByFinal || false,
              finalApproverName: data.finalApproverName || '',
              finalApproverFileName: data.finalApproverFileName || '',
              isArchived: data.isArchived || false
            });
          }
        } catch (err) {
          console.error('Error fetching news:', err);
          setError('خطأ في تحميل بيانات الخبر.');
        } finally {
          setLoading(false);
        }
      };
      fetchNews();
    } else {
      // Pre-fill preparedBy with current user name if creating new
      setFormData(prev => ({ ...prev, preparedBy: user?.name || '' }));
    }
  }, [id, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFormData(prev => ({ ...prev, contentFileName: file.name, content: file.name }));
    }
  };

  const handleApprovalFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'reviewerFileName' | 'approverFileName' | 'finalApproverFileName') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, [field]: file.name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!id && !selectedFile) {
      setError('يرجى تحميل محتوى الخبر (ملف).');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      const newsData = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      if (id) {
        const docRef = doc(db, 'news_items', id);
        await updateDoc(docRef, newsData);
        
        // Log activity
        await addDoc(collection(db, 'activity_logs'), {
          newsItemId: id,
          userId: user.uid,
          action: 'تعديل بيانات الخبر',
          timestamp: new Date().toISOString()
        });
      } else {
        const newNews = {
          ...newsData,
          status: 'draft' as NewsStatus,
          createdBy: user.uid,
          createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, 'news_items'), newNews);
        
        // Log activity
        await addDoc(collection(db, 'activity_logs'), {
          newsItemId: docRef.id,
          userId: user.uid,
          action: 'إنشاء مسودة خبر جديد',
          timestamp: new Date().toISOString()
        });
      }

      setSuccess(true);
      setTimeout(() => navigate('/news'), 1500);
    } catch (err) {
      console.error('Error saving news:', err);
      setError('حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCheckbox = (field: keyof typeof formData) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-container-low p-6 rounded-3xl border border-outline-variant">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <span className="material-symbols-rounded">arrow_forward</span>
          </button>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">{id ? 'تعديل الخبر' : 'إضافة خبر جديد'}</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-error-container text-on-error-container flex items-center gap-3 rounded-2xl border border-error/20">
          <span className="material-symbols-rounded">error</span>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-blue-50 text-blue-700 flex items-center gap-3 rounded-2xl border border-blue-200">
          <span className="material-symbols-rounded">check_circle</span>
          <p className="text-sm font-bold">تم حفظ البيانات بنجاح! جاري التحويل...</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Segment 1: New News or article creation */}
        <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant space-y-6" dir="rtl">
          <div className="flex flex-row items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center shrink-0">
              <span className="material-symbols-rounded">newspaper</span>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-on-surface">إنشاء خبر أو مقال جديد</h2>
              <p className="text-xs text-on-surface-variant font-medium">أدخل البيانات الأساسية للخبر أو المقال</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">عنوان الخبر / المقال</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface"
                placeholder="أدخل عنواناً معبراً..."
                required
              />
            </div>

            {/* Sector/Dept */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">القطاع / الإدارة</label>
              <input
                type="text"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface"
                placeholder="أدخل اسم القطاع أو الإدارة..."
                required
              />
            </div>

            {/* News Creator */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">معد الخبر</label>
              <div className="relative">
                <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">person</span>
                <input
                  type="text"
                  value={formData.preparedBy}
                  onChange={(e) => setFormData({ ...formData, preparedBy: e.target.value })}
                  className="w-full pr-12 pl-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface"
                  placeholder="اسم معد الخبر..."
                  required
                />
              </div>
            </div>
          </div>

          {/* Content Upload */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">تحميل محتوى الخبر (ملف)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
                selectedFile || formData.contentFileName ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-low hover:bg-surface-container-high"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                selectedFile || formData.contentFileName ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant/40"
              )}>
                <span className="material-symbols-rounded text-[32px]">upload_file</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">
                  {selectedFile?.name || formData.contentFileName || "اضغط لتحميل ملف محتوى الخبر"}
                </p>
                <p className="text-xs text-on-surface-variant mt-1 font-medium">يدعم جميع أنواع الملفات</p>
              </div>
            </div>
          </div>

          {/* Type of News */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">طبيعة الخبر</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all appearance-none text-on-surface font-bold"
                  required
                >
                  <option value="خبر صحفي">خبر صحفي</option>
                  <option value="مقالة">مقالة</option>
                  <option value="مدونات">مدونات</option>
                  <option value="اسئلة و اجوبة">اسئلة و اجوبة</option>
                  <option value="اخرى">اخرى</option>
                </select>
                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">expand_more</span>
              </div>
              
              {formData.type === 'اخرى' && (
                <input
                  type="text"
                  value={formData.otherType}
                  onChange={(e) => setFormData({ ...formData, otherType: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface fade-in"
                  placeholder="يرجى تحديد النوع..."
                  required
                />
              )}
            </div>
          </div>
        </div>

        {/* Segment 2: Editing and Approvals */}
        <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant space-y-6" dir="rtl">
          <div className="flex flex-row items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center shrink-0">
              <span className="material-symbols-rounded">fact_check</span>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-on-surface">التحرير والاعتمادات</h2>
              <p className="text-xs text-on-surface-variant font-medium">متابعة مراحل المراجعة والاعتماد الفني</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Review by Editor */}
            <div className={cn(
              "p-6 rounded-3xl border transition-all space-y-4",
              formData.isReviewed ? "bg-blue-50 border-blue-100" : "bg-surface-container-low border-outline-variant"
            )}>
              <div 
                onClick={() => toggleCheckbox('isReviewed')}
                className="flex items-center justify-between cursor-pointer group"
              >
                <span className={cn("text-sm font-bold", formData.isReviewed ? "text-blue-700" : "text-on-surface-variant")}>
                  مراجعة المحرر
                </span>
                <div className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                  formData.isReviewed ? "bg-blue-600 border-blue-600 text-white" : "border-outline-variant group-hover:border-primary"
                )}>
                  {formData.isReviewed && <span className="material-symbols-rounded text-[18px]">check</span>}
                </div>
              </div>
              
              {formData.isReviewed && (
                <div className="space-y-4 fade-in pt-2 border-t border-blue-100">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">اسم المحرر</label>
                    <input
                      type="text"
                      value={formData.reviewerName}
                      onChange={(e) => setFormData({ ...formData, reviewerName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-blue-900"
                      placeholder="أدخل اسم المحرر..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">ملف المراجعة</label>
                    <div 
                      onClick={() => reviewerFileRef.current?.click()}
                      className={cn(
                        "w-full p-3 border border-dashed rounded-xl flex items-center gap-3 cursor-pointer transition-all",
                        formData.reviewerFileName ? "bg-blue-100/50 border-blue-300" : "bg-white border-blue-100 hover:bg-blue-100/30"
                      )}
                    >
                      <input 
                        type="file" 
                        ref={reviewerFileRef} 
                        onChange={(e) => handleApprovalFileChange(e, 'reviewerFileName')} 
                        className="hidden" 
                      />
                      <span className="material-symbols-rounded text-[20px] text-blue-600">upload</span>
                      <span className="text-xs font-bold text-blue-700 truncate">
                        {formData.reviewerFileName || "تحميل ملف المراجعة"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Approval by Sector/Dept */}
            <div className={cn(
              "p-6 rounded-3xl border transition-all space-y-4",
              formData.isApprovedByDept ? "bg-blue-50 border-blue-100" : "bg-surface-container-low border-outline-variant"
            )}>
              <div 
                onClick={() => toggleCheckbox('isApprovedByDept')}
                className="flex items-center justify-between cursor-pointer group"
              >
                <span className={cn("text-sm font-bold", formData.isApprovedByDept ? "text-blue-700" : "text-on-surface-variant")}>
                  اعتماد القطاع
                </span>
                <div className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                  formData.isApprovedByDept ? "bg-blue-600 border-blue-600 text-white" : "border-outline-variant group-hover:border-primary"
                )}>
                  {formData.isApprovedByDept && <span className="material-symbols-rounded text-[18px]">check</span>}
                </div>
              </div>

              {formData.isApprovedByDept && (
                <div className="space-y-4 fade-in pt-2 border-t border-blue-100">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">اسم المعتمد</label>
                    <input
                      type="text"
                      value={formData.approverName}
                      onChange={(e) => setFormData({ ...formData, approverName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-blue-900"
                      placeholder="أدخل اسم المعتمد..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">ملف الاعتماد</label>
                    <div 
                      onClick={() => approverFileRef.current?.click()}
                      className={cn(
                        "w-full p-3 border border-dashed rounded-xl flex items-center gap-3 cursor-pointer transition-all",
                        formData.approverFileName ? "bg-blue-100/50 border-blue-300" : "bg-white border-blue-100 hover:bg-blue-100/30"
                      )}
                    >
                      <input 
                        type="file" 
                        ref={approverFileRef} 
                        onChange={(e) => handleApprovalFileChange(e, 'approverFileName')} 
                        className="hidden" 
                      />
                      <span className="material-symbols-rounded text-[20px] text-blue-600">upload</span>
                      <span className="text-xs font-bold text-blue-700 truncate">
                        {formData.approverFileName || "تحميل ملف الاعتماد"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Minister/Under Sec Approval */}
            <div className={cn(
              "p-6 rounded-3xl border transition-all space-y-4 md:col-span-2",
              formData.isApprovedByFinal ? "bg-blue-50 border-blue-100" : "bg-surface-container-low border-outline-variant"
            )}>
              <div 
                onClick={() => toggleCheckbox('isApprovedByFinal')}
                className="flex items-center justify-between cursor-pointer group"
              >
                <span className={cn("text-sm font-bold", formData.isApprovedByFinal ? "text-blue-700" : "text-on-surface-variant")}>
                  الاعتماد النهائي (مكتب الوزير / الوكيل)
                </span>
                <div className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                  formData.isApprovedByFinal ? "bg-blue-600 border-blue-600 text-white" : "border-outline-variant group-hover:border-primary"
                )}>
                  {formData.isApprovedByFinal && <span className="material-symbols-rounded text-[18px]">check</span>}
                </div>
              </div>

              {formData.isApprovedByFinal && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in pt-2 border-t border-blue-100">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">اسم المعتمد النهائي</label>
                    <input
                      type="text"
                      value={formData.finalApproverName}
                      onChange={(e) => setFormData({ ...formData, finalApproverName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-blue-900"
                      placeholder="أدخل اسم المعتمد النهائي..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">ملف الاعتماد النهائي</label>
                    <div 
                      onClick={() => finalApproverFileRef.current?.click()}
                      className={cn(
                        "w-full p-3 border border-dashed rounded-xl flex items-center gap-3 cursor-pointer transition-all",
                        formData.finalApproverFileName ? "bg-blue-100/50 border-blue-300" : "bg-white border-blue-100 hover:bg-blue-100/30"
                      )}
                    >
                      <input 
                        type="file" 
                        ref={finalApproverFileRef} 
                        onChange={(e) => handleApprovalFileChange(e, 'finalApproverFileName')} 
                        className="hidden" 
                      />
                      <span className="material-symbols-rounded text-[20px] text-blue-600">upload</span>
                      <span className="text-xs font-bold text-blue-700 truncate">
                        {formData.finalApproverFileName || "تحميل ملف الاعتماد النهائي"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Segment 3: publication information */}
        <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant space-y-6" dir="rtl">
          <div className="flex flex-row items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-tertiary-container text-on-tertiary-container rounded-xl flex items-center justify-center shrink-0">
              <span className="material-symbols-rounded">public</span>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-on-surface">معلومات النشر</h2>
              <p className="text-xs text-on-surface-variant font-medium">بيانات النشر والروابط الخارجية</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date of Publication */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">تاريخ النشر</label>
              <div className="relative">
                <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">calendar_today</span>
                <input
                  type="date"
                  value={formData.publishDate}
                  onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                  className="w-full pr-12 pl-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface font-bold"
                />
              </div>
            </div>

            {/* News URL */}
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">رابط الخبر (URL)</label>
              <div className="relative">
                <span className="material-symbols-rounded absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">link</span>
                <input
                  type="url"
                  value={formData.newsUrl}
                  onChange={(e) => setFormData({ ...formData, newsUrl: e.target.value })}
                  className="w-full pr-12 pl-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface"
                  placeholder="https://example.com/news-article"
                />
              </div>
            </div>

            {/* Comments */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 mr-1">التعليقات والملاحظات</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all min-h-[120px] resize-none text-on-surface"
                placeholder="أدخل أي تعليقات أو ملاحظات إضافية هنا..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-12 px-8 bg-surface-container text-on-surface font-bold rounded-full hover:bg-surface-container-high transition-all"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 px-10 bg-primary text-on-primary font-bold rounded-full shadow-lg shadow-primary/20 hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="material-symbols-rounded">save</span>
                <span>حفظ الخبر</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewsForm;
