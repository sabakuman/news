export type UserRole = 'admin' | 'editor' | 'reviewer' | 'sector_approver' | 'final_approver' | 'viewer';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  status: 'active' | 'inactive';
}

export interface Department {
  id: string;
  name: string;
}

export type NewsStatus = 'draft' | 'review' | 'sector_approval' | 'final_approval' | 'ready' | 'published' | 'archived' | 'rejected';

export interface NewsItem {
  id: string;
  title: string;
  type: string;
  departmentId: string;
  content: string; // This will now store the file name or URL of the uploaded content
  contentFileName?: string;
  preparedBy?: string;
  isEdited: boolean;
  isReviewed: boolean;
  reviewerName?: string;
  reviewerFileName?: string;
  isApprovedByDept: boolean;
  approverName?: string;
  approverFileName?: string;
  isApprovedByFinal: boolean;
  finalApproverName?: string;
  finalApproverFileName?: string;
  otherType?: string;
  publishDate?: string;
  notes?: string;
  newsUrl?: string;
  isArchived?: boolean;
  status: NewsStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  newsItemId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  newsItemId: string;
  name: string;
  currentVersionId?: string;
  createdAt: string;
}

export interface AttachmentVersion {
  id: string;
  attachmentId: string;
  newsItemId: string;
  versionNumber: number;
  fileUrl: string;
  fileName: string;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
  description?: string;
}

export interface ActivityLog {
  id: string;
  newsItemId: string;
  userId: string;
  action: string;
  previousStatus?: NewsStatus;
  newStatus?: NewsStatus;
  timestamp: string;
}
