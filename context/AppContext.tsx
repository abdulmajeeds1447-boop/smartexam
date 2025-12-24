import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ExamEnvelope, EnvelopeStatus, AttendanceStatus, Notification, Role, Teacher, Student } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch, 
  query, 
  orderBy, 
  addDoc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';

interface AppContextType {
  userRole: Role | null;
  setUserRole: (role: Role | null) => void;
  currentUser: Teacher | null; // Store logged in teacher data
  exams: ExamEnvelope[];
  teachers: Teacher[];
  students: Student[]; // NEW: Master list of students
  notifications: Notification[];
  activeExamId: string | null;
  
  // Actions
  loginTeacher: (teacherId: string) => Promise<boolean>;
  processCommitteeScan: (committeeNumber: string, teacherId: string) => Promise<{success: boolean, message?: string}>;
  processAdminDeliveryScan: (committeeNumber: string) => Promise<{success: boolean, message?: string}>; // NEW
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

  // Sync Teachers
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'teachers'), 
      (snapshot) => {
        const teachersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
        setTeachers(teachersData);
      },
      (error) => {
        console.warn("Teachers sync error:", error instanceof Error ? error.message : String(error));
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync Exams
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'exams'), 
      (snapshot) => {
        const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamEnvelope));
        setExams(examsData);
      },
      (error) => {
        console.warn("Exams sync error:", error instanceof Error ? error.message : String(error));
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync Students (Master List)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), 
      (snapshot) => {
        const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        setStudents(studentsData);
      },
      (error) => {
        console.warn("Students sync error:", error instanceof Error ? error.message : String(error));
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync Notifications
  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const notifsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        setNotifications(notifsData);
      },
      (error) => {
        console.warn("Notifications sync error:", error instanceof Error ? error.message : String(error));
      }
    );
    return () => unsubscribe();
  }, []);

  const sendNotification = async (title: string, message: string, type: 'info' | 'warning' | 'success' = 'info') => {
    try {
        await addDoc(collection(db, 'notifications'), {
            title,
            message,
            type,
            timestamp: Date.now(),
            read: false
        });
    } catch (error: any) {
        console.error("Error sending notification:", error?.message || "Unknown error");
    }
  };

  const loginTeacher = async (teacherId: string): Promise<boolean> => {
    try {
      const localTeacher = teachers.find(t => t.id === teacherId);
      if (localTeacher) {
        setCurrentUser(localTeacher);
        setUserRole(Role.TEACHER);
        return true;
      }
      const docRef = doc(db, 'teachers', teacherId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const teacherData = { id: docSnap.id, ...docSnap.data() } as Teacher;
        setCurrentUser(teacherData);
        setUserRole(Role.TEACHER);
        return true;
      } else {
        return false;
      }
    } catch (error: any) {
      console.error("Login error:", error?.message || "Unknown error");
      return false;
    }
  };

  const importTeachers = async (newTeachers: Teacher[]) => {
    try {
        const batch = writeBatch(db);
        newTeachers.forEach(teacher => {
        const docRef = doc(db, 'teachers', teacher.id);
        batch.set(docRef, teacher);
        });
        await batch.commit();
        sendNotification('تم الاستيراد', `تم استيراد ${newTeachers.length} معلم بنجاح`, 'success');
    } catch (error: any) {
        console.error("Import teachers error:", error?.message || String(error));
        alert("فشل الاستيراد: " + (error?.message || "خطأ غير معروف"));
    }
  };

  const importExams = async (newExams: ExamEnvelope[]) => {
    try {
        const chunkSize = 400;
        for (let i = 0; i < newExams.length; i += chunkSize) {
            const chunk = newExams.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            chunk.forEach(exam => {
                const docRef = doc(db, 'exams', exam.id);
                batch.set(docRef, exam);
            });
            await batch.commit();
        }
        sendNotification('تم الاستيراد', `تم إنشاء ${newExams.length} لجنة اختبارية بنجاح`, 'success');
    } catch (error: any) {
        console.error("Import exams error:", error?.message || String(error));
        alert("فشل الاستيراد: " + (error?.message || "خطأ غير معروف"));
    }
  };

  // Student Management Functions
  const importStudents = async (newStudents: Student[]) => {
    try {
        const chunkSize = 400;
        for (let i = 0; i < newStudents.length; i += chunkSize) {
            const chunk = newStudents.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            chunk.forEach(student => {
                const docRef = doc(db, 'students', student.id);
                batch.set(docRef, student);
            });
            await batch.commit();
        }
        sendNotification('تم الاستيراد', `تم تحديث بيانات ${newStudents.length} طالب بنجاح`, 'success');
    } catch (error: any) {
        console.error("Import students error:", error?.message || String(error));
        alert("فشل استيراد الطلاب: " + (error?.message || "خطأ غير معروف"));
    }
  };

  const deleteStudent = async (studentId: string) => {
    try {
      await deleteDoc(doc(db, 'students', studentId));
      sendNotification('حذف طالب', 'تم حذف بيانات الطالب من السجل العام', 'info');
    } catch (error: any) {
      console.error("Delete student error:", error?.message || String(error));
      alert("فشل الحذف");
    }
  };

  const clearAllStudents = async () => {
    try {
      const batchLimit = 400;
      let batch = writeBatch(db);
      let count = 0;
      
      for (const student of students) {
        const ref = doc(db, 'students', student.id);
        batch.delete(ref);
        count++;
        if (count >= batchLimit) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      sendNotification('مسح شامل', 'تم مسح جميع الطلاب من قاعدة البيانات', 'warning');
    } catch (error: any) {
      console.error("Clear all students error:", error?.message || String(error));
      alert("فشل المسح الشامل");
    }
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
        if (count >= batchLimit) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      sendNotification('مسح شامل', 'تم مسح جميع المعلمين من قاعدة البيانات', 'warning');
    } catch (error: any) {
      console.error("Clear all teachers error:", error?.message || String(error));
      alert("فشل المسح الشامل");
    }
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
        if (count >= batchLimit) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      sendNotification('مسح شامل', 'تم مسح جميع اللجان والاختبارات من قاعدة البيانات', 'warning');
    } catch (error: any) {
      console.error("Clear all exams error:", error?.message || String(error));
      alert("فشل المسح الشامل");
    }
  };

  // NEW LOGIC: Scan by Committee Number (Static QR)
  const processCommitteeScan = async (committeeNumber: string, teacherId: string): Promise<{success: boolean, message?: string}> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        // 1. Find exams for this committee TODAY
        const todaysExams = exams.filter(e => 
            e.committeeNumber === committeeNumber && 
            e.date === today &&
            e.status !== EnvelopeStatus.COMPLETED &&
            e.status !== EnvelopeStatus.DELIVERED
        );

        if (todaysExams.length === 0) {
            return { success: false, message: `لا توجد اختبارات مجدولة للجنة ${committeeNumber} اليوم (${today})` };
        }

        // 2. Determine which period is active
        let targetExam: ExamEnvelope | undefined;

        if (todaysExams.length === 1) {
            targetExam = todaysExams[0];
        } else {
            targetExam = todaysExams.find(e => currentTime >= e.startTime && currentTime <= e.endTime);
            if (!targetExam) {
                targetExam = todaysExams.find(e => e.startTime >= currentTime);
            }
            if (!targetExam) targetExam = todaysExams[0];
        }

        if (targetExam) {
            await scanEnvelope(targetExam.id, teacherId);
            return { success: true };
        } else {
            return { success: false, message: 'لم يتم العثور على فترة اختبار مناسبة في هذا الوقت.' };
        }

    } catch (error: any) {
        // Prevent Circular JSON error by logging only the message
        const msg = error?.message || String(error);
        console.error("Committee Scan Error:", msg);
        return { success: false, message: msg };
    }
  };

  // NEW: Process Admin/Control Delivery Scan
  const processAdminDeliveryScan = async (committeeNumber: string): Promise<{success: boolean, message?: string}> => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Find exams for this committee TODAY that are marked COMPLETED (Teacher finished them)
        const completedExams = exams.filter(e => 
            e.committeeNumber === committeeNumber && 
            e.date === today &&
            e.status === EnvelopeStatus.COMPLETED
        );

        if (completedExams.length === 0) {
             // Check if already delivered
             const delivered = exams.some(e => 
                e.committeeNumber === committeeNumber && 
                e.date === today && 
                e.status === EnvelopeStatus.DELIVERED
            );
            
            if (delivered) {
                 return { success: false, message: 'تم تسليم المظروف مسبقاً.' };
            }

            return { success: false, message: 'لم يتم إنهاء الاختبار من قبل المعلم بعد، أو لا يوجد اختبار اليوم.' };
        }

        // Mark all completed exams for this committee today as DELIVERED
        for (const exam of completedExams) {
            await deliverEnvelopeToControl(exam.id);
        }

        return { success: true, message: `تم استلام ${completedExams.length} مظروف من اللجنة ${committeeNumber}` };

    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error("Admin Delivery Scan Error:", msg);
        return { success: false, message: msg };
    }
  };


  const scanEnvelope = async (examId: string, teacherId: string) => {
    try {
        const examRef = doc(db, 'exams', examId);
        await updateDoc(examRef, {
            status: EnvelopeStatus.RECEIVED,
            teacherId: teacherId
        });
        setActiveExamId(examId);
        sendNotification('بدء الاختبار', `تم فتح المظروف ${examId} من قبل المعلم`, 'info');
    } catch (error: any) {
        console.error("Scan error:", error?.message || String(error));
    }
  };

  const markAttendance = async (examId: string, studentId: string, status: AttendanceStatus) => {
    try {
        const exam = exams.find(e => e.id === examId);
        if (!exam) return;

        const updatedAttendance = exam.attendance.map(record => {
        if (record.studentId === studentId) {
            return { ...record, status, timestamp: Date.now() };
        }
        return record;
        });

        const examRef = doc(db, 'exams', examId);
        await updateDoc(examRef, {
            attendance: updatedAttendance
        });

        if (status === AttendanceStatus.ABSENT) {
            const student = exam.students.find(s => s.id === studentId);
            if(student) {
                sendNotification('تنبيه غياب', `الطالب ${student.name} غائب عن اختبار ${exam.subject}`, 'warning');
            }
        }
    } catch (error: any) {
        console.error("Attendance error:", error?.message || String(error));
    }
  };

  const submitEnvelope = async (examId: string) => {
    try {
        const examRef = doc(db, 'exams', examId);
        await updateDoc(examRef, {
            status: EnvelopeStatus.COMPLETED
        });
        setActiveExamId(null);
        sendNotification('انتهاء الاختبار', `تم جمع أوراق الاختبار ${examId}`, 'success');
    } catch (error: any) {
        console.error("Submit error:", error?.message || String(error));
    }
  };

  const deliverEnvelopeToControl = async (examId: string) => {
    try {
        const examRef = doc(db, 'exams', examId);
        await updateDoc(examRef, {
            status: EnvelopeStatus.DELIVERED
        });
        sendNotification('تسليم الكنترول', `تم تسليم مظروف ${examId} إلى الكنترول`, 'success');
    } catch (error: any) {
        console.error("Delivery error:", error?.message || String(error));
    }
  };

  return (
    <AppContext.Provider value={{
      userRole,
      setUserRole,
      currentUser,
      exams,
      teachers,
      students,
      notifications,
      activeExamId,
      loginTeacher,
      processCommitteeScan,
      processAdminDeliveryScan, // Export new function
      scanEnvelope,
      markAttendance,
      submitEnvelope,
      deliverEnvelopeToControl,
      setActiveExamId,
      importTeachers,
      importExams,
      importStudents,
      deleteStudent,
      clearAllStudents,
      clearAllTeachers,
      clearAllExams
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