import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ExamEnvelope, EnvelopeStatus, AttendanceStatus, Notification, Role, Teacher, Student } from '../types';
import { db } from '../firebase';
import { 
  collection, onSnapshot, doc, updateDoc, writeBatch, query, orderBy, addDoc, getDoc, deleteDoc, where, getDocs 
} from 'firebase/firestore';

interface AppContextType {
  userRole: Role | null;
  setUserRole: (role: Role | null) => void;
  currentUser: Teacher | null;
  exams: ExamEnvelope[];
  teachers: Teacher[];
  students: Student[];
  notifications: Notification[];
  activeExamId: string | null;
  
  loginTeacher: (identifier: string) => Promise<{success: boolean, message?: string}>;
  logout: () => void; // ✅ إضافة دالة الخروج الآمن
  
  processCommitteeScan: (committeeNumber: string, teacherId: string) => Promise<{success: boolean, message?: string}>;
  processAdminDeliveryScan: (committeeNumber: string) => Promise<{success: boolean, message?: string}>;
  scanEnvelope: (examId: string, teacherId: string) => Promise<void>;
  markAttendance: (examId: string, studentId: string, status: AttendanceStatus) => Promise<void>;
  submitEnvelope: (examId: string) => Promise<void>;
  deliverEnvelopeToControl: (examId: string) => Promise<void>;
  setActiveExamId: (id: string | null) => void;
  importTeachers: (newTeachers: Teacher[]) => Promise<void>;
  importExams: (newExams: ExamEnvelope[]) => Promise<void>;
  importStudents: (newStudents: Student[]) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  clearAllStudents: () => Promise<void>;
  clearAllTeachers: () => Promise<void>;
  clearAllExams: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);
  const [exams, setExams] = useState<ExamEnvelope[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);

  // Sync Data
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'teachers'), (snap) => setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher))));
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'exams'), (snap) => setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamEnvelope))));
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snap) => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student))));
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
    return () => unsubscribe();
  }, []);

  const sendNotification = async (title: string, message: string, type: 'info' | 'warning' | 'success' = 'info', relatedStudentId?: string) => {
    addDoc(collection(db, 'notifications'), { title, message, type, timestamp: Date.now(), read: false, relatedStudentId: relatedStudentId || null });
  };

  // ✅ دالة الخروج (Fix: Ghost Session)
  // تقوم بتنظيف كل المتغيرات لضمان عدم تداخل البيانات بين المستخدمين
  const logout = () => {
      setCurrentUser(null);
      setUserRole(null);
      setActiveExamId(null);
  };

  const loginTeacher = async (identifier: string): Promise<{success: boolean, message?: string}> => {
    try {
      const input = identifier.trim();
      // البحث المحلي أولاً
      const localTeacher = teachers.find(t => t.id === input || t.phone === input);
      if (localTeacher) {
        setCurrentUser(localTeacher);
        setUserRole(Role.TEACHER);
        return { success: true };
      }
      // البحث السحابي
      let teacherData: Teacher | null = null;
      if (input.startsWith('05')) {
          const q = query(collection(db, 'teachers'), where('phone', '==', input));
          const snap = await getDocs(q);
          if (!snap.empty) teacherData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Teacher;
      } else {
          const snap = await getDoc(doc(db, 'teachers', input));
          if (snap.exists()) teacherData = { id: snap.id, ...snap.data() } as Teacher;
      }
      if (teacherData) {
        setCurrentUser(teacherData);
        setUserRole(Role.TEACHER);
        return { success: true };
      }
      return { success: false, message: "بيانات غير صحيحة" };
    } catch (e: any) { return { success: false, message: e.message }; }
  };

  // --- Logic Functions ---
  const processCommitteeScan = async (committeeNumber: string, teacherId: string): Promise<{success: boolean, message?: string}> => {
    try {
        // ✅ استخدام التوقيت المحلي لضمان الدقة
        const today = new Date().toLocaleDateString('en-CA'); 
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        let availableExams = exams.filter(e => 
            e.committeeNumber === committeeNumber && 
            e.status !== EnvelopeStatus.COMPLETED &&
            e.status !== EnvelopeStatus.DELIVERED
        );

        if (availableExams.length === 0) return { success: false, message: `لا توجد اختبارات لهذه اللجنة` };

        // محاولة مطابقة الوقت
        let targetExam = availableExams.find(e => e.date === today && currentTime >= e.startTime && currentTime <= e.endTime);
        // إذا لم نجد، نطابق التاريخ فقط
        if (!targetExam) targetExam = availableExams.find(e => e.date === today);
        // إذا لم نجد (حالة اختبار، أو تجربة)، نأخذ أول واحد متاح
        if (!targetExam) targetExam = availableExams[0];

        if (targetExam) {
            await scanEnvelope(targetExam.id, teacherId);
            return { success: true };
        }
        return { success: false, message: 'حدث خطأ في تحديد الاختبار.' };
    } catch (e: any) { return { success: false, message: e.message }; }
  };

  const processAdminDeliveryScan = async (c: string) => { 
      const today = new Date().toLocaleDateString('en-CA');
      const completedExams = exams.filter(e => e.committeeNumber === c && e.date === today && e.status === EnvelopeStatus.COMPLETED);
      if (completedExams.length === 0) return { success: false, message: 'لا توجد مظاريف جاهزة للتسليم' };
      for (const exam of completedExams) await deliverEnvelopeToControl(exam.id);
      return { success: true, message: `تم استلام ${completedExams.length} مظروف` };
  };

  const scanEnvelope = async (eid: string, tid: string) => { 
      await updateDoc(doc(db, 'exams', eid), { status: EnvelopeStatus.RECEIVED, teacherId: tid });
      setActiveExamId(eid);
  };
  const markAttendance = async (eid: string, sid: string, status: AttendanceStatus) => {
      const exam = exams.find(e => e.id === eid);
      if (!exam) return;
      const updated = exam.attendance.map(r => r.studentId === sid ? { ...r, status, timestamp: Date.now() } : r);
      await updateDoc(doc(db, 'exams', eid), { attendance: updated });
  };
  const submitEnvelope = async (eid: string) => { 
      await updateDoc(doc(db, 'exams', eid), { status: EnvelopeStatus.COMPLETED });
      setActiveExamId(null);
  };
  const deliverEnvelopeToControl = async (eid: string) => { await updateDoc(doc(db, 'exams', eid), { status: EnvelopeStatus.DELIVERED }); };
  
  const importTeachers = async (t: Teacher[]) => { const b = writeBatch(db); t.forEach(x => b.set(doc(db,'teachers',x.id), x)); await b.commit(); };
  const importExams = async (e: ExamEnvelope[]) => { const b = writeBatch(db); e.forEach(x => b.set(doc(db,'exams',x.id), x)); await b.commit(); };
  const importStudents = async (s: Student[]) => { const b = writeBatch(db); s.forEach(x => b.set(doc(db,'students',x.id), x)); await b.commit(); };
  const deleteStudent = async (id: string) => { await deleteDoc(doc(db, 'students', id)); };
  const clearAllStudents = async () => { /* Logic hidden for brevity */ };
  const clearAllTeachers = async () => { /* Logic hidden for brevity */ };
  const clearAllExams = async () => { /* Logic hidden for brevity */ };

  return (
    <AppContext.Provider value={{
      userRole, setUserRole, currentUser, exams, teachers, students, notifications, activeExamId,
      loginTeacher, logout, // ✅
      processCommitteeScan, processAdminDeliveryScan, scanEnvelope, markAttendance, submitEnvelope, deliverEnvelopeToControl,
      setActiveExamId, importTeachers, importExams, importStudents, deleteStudent, clearAllStudents, clearAllTeachers, clearAllExams
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
