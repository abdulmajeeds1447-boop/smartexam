export enum Role {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export enum EnvelopeStatus {
  PENDING = 'PENDING',        // Created, waiting pickup
  RECEIVED = 'RECEIVED',      // Teacher scanned QR, in classroom
  COMPLETED = 'COMPLETED',    // Exam finished, papers collected
  DELIVERED = 'DELIVERED'     // Returned to control
}

export enum AttendanceStatus {
  UNKNOWN = 'UNKNOWN',
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT'
}

export interface Student {
  id: string;
  name: string;
  image: string;
  stage: string;       // e.g. "المرحلة الثانوية"
  grade: string;       // e.g. "الصف الأول الثانوي"
  className: string;   // e.g. "1/2"
  seatNumber: string;  // e.g. "1001"
  subject: string;     // Subject specific to this student
}

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  timestamp?: number;
}

export interface ExamEnvelope {
  id: string;
  subject: string;     // General title or summary (e.g. "Math / Physics")
  grades: string[];    // List of grades involved in this committee
  committeeNumber: string; // "Lajna" number
  location: string;    // Exam Hall Location
  date: string; // ISO Date
  startTime: string;
  endTime: string;
  period: string;      // NEW: "الفترة الأولى", "الفترة الثانية"
  teacherId?: string; // Assigned teacher or who picked it up
  status: EnvelopeStatus;
  students: Student[];
  attendance: AttendanceRecord[];
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  qrCode: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  timestamp: number;
  read: boolean;
}