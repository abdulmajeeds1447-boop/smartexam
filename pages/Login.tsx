import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Role } from '../types';
import { ShieldCheck, Smartphone, ArrowRight, Loader, UserCog, HeartHandshake, MonitorPlay, Lock, X } from 'lucide-react';

// --- إعدادات كلمات المرور (يمكنك تغييرها من هنا) ---
const ROLE_PASSWORDS = {
  [Role.MANAGER]: "1111",    // رمز دخول المدير
  [Role.CONTROL]: "2222",    // رمز دخول الكنترول
  [Role.COUNSELOR]: "3333",  // رمز دخول المرشد
  [Role.ADMIN]: "admin"      // رمز الأدمن
};

export const Login: React.FC = () => {
  const { setUserRole, loginTeacher } = useApp();
  const [view, setView] = useState<'SELECTION' | 'TEACHER_INPUT' | 'PIN_INPUT'>('SELECTION');
  
  // State for Teacher Login
  const [teacherId, setTeacherId] = useState('');
  
  // State for Admin/Role Login
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pin, setPin] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. معالجة دخول المعلم (كما هي سابقاً)
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    const success = await loginTeacher(teacherId);
    
    if (success) {
      // Login successful, role set in context
    } else {
      setError('رقم المعلم غير صحيح أو غير مسجل في النظام');
      setIsLoading(false);
    }
  };

  // 2. التحضير لدخول الأدوار الإدارية
  const initiateRoleLogin = (role: Role) => {
      setSelectedRole(role);
      setPin('');
      setError('');
      setView('PIN_INPUT');
  };

  // 3. التحقق من رمز المرور
  const verifyPin = (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);

      // محاكاة تأخير بسيط
      setTimeout(() => {
          if (selectedRole && ROLE_PASSWORDS[selectedRole as keyof typeof ROLE_PASSWORDS] === pin) {
              setUserRole(selectedRole);
          } else {
              setError('رمز المرور غير صحيح');
              setIsLoading(false);
          }
      }, 500);
  };

  const goBack = () => {
      setView('SELECTION');
      setError('');
      setPin('');
      setTeacherId('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative flex flex-col md:flex-row min-h-[500px]">
        
        {/* الجانب الأيمن (الشعار) */}
        <div className="bg-primary-600 p-8 text-center md:w-5/12 flex flex-col justify-center items-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10 z-0"></div>
          <div className="bg-white/20 p-4 rounded-full mb-4 z-10 backdrop-blur-sm">
            <ShieldCheck size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2 z-10">النظام الذكي</h1>
          <p className="text-primary-100 mb-6 z-10">بوابة إدارة الاختبارات المركزية</p>
        </div>
        
        {/* الجانب الأيسر (النماذج) */}
        <div className="p-8 md:w-7/12 bg-white flex flex-col justify-center">
          
          {/* 1. الشاشة الرئيسية: اختيار الدور */}
          {view === 'SELECTION' && (
            <div className="animate-fade-in space-y-3">
              <h2 className="text-center text-gray-800 font-bold text-xl mb-6">مرحباً بك، اختر طريقة الدخول</h2>
              
              <button onClick={() => initiateRoleLogin(Role.MANAGER)} className="w-full flex items-center p-3 border border-gray-100 rounded-xl hover:border-primary-500 hover:bg-purple-50 transition-all group">
                  <div className="bg-purple-100 p-2 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors"><MonitorPlay size={20} /></div>
                  <div className="mr-3 text-right"><h3 className="font-bold text-gray-800">مدير المدرسة</h3></div>
              </button>

              <button onClick={() => initiateRoleLogin(Role.CONTROL)} className="w-full flex items-center p-3 border border-gray-100 rounded-xl hover:border-primary-500 hover:bg-blue-50 transition-all group">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><UserCog size={20} /></div>
                  <div className="mr-3 text-right"><h3 className="font-bold text-gray-800">مسؤول الكنترول</h3></div>
              </button>

              <button onClick={() => initiateRoleLogin(Role.COUNSELOR)} className="w-full flex items-center p-3 border border-gray-100 rounded-xl hover:border-primary-500 hover:bg-orange-50 transition-all group">
                  <div className="bg-orange-100 p-2 rounded-lg text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors"><HeartHandshake size={20} /></div>
                  <div className="mr-3 text-right"><h3 className="font-bold text-gray-800">المرشد الطلابي</h3></div>
              </button>

              <div className="border-t border-gray-100 my-4"></div>

              <button onClick={() => setView('TEACHER_INPUT')} className="w-full flex items-center p-3 border-2 border-primary-100 bg-primary-50/50 rounded-xl hover:bg-primary-100 transition-all group">
                  <div className="bg-green-100 p-2 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors"><Smartphone size={20} /></div>
                  <div className="mr-3 text-right">
                    <h3 className="font-bold text-gray-900">المعلم المراقب</h3>
                    <p className="text-xs text-gray-500">الدخول بالرقم الوظيفي</p>
                  </div>
              </button>
            </div>
          )}

          {/* 2. شاشة إدخال رمز المرور (للمدير والكنترول والمرشد) */}
          {view === 'PIN_INPUT' && (
            <div className="animate-fade-in">
               <button onClick={goBack} className="flex items-center text-gray-400 text-sm mb-6 hover:text-gray-600"><ArrowRight size={16} className="ml-1" />رجوع</button>
               
               <div className="text-center mb-6">
                 <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-500">
                    <Lock size={30} />
                 </div>
                 <h2 className="text-gray-800 font-bold text-lg">أدخل رمز المرور</h2>
                 <p className="text-gray-500 text-sm">خاص بـ: {selectedRole === Role.MANAGER ? 'المدير' : selectedRole === Role.CONTROL ? 'الكنترول' : 'المرشد'}</p>
               </div>

               <form onSubmit={verifyPin} className="space-y-4">
                 <input 
                    type="password" 
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full text-center text-2xl tracking-widest px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder="****"
                    maxLength={6}
                    autoFocus
                 />
                 {error && <p className="text-red-500 text-sm text-center font-bold bg-red-50 p-2 rounded">{error}</p>}
                 <button type="submit" disabled={isLoading} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors shadow-lg">
                    {isLoading ? <Loader className="animate-spin mx-auto" /> : 'تحقق ودخول'}
                 </button>
               </form>
            </div>
          )}

          {/* 3. شاشة دخول المعلم */}
          {view === 'TEACHER_INPUT' && (
            <div className="animate-fade-in">
              <button onClick={goBack} className="flex items-center text-gray-400 text-sm mb-6 hover:text-gray-600"><ArrowRight size={16} className="ml-1" />رجوع</button>
              
              <div className="text-center mb-6">
                 <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                    <Smartphone size={30} />
                 </div>
                 <h2 className="text-gray-800 font-bold text-lg">بوابة المعلم</h2>
                 <p className="text-gray-500 text-sm">أدخل رقم المعلم المسجل في النظام</p>
               </div>

              <form onSubmit={handleTeacherLogin} className="space-y-4">
                <input 
                  type="text" 
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 transition-all"
                  placeholder="رقم المعلم..."
                  autoFocus
                />
                
                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                    <X size={16} /> {error}
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200">
                  {isLoading ? <Loader className="animate-spin mx-auto" /> : 'دخول النظام'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
