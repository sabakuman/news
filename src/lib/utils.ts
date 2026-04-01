import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'draft': return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'review': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'sector_approval': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'final_approval': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'ready': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'published': return 'bg-green-100 text-green-800 border-green-200';
    case 'archived': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function getStatusLabel(status: string) {
  switch (status) {
    case 'draft': return 'مسودة';
    case 'review': return 'قيد المراجعة الداخلية';
    case 'sector_approval': return 'بانتظار اعتماد القطاع';
    case 'final_approval': return 'بانتظار الاعتماد النهائي';
    case 'ready': return 'جاهز للنشر';
    case 'published': return 'منشور';
    case 'archived': return 'مؤرشف';
    case 'rejected': return 'معاد للتعديل';
    default: return status;
  }
}
