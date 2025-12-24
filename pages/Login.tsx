import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Role } from '../types';
import { ShieldCheck, Smartphone, ArrowRight, Loader, UserCog, HeartHandshake, MonitorPlay } from 'lucide-react';

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

  const handleRoleSelect = (role: Role) => {
      // In a real app, this would lead to a password screen.
      // Here we simulate direct access for demo purposes.
      setIsLoading(true);
      setTimeout(() => {
          setUserRole(role);
      }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative flex flex-col md:flex-row">
        
        {/* Banner Side */}
        <div className="bg-primary-600 p-8 text-center md:w-5/12 flex flex-col justify-center items-center text-white">
          <div className="bg-white/10 p-4 rounded-full mb-4">
            <ShieldCheck size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2">النظام الذكي</h1>
          <p className="text-primary-100 mb-6">بوابة إدارة الاختبارات المركزية</p>
          <div className="text-xs text-primary-200 border-t border-primary-500 pt-4 w-full">
            نظام متكامل يربط الإدارة، الكنترول، التوجيه الطلابي، والمعلمين.
          </div>
        </div>
        
        {/* Login Form Side */}
        <div className="p-8 md:w-7/12 bg-white">
          {loginMode === 'SELECTION' ? (
            <div className="h-full flex flex-col justify-center">
              <h2 className="text-center text-gray-800 font-bold text-xl mb-6">تسجيل الدخول للنظام</h2>
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => handleRoleSelect(Role.MANAGER)}
                  className="flex items-center p-3 border border-gray-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                >
                  <div className="bg-purple-100 p-2 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <MonitorPlay size={24} />
                  </div>
                  <div className="mr-3 text-right">
                    <h3 className="font-bold text-gray-900">مدير المدرسة</h3>
                    <p className="text-xs text-gray-500">شاشة المتابعة التفاعلية</p>
                  </div>
                </button>

                <button 
                  onClick={() => handleRoleSelect(Role.CONTROL)}
                  className="flex items-center p-3 border border-gray-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                >
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <UserCog size={24} />
                  </div>
                  <div className="mr-3 text-right">
                    <h3 className="font-bold text-gray-900">مسؤول الكنترول</h3>
                    <p className="text-xs text-gray-500">إدارة اللجان والمظاريف</p>
                  </div>
                </button>

                <button 
                  onClick={() => handleRoleSelect(Role.COUNSELOR)}
                  className="flex items-center p-3 border border-gray-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                >
                  <div className="bg-orange-100 p-2 rounded-lg text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <HeartHandshake size={24} />
                  </div>
                  <div className="mr-3 text-right">
                    <h3 className="font-bold text-gray-900">المرشد الطلابي</h3>
                    <p className="text-xs text-gray-500">متابعة الغياب والتواصل</p>
                  </div>
                </button>

                <button 
                  onClick={() => setLoginMode('TEACHER_INPUT')}
                  className="flex items-center p-3 border border-gray-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                >
                  <div className="bg-green-100 p-2 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <Smartphone size={24} />
                  </div>
                  <div className="mr-3 text-right">
                    <h3 className="font-bold text-gray-900">المعلم المراقب</h3>
                    <p className="text-xs text-gray-500">الدخول برقم المعلم</p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in h-full flex flex-col justify-center">
              <button 
                onClick={() => { setLoginMode('SELECTION'); setError(''); setTeacherId(''); }}
                className="flex items-center text-gray-400 text-sm mb-6 hover:text-gray-600 w-fit"
              >
                <ArrowRight size={16} className="ml-1" />
                تغيير الدور
              </button>

              <h2 className="text-center text-gray-800 font-bold text-2xl mb-2">دخول المعلم</h2>
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
      </div>
    </div>
  );
};