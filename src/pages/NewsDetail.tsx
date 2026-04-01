import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { NewsItem, NewsStatus, Comment, ActivityLog, Attachment, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, getStatusColor, getStatusLabel } from '../lib/utils';

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [news, setNews] = useState<NewsItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchNews = async () => {
      const docRef = doc(db, 'news_items', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setNews({ id: docSnap.id, ...docSnap.data() } as NewsItem);
      } else {
        navigate('/news');
      }
      setLoading(false);
    };

    fetchNews();

    // Listen for comments
    const commentsRef = collection(db, 'news_items', id, 'comments');
    const qComments = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubComments = onSnapshot(qComments, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });

    // Listen for attachments
    const attachmentsRef = collection(db, 'news_items', id, 'attachments');
    const unsubAttachments = onSnapshot(attachmentsRef, (snapshot) => {
      setAttachments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attachment)));
    });

    // Listen for activity logs
    const logsRef = collection(db, 'activity_logs');
    const qLogs = query(logsRef, where('newsItemId', '==', id), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setActivityLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    });

    return () => {
      unsubComments();
      unsubAttachments();
      unsubLogs();
    };
  }, [id, navigate]);

  const handleStatusChange = async (newStatus: NewsStatus, actionLabel: string) => {
    if (!news || !user) return;
    setIsSubmitting(true);
    try {
      const newsRef = doc(db, 'news_items', news.id);
      const oldStatus = news.status;
      
      await updateDoc(newsRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // Log activity
      await addDoc(collection(db, 'activity_logs'), {
        newsItemId: news.id,
        userId: user.uid,
        action: actionLabel,
        previousStatus: oldStatus,
        newStatus: newStatus,
        timestamp: new Date().toISOString()
      });

      setNews({ ...news, status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !news || !user) return;

    setIsSubmitting(true);
    try {
      const commentsRef = collection(db, 'news_items', news.id, 'comments');
      await addDoc(commentsRef, {
        newsItemId: news.id,
        userId: user.uid,
        text: newComment,
        createdAt: new Date().toISOString()
      });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    window.print();
  };

  const handleArchive = async () => {
    if (!news || !user) return;
    setIsSubmitting(true);
    try {
      const newsRef = doc(db, 'news_items', news.id);
      await updateDoc(newsRef, {
        status: 'archived',
        isArchived: true,
        updatedAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'activity_logs'), {
        newsItemId: news.id,
        userId: user.uid,
        action: 'أرشفة الخبر (تم الانتهاء)',
        timestamp: new Date().toISOString()
      });

      setNews({ ...news, status: 'archived', isArchived: true });
    } catch (error) {
      console.error('Error archiving news:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!news) return null;

  const canAction = (requiredRole: string[], allowedStatuses: NewsStatus[]) => {
    return requiredRole.includes(user?.role || '') && allowedStatuses.includes(news.status);
  };

  return (
    <div className="space-y-6 fade-in pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant">
        <div className="flex items-center gap-4">
          <Link to="/news" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <span className="material-symbols-rounded">arrow_forward</span>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                getStatusColor(news.status)
              )}>
                {getStatusLabel(news.status)}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant/60">ID: {news.id.slice(0, 8)}</span>
            </div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">{news.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Workflow Actions */}
          {canAction(['editor', 'admin'], ['draft', 'rejected']) && (
            <button 
              onClick={() => handleStatusChange('review', 'تقديم للمراجعة الداخلية')}
              className="h-10 px-4 bg-primary text-on-primary text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-[20px]">send</span>
              <span>تقديم للمراجعة</span>
            </button>
          )}
          
          {canAction(['reviewer', 'admin'], ['review']) && (
            <>
              <button 
                onClick={() => handleStatusChange('sector_approval', 'الموافقة والتحويل لاعتماد القطاع')}
                className="h-10 px-4 bg-primary text-on-primary text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-[20px]">check_circle</span>
                <span>موافقة وتحويل للقطاع</span>
              </button>
              <button 
                onClick={() => handleStatusChange('rejected', 'إعادة للتعديل من المراجعة الداخلية')}
                className="h-10 px-4 bg-error-container text-on-error-container text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-[20px]">block</span>
                <span>إعادة للتعديل</span>
              </button>
            </>
          )}

          {canAction(['sector_approver', 'admin'], ['sector_approval']) && (
            <>
              <button 
                onClick={() => handleStatusChange('final_approval', 'اعتماد القطاع والتحويل للاعتماد النهائي')}
                className="h-10 px-4 bg-primary text-on-primary text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-[20px]">verified</span>
                <span>اعتماد وتحويل للنهائي</span>
              </button>
              <button 
                onClick={() => handleStatusChange('rejected', 'إعادة للتعديل من قبل القطاع')}
                className="h-10 px-4 bg-error-container text-on-error-container text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-[20px]">block</span>
                <span>إعادة للتعديل</span>
              </button>
            </>
          )}

          {canAction(['final_approver', 'admin'], ['final_approval']) && (
            <>
              <button 
                onClick={() => handleStatusChange('ready', 'الاعتماد النهائي والجاهزية للنشر')}
                className="h-10 px-4 bg-primary text-on-primary text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-[20px]">verified_user</span>
                <span>اعتماد نهائي</span>
              </button>
              <button 
                onClick={() => handleStatusChange('rejected', 'إعادة للتعديل من المكتب النهائي')}
                className="h-10 px-4 bg-error-container text-on-error-container text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
              >
                <span className="material-symbols-rounded text-[20px]">block</span>
                <span>إعادة للتعديل</span>
              </button>
            </>
          )}

          {canAction(['admin'], ['ready']) && (
            <button 
              onClick={() => handleStatusChange('published', 'تأكيد النشر')}
              className="h-10 px-4 bg-primary text-on-primary text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-[20px]">publish</span>
              <span>تأكيد النشر</span>
            </button>
          )}

          {canAction(['admin'], ['published']) && (
            <button 
              onClick={handleArchive}
              className="h-10 px-4 bg-surface-container-high text-on-surface text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-[20px]">archive</span>
              <span>أرشفة</span>
            </button>
          )}

          <div className="w-px h-6 bg-outline-variant mx-1 hidden md:block"></div>

          <button 
            onClick={handleExport}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="تصدير / طباعة"
          >
            <span className="material-symbols-rounded">print</span>
          </button>

          {canAction(['admin', 'editor'], ['draft', 'review', 'sector_approval', 'final_approval', 'rejected']) && (
            <Link 
              to={`/news/edit/${news.id}`}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors"
              title="تعديل"
            >
              <span className="material-symbols-rounded">edit</span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Article Info Card */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 pb-6 border-b border-outline-variant">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                  <span className="material-symbols-rounded text-[18px]">person</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">المعد</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{news.preparedBy || 'غير محدد'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                  <span className="material-symbols-rounded text-[18px]">calendar_today</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">تاريخ النشر</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{news.publishDate || 'غير محدد'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                  <span className="material-symbols-rounded text-[18px]">category</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">طبيعة الخبر</span>
                </div>
                <p className="text-sm font-bold text-on-surface">
                  {news.type === 'اخرى' ? news.otherType : news.type}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                  <span className="material-symbols-rounded text-[18px]">corporate_fare</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">القطاع</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{news.departmentId}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">محتوى الخبر:</h3>
              <div className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center">
                    <span className="material-symbols-rounded text-[28px]">description</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{news.contentFileName || 'ملف المحتوى'}</p>
                    <p className="text-xs text-on-surface-variant">انقر لتحميل وقراءة المحتوى الكامل</p>
                  </div>
                </div>
                <button className="h-10 px-4 bg-primary text-on-primary text-sm font-bold rounded-full hover:shadow-md transition-all flex items-center gap-2">
                  <span className="material-symbols-rounded text-[20px]">download</span>
                  <span>تحميل</span>
                </button>
              </div>
            </div>

            {/* Review & Approvals Status */}
            <div className="mt-10 pt-8 border-t border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-6">حالة المراجعة والاعتمادات</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between transition-colors",
                  news.isEdited ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-surface-container-low border-outline-variant text-on-surface-variant/40"
                )}>
                  <span className="text-sm font-bold">تم التحرير (Edited)</span>
                  <span className="material-symbols-rounded">
                    {news.isEdited ? "check_circle" : "pending"}
                  </span>
                </div>

                <div className={cn(
                  "p-4 rounded-2xl border space-y-3 transition-colors",
                  news.isReviewed ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-surface-container-low border-outline-variant text-on-surface-variant/40"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">تمت المراجعة (Reviewed)</span>
                    <span className="material-symbols-rounded">
                      {news.isReviewed ? "check_circle" : "pending"}
                    </span>
                  </div>
                  {news.isReviewed && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-blue-100/50">
                      <p className="text-[11px] font-bold">بواسطة: {news.reviewerName || 'غير محدد'}</p>
                      {news.reviewerFileName && (
                        <button className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 transition-colors">
                          <span className="material-symbols-rounded text-[14px]">download</span>
                          <span>الملف</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className={cn(
                  "p-4 rounded-2xl border space-y-3 transition-colors",
                  news.isApprovedByDept ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-surface-container-low border-outline-variant text-on-surface-variant/40"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">اعتماد القطاع المعني</span>
                    <span className="material-symbols-rounded">
                      {news.isApprovedByDept ? "check_circle" : "pending"}
                    </span>
                  </div>
                  {news.isApprovedByDept && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-blue-100/50">
                      <p className="text-[11px] font-bold">بواسطة: {news.approverName || 'غير محدد'}</p>
                      {news.approverFileName && (
                        <button className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 transition-colors">
                          <span className="material-symbols-rounded text-[14px]">download</span>
                          <span>الملف</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className={cn(
                  "p-4 rounded-2xl border space-y-3 transition-colors",
                  news.isApprovedByFinal ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-surface-container-low border-outline-variant text-on-surface-variant/40"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">الاعتماد النهائي</span>
                    <span className="material-symbols-rounded">
                      {news.isApprovedByFinal ? "check_circle" : "pending"}
                    </span>
                  </div>
                  {news.isApprovedByFinal && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-blue-100/50">
                      <p className="text-[11px] font-bold">بواسطة: {news.finalApproverName || 'غير محدد'}</p>
                      {news.finalApproverFileName && (
                        <button className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 transition-colors">
                          <span className="material-symbols-rounded text-[14px]">download</span>
                          <span>الملف</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {news.newsUrl && (
              <div className="mt-8 p-4 bg-secondary-container text-on-secondary-container rounded-2xl border border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-on-secondary-container/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-rounded">link</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">رابط الخبر المنشور</p>
                    <p className="text-sm font-bold truncate max-w-md">{news.newsUrl}</p>
                  </div>
                </div>
                <a 
                  href={news.newsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="h-9 px-4 bg-on-secondary-container text-secondary-container text-xs font-bold rounded-full flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <span>زيارة الرابط</span>
                  <span className="material-symbols-rounded text-[16px]">open_in_new</span>
                </a>
              </div>
            )}

            {news.notes && (
              <div className="mt-6 p-4 bg-surface-container text-on-surface-variant rounded-2xl border border-outline-variant">
                <div className="flex items-center gap-2 mb-2 text-on-surface font-bold">
                  <span className="material-symbols-rounded text-[20px]">notes</span>
                  <span className="text-sm">ملاحظات إضافية:</span>
                </div>
                <p className="text-sm leading-relaxed opacity-80">{news.notes}</p>
              </div>
            )}
          </div>

          {/* Attachments Section */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-rounded text-primary">attach_file</span>
                المرفقات والوثائق
              </h3>
              <button className="flex items-center gap-1.5 text-sm font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-full transition-colors">
                <span className="material-symbols-rounded text-[20px]">add</span>
                إضافة مرفق
              </button>
            </div>
            
            <div className="space-y-3">
              {attachments.length > 0 ? (
                attachments.map((file) => (
                  <div key={file.id} className="p-4 bg-surface-container-low border border-outline-variant rounded-2xl hover:bg-surface-container-high transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-surface-container-high text-on-surface-variant rounded-xl flex items-center justify-center">
                        <span className="material-symbols-rounded">description</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{file.name}</p>
                        <p className="text-[10px] text-on-surface-variant/60 font-medium">تم الرفع في {formatDate(file.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors">
                        <span className="material-symbols-rounded text-[20px]">download</span>
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors">
                        <span className="material-symbols-rounded text-[20px]">history</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-surface-container-low border-2 border-dashed border-outline-variant rounded-2xl">
                  <span className="material-symbols-rounded text-[40px] text-on-surface-variant/20 mb-2">folder_open</span>
                  <p className="text-on-surface-variant/40 text-sm italic font-medium">لا توجد مرفقات مرتبطة بهذا الخبر</p>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <h3 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-rounded text-primary">forum</span>
              التعليقات والمناقشات
            </h3>
            
            <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold shrink-0 text-lg">
                      {comment.userId.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 bg-surface-container-low p-4 rounded-2xl rounded-tr-none border border-outline-variant">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-on-surface">مستخدم #{comment.userId.slice(0, 4)}</p>
                        <p className="text-[10px] text-on-surface-variant/60 font-medium">{formatDate(comment.createdAt)}</p>
                      </div>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{comment.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-on-surface-variant/40 italic text-sm font-medium">لا توجد تعليقات بعد</p>
                </div>
              )}
            </div>

            <form onSubmit={handleAddComment} className="relative">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقك هنا..."
                className="w-full p-4 pr-4 pl-14 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm min-h-[100px] resize-none transition-all"
              />
              <button 
                type="submit"
                disabled={isSubmitting || !newComment.trim()}
                className="absolute left-3 bottom-3 w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center hover:shadow-lg transition-all disabled:opacity-50 disabled:shadow-none"
              >
                <span className="material-symbols-rounded">send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Info Area */}
        <div className="space-y-6">
          {/* Workflow Timeline */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <h3 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-rounded text-primary">history</span>
              سجل سير العمل
            </h3>
            
            <div className="relative space-y-6 before:absolute before:right-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
              {activityLogs.map((log, index) => (
                <div key={log.id} className="relative pr-10">
                  <div className={cn(
                    "absolute right-2.5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-surface-container-lowest z-10",
                    index === 0 ? "bg-primary ring-4 ring-primary-container" : "bg-outline-variant"
                  )}></div>
                  <div>
                    <p className="text-sm font-bold text-on-surface leading-tight">{log.action}</p>
                    {log.newStatus && (
                      <div className="mt-1.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
                          getStatusColor(log.newStatus)
                        )}>
                          {getStatusLabel(log.newStatus)}
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-on-surface-variant/60 font-medium mt-1.5">{formatDate(log.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Info Card */}
          <div className="bg-primary text-on-primary p-6 rounded-3xl shadow-xl shadow-primary/20">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-rounded">info</span>
              تفاصيل النظام
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="opacity-70 font-medium">تاريخ الإنشاء</span>
                <span className="font-bold">{formatDate(news.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="opacity-70 font-medium">آخر تحديث</span>
                <span className="font-bold">{formatDate(news.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="opacity-70 font-medium">بواسطة</span>
                <span className="font-bold">مستخدم #{news.createdBy.slice(0, 4)}</span>
              </div>
              <div className="pt-6 border-t border-on-primary/10 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">الحالة الحالية</span>
                <span className="px-2.5 py-1 bg-on-primary/10 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  {getStatusLabel(news.status)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsDetail;
