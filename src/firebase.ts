import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const seedInitialData = async () => {
  const deptsRef = collection(db, 'departments');
  const snap = await getDocs(deptsRef);
  if (snap.empty) {
    const departments = [
      { id: 'office_minister', name: 'مكتب الوزير' },
      { id: 'office_undersecretary', name: 'مكتب الوكيل' },
      { id: 'media_dept', name: 'الإدارة العامة للإعلام' },
      { id: 'legal_dept', name: 'قطاع الشؤون القانونية' },
      { id: 'support_dept', name: 'قطاع الخدمات المساندة' },
    ];
    for (const dept of departments) {
      await setDoc(doc(db, 'departments', dept.id), dept);
    }
    console.log('Seed data added successfully');
  }

  const newsRef = collection(db, 'news_items');
  const newsSnap = await getDocs(newsRef);
  console.log('Current news count:', newsSnap.size);
  
  if (newsSnap.size < 3) {
    console.log('Adding dummy news items...');
    const dummyNews = [
      {
        title: 'إطلاق المبادرة الوطنية للتحول الرقمي في قطاع الإعلام',
        type: 'خبر صحفي',
        departmentId: 'media_dept',
        content: 'تفاصيل المبادرة الوطنية للتحول الرقمي...',
        status: 'published',
        isEdited: true,
        isReviewed: true,
        isApprovedByDept: true,
        isApprovedByFinal: true,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        title: 'توقيع اتفاقية تعاون بين الوزارة والمركز الوطني للذكاء الاصطناعي',
        type: 'بيان صحفي',
        departmentId: 'office_minister',
        content: 'شهد معالي الوزير اليوم توقيع اتفاقية...',
        status: 'review',
        isEdited: true,
        isReviewed: false,
        isApprovedByDept: false,
        isApprovedByFinal: false,
        createdBy: 'system',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        title: 'تقرير الإنجاز السنوي للإدارة العامة للإعلام والاتصال',
        type: 'تقرير',
        departmentId: 'media_dept',
        content: 'يستعرض هذا التقرير أبرز الإنجازات...',
        status: 'draft',
        isEdited: false,
        isReviewed: false,
        isApprovedByDept: false,
        isApprovedByFinal: false,
        createdBy: 'system',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
      }
    ];

    for (const news of dummyNews) {
      // Check if title already exists to avoid duplicates if size < 3 but some are already there
      const exists = newsSnap.docs.some(doc => doc.data().title === news.title);
      if (!exists) {
        const newDocRef = doc(newsRef);
        await setDoc(newDocRef, { ...news, id: newDocRef.id });
      }
    }
    console.log('Dummy news seeding completed');
  }
};

export default app;
