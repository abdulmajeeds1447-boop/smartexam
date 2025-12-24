import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Role } from '../types';
import { ShieldCheck, Smartphone, ArrowRight, Loader } from 'lucide-react';

export const Login: React.FC = () => {
  const { setUserRole, loginTeacher } = useApp();
  const [loginMode, setLoginMode] = useState<'SELECTION' | 'TEACHER_INPUT'>('SELECTION');
  const [teacherId, setTeacherId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    const success = await loginTeacher(teacherId);
    
    if (success) {
      // Role is set inside loginTeacher
    } else {
      setError('رقم المعلم غير صحيح أو غير مسجل في النظام');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <div className="bg-primary-600 p-8 text-center">
          <h1 className="text-3xl font-extrabold text-white mb-2">النظام الذكي</h1>
          <p className="text-primary-100">بوابة إدارة الاختبارات المركزية</p>
        </div>
        
        <div className="p-8">
          {loginMode === 'SELECTION' ? (
            <>
              <h2 className="text-center text-gray-700 font-bold text-xl mb-8">اختر طريقة الدخول</h2>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setUserRole(Role.ADMIN)}
                  className="w-full flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                >
                  <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="mr-4 text-right">
                    <h3 className="font-bold text-gray-900 text-lg">إدارة المدرسة (الكنترول)</h3>
                    <p className="text-sm text-gray-500">لوحة التحكم، التقارير، إنشاء المظاريف</p>
                  </div>
                </button>

                <button 
                  onClick={() => setLoginMode('TEACHER_INPUT')}
                  className="w-full flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                >
                  <div className="bg-green-100 p-3 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <Smartphone size={32} />
                  </div>
                  <div className="mr-4 text-right">
                    <h3 className="font-bold text-gray-900 text-lg">المعلم المراقب</h3>
                    <p className="text-sm text-gray-500">تسجيل الدخول برقم المعلم</p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <div className="animate-fade-in">
              <button 
                onClick={() => { setLoginMode('SELECTION'); setError(''); setTeacherId(''); }}
                className="flex items-center text-gray-400 text-sm mb-6 hover:text-gray-600"
              >
                <ArrowRight size={16} className="ml-1" />
                العودة للخلف
              </button>

              <h2 className="text-center text-gray-800 font-bold text-2xl mb-2">تسجيل دخول المعلم</h2>
              <p className="text-center text-gray-500 mb-6 text-sm">أدخل رقم المعلم الخاص بك للوصول للنظام</p>

              <form onSubmit={handleTeacherLogin} className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">رقم المعلم</label>
                  <input 
                    type="text" 
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="مثال: 1050"
                    autoFocus
                  />
                </div>
                
                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-600"></div>
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    'دخول النظام'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-400">
          الإصدار 1.0.0 | جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
};