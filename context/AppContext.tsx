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
  logout: () => void;
  
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

  // --- المزامنة مع Firebase ---
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
    try {
      await addDoc(collection(db, 'notifications'), { title, message, type, timestamp: Date.now(), read: false, relatedStudentId: relatedStudentId || null });
    } catch (e) { console.error("Notification Error", e); }
  };

  const logout = () => {
      setCurrentUser(null);
      setUserRole(null);
      setActiveExamId(null);
  };

  const loginTeacher = async (identifier: string): Promise<{success: boolean, message?: string}> => {
    try {
      const input = identifier.trim();
      const localTeacher = teachers.find(t => t.id === input || t.phone === input);
      if (localTeacher) {
        setCurrentUser(localTeacher);
        setUserRole(Role.TEACHER);
        return { success: true };
      }
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

  const processCommitteeScan = async (committeeNumber: string, teacherId: string): Promise<{success: boolean, message?: string}> => {
    try {
        const today = new Date().toLocaleDateString('en-CA'); 
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        let availableExams = exams.filter(e => 
            e.committeeNumber === committeeNumber && 
            e.status !== EnvelopeStatus.COMPLETED &&
            e.status !== EnvelopeStatus.DELIVERED
        );

        if (availableExams.length === 0) return { success: false, message: `لا توجد اختبارات لهذه اللجنة` };

        let targetExam = availableExams.find(e => e.date === today && currentTime >= e.startTime && currentTime <= e.endTime);
        if (!targetExam) targetExam = availableExams.find(e => e.date === today);
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
      sendNotification('بدء الاختبار', `تم فتح المظروف ${eid}`, 'info');
  };
  
  const markAttendance = async (eid: string, sid: string, status: AttendanceStatus) => {
      const exam = exams.find(e => e.id === eid);
      if (!exam) return;
      const updated = exam.attendance.map(r => r.studentId === sid ? { ...r, status, timestamp: Date.now() } : r);
      await updateDoc(doc(db, 'exams', eid), { attendance: updated });
      
      if (status === AttendanceStatus.ABSENT) {
          const s = exam.students.find(st => st.id === sid);
          if (s) sendNotification('حالة غياب', `الطالب ${s.name} غائب`, 'warning', sid);
      }
  };
  
  const submitEnvelope = async (eid: string) => { 
      await updateDoc(doc(db, 'exams', eid), { status: EnvelopeStatus.COMPLETED });
      setActiveExamId(null);
      sendNotification('انتهاء اللجنة', `تم إغلاق اللجنة ${eid}`, 'success');
  };
  
  const deliverEnvelopeToControl = async (eid: string) => { 
      await updateDoc(doc(db, 'exams', eid), { status: EnvelopeStatus.DELIVERED });
      sendNotification('تسليم نهائي', `تم تسليم المظروف ${eid} للكنترول`, 'success');
  };
  
  const importTeachers = async (t: Teacher[]) => { const b = writeBatch(db); t.forEach(x => b.set(doc(db,'teachers',x.id), x)); await b.commit(); };
  const importExams = async (e: ExamEnvelope[]) => { 
      const chunkSize = 400;
      for (let i = 0; i < e.length; i += chunkSize) {
          const chunk = e.slice(i, i + chunkSize);
          const b = writeBatch(db);
          chunk.forEach(x => b.set(doc(db,'exams',x.id), x)); 
          await b.commit(); 
      }
  };
  const importStudents = async (s: Student[]) => { 
      const chunkSize = 400;
      for (let i = 0; i < s.length; i += chunkSize) {
          const chunk = s.slice(i, i + chunkSize);
          const b = writeBatch(db);
          chunk.forEach(x => b.set(doc(db,'students',x.id), x)); 
          await b.commit(); 
      }
  };
  const deleteStudent = async (id: string) => { await deleteDoc(doc(db, 'students', id)); };

  // ✅ الأكواد الكاملة للمسح الشامل (لم تعد مختصرة)
  const clearAllStudents = async () => {
    try {
      const batchLimit = 400;
      let batch = writeBatch(db);
      let count = 0;
      for (const student of students) {
        const ref = doc(db, 'students', student.id);
        batch.delete(ref);
        count++;
        if (count >= batchLimit) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();
      sendNotification('تنظيف', 'تم مسح سجلات الطلاب', 'warning');
    } catch (e) { console.error(e); }
  };

  const clearAllTeachers = async () => {
    try {
      const batchLimit = 400;
      let batch = writeBatch(db);
      let count = 0;
      for (const teacher of teachers) {
        const ref = doc(db, 'teachers', teacher.id);
        batch.delete(ref);
        count++;
        if (count >= batchLimit) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();
      sendNotification('تنظيف', 'تم مسح سجلات المعلمين', 'warning');
    } catch (e) { console.error(e); }
  };

  const clearAllExams = async () => {
    try {
      const batchLimit = 400;
      let batch = writeBatch(db);
      let count = 0;
      for (const exam of exams) {
        const ref = doc(db, 'exams', exam.id);
        batch.delete(ref);
        count++;
        if (count >= batchLimit) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();
      sendNotification('تنظيف', 'تم مسح سجلات الاختبارات', 'warning');
    } catch (e) { console.error(e); }
  };

  return (
    <AppContext.Provider value={{
      userRole, setUserRole, currentUser, exams, teachers, students, notifications, activeExamId,
      loginTeacher, logout,
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
