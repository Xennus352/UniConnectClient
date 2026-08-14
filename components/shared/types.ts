export interface User {
  initials: string;
  name: string;
  role: string;
  color?: string;
}

export interface FeedItemData {
  id: string;
  author: User;
  isVerified?: boolean;
  timeAgo: string;
  content: string;
  image?: string;
  tags: { label: string; color: string; emoji?: string }[];
  likes: number;
  comments: number;
  shares: number;
  isLiked?: boolean;
}

export interface EventItemData {
  id: string;
  day: string;
  month: string;
  title: string;
  description: string;
  action: string;
}

export interface MessageData {
  id: string;
  user: User;
  preview: string;
  time: string;
  unread?: boolean;
}

export interface InboxItemData {
  id: string;
  sender: User;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
  starred?: boolean;
}

export interface StatCardData {
  icon: string;
  iconBg: string;
  value: string | number;
  label: string;
  trend?: string;
}

export interface StudentData {
  name: string;
  initials: string;
  color: string;
  rollNo: string;
  major: string;
  majorColor: string;
  email: string;
  semester: string;
}

export interface LecturerData {
  name: string;
  initials: string;
  color: string;
  department: string;
  courses: number;
}

export interface StaffData {
  name: string;
  initials: string;
  color: string;
  staffId: string;
  department: string;
  role: string;
  roleColor: string;
  phone: string;
  email: string;
}

export interface ExploreItemData {
  title: string;
  meta: string;
  description: string;
  tags: { label: string; color: string }[];
}

export interface NavItem {
  section: string;
  items: { icon: string; label: string; id: string; badge?: string | number }[];
}

export interface RollCallData {
  rollNo: string;
  name: string;
  initials: string;
  color: string;
  year: string;
  present: boolean;
}

export interface Email {
  id: number;
  from: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  read: boolean;
  starred: boolean;
  avatar: string;
  role: string;
}

export interface ExamResultItem {
  id: number;
  studentName: string;
  regNumber: string;
  programme: string;
  semester: string;
  session: string;
  gpa: string;
  pdfUrl: string;
  status: "ready" | "pending";
}

export interface ChatMessage {
  id: number;
  sender: "me" | "other";
  text: string;
  time: string;
}

export interface Contact {
  id: number;
  name: string;
  avatar: string;
  role: string;
  online: boolean;
  lastSeen: string;
  unread: number;
}

export interface Notification {
  id: number;
  type: "like" | "comment" | "follow" | "event";
  message: string;
  time: string;
  read: boolean;
}
