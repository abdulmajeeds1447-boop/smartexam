import React from 'react';
import { useApp } from '../../context/AppContext';
import { Scanner } from './Scanner';
import { ExamSession } from './Session'; // تأكد أن اسم الملف مطابق (Session.tsx)
import { LogOut, User } from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { activeExamId, currentUser, setUserRole } = useApp();

  // في حال فقدان بيانات الدخول
  if (!currentUser) {
      return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* شريط علوي بسيط يظهر اسم المعلم */}
      <div className="bg-white px-6 py-4 shadow-sm border-b flex justify-between items-center z-20">
          <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                  <User size={20} />
              </div>
              <div>
                  <p className="text-xs text-gray-500">أهلاً بك</p>
                  <h3 className="font-bold text-gray-800 text-sm">{currentUser.name}</h3>
              </div>
          </div>
          
          {/* زر تسجيل الخروج يظهر فقط إذا لم يكن هناك اختبار نشط */}
          {!activeExamId && (
              <button 
                  onClick={() => setUserRole(null)}
                  className="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors"
                  title="تسجيل الخروج"
              >
                  <LogOut size={20} />
              </button>
          )}
      </div>

      {/* منطقة المحتوى الرئيسية */}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
          {activeExamId ? (
              // الحالة 1: يوجد اختبار نشط -> عرض قائمة الطلاب والإنهاء
              <ExamSession />
          ) : (
              // الحالة 2: لا يوجد اختبار -> عرض الماسح الضوئي
              <div className="flex flex-col h-full justify-center">
                  <Scanner onScanSuccess={() => {
                      // لا نحتاج لفعل شيء هنا لأن
                      // AppContext سيقوم بتحديث activeExamId
                      // مما سيؤدي لتغيير الشاشة تلقائياً
                      console.log("Scan Complete");
                  }} />
                  
                  <p className="text-center text-gray-400 text-xs mt-6">
                      تأكد من السماح للمتصفح باستخدام الكاميرا
                  </p>
              </div>
          )}
      </div>
    </div>
  );
};
