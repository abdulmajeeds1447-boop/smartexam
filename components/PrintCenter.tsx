import React, { useState } from 'react';
import { AppData, PrintSettings } from '../types';
import { 
  printCommitteeReceipt, 
  printCommitteeHandover,
  printAbsenceSorting
} from '../services/printService';
import { 
  Printer, Settings, FileText, CheckCircle, 
  FileCheck, ClipboardList, ShieldAlert, Calendar
} from 'lucide-react';

interface PrintCenterProps {
  data: AppData;
  onUpdateSchool: (field: string, value: string) => void;
}

const PrintCenter: React.FC<PrintCenterProps> = ({ data, onUpdateSchool }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  
  const [settings, setSettings] = useState<PrintSettings>({
    adminName: 'الإدارة العامة للتعليم بمحافظة جدة',
    schoolName: 'ثانوية الأمير عبدالمجيد',
    managerName: data.school.managerName || '', 
    agentName: data.school.agentName || '',
    logoUrl: 'https://up6.cc/2026/02/177116640037762.png',
    doorLabelTitle: 'بطاقة لجنة',
    attendanceTitle: 'كشف مناداة',
    stickerTitle: 'ملصق طاولة',
    showBorder: true,
    colSequence: 'م',
    colSeatId: 'رقم الجلوس',
    colName: 'اسم الطالب',
    colStage: 'المرحلة',
    colPresence: 'توقيع',
    colSignature: 'ملاحظات',
    showColSequence: true,
    showColSeatId: true,
    showColName: true,
    showColStage: true,
    showColPresence: true,
    showColSignature: true,
  });

  const [selectedCommittee, setSelectedCommittee] = useState<string>('');

  const handleSettingChange = (field: keyof PrintSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    if (field === 'schoolName' || field === 'managerName' || field === 'agentName') {
        onUpdateSchool(field === 'schoolName' ? 'name' : field, value);
    }
  };

  // فرز اللجان للقائمة المنسدلة
  const sortedCommittees = [...data.committees].sort((a, b) => 
    parseInt(a.name) - parseInt(b.name)
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fade-in">
      
      {/* ترويسة الصفحة */}
      <div className="bg-gradient-to-r from-[#0e3f51] to-[#258f9d] rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                <Printer className="w-8 h-8 text-yellow-400" />
                مركز الطباعة والتقارير
            </h2>
            <p className="opacity-90 text-lg">إصدار الكشوفات الرسمية والمحاضر بهوية بصرية معتمدة</p>
        </div>
        
        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20 flex flex-col gap-2 min-w-[250px]">
            <label className="text-xs font-bold text-white/80 flex items-center gap-2">
                <Calendar size={14} />
                تاريخ التقارير والكشوفات
            </label>
            <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white text-[#0e3f51] font-bold rounded-lg px-3 py-2 outline-none text-center shadow-lg"
            />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* الإعدادات */}
          <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-gray-500" /> إعدادات الهوية
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">مدير المدرسة</label>
                          <input 
                            type="text" 
                            value={settings.managerName}
                            onChange={(e) => handleSettingChange('managerName', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#258f9d] outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">وكيل الشؤون التعليمية</label>
                          <input 
                            type="text" 
                            value={settings.agentName}
                            onChange={(e) => handleSettingChange('agentName', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#258f9d] outline-none"
                          />
                      </div>
                  </div>
              </div>
          </div>

          {/* التقارير */}
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-lg text-[#0e3f51] mb-4 border-b pb-2">نماذج الكنترول والاستلام</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ReportCard 
                          title="كشف استلام الأوراق من اللجان"
                          desc="جدول عام لجميع اللجان (عدد الأوراق، الحضور، وتوقيع المراقب المستلم آلياً)"
                          icon={ClipboardList}
                          onClick={() => printCommitteeReceipt(data, settings, selectedDate)}
                          color="bg-blue-50 text-blue-700"
                      />
                      <ReportCard 
                          title="كشف فرز ورصد الغياب"
                          desc="كشف آلي بأسماء الطلاب الغائبين فقط حسب التاريخ المحدد"
                          icon={ShieldAlert}
                          onClick={() => printAbsenceSorting(data, settings, selectedDate)} 
                          color="bg-red-50 text-red-700"
                      />
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-lg text-[#0e3f51] mb-4 border-b pb-2 flex justify-between items-center">
                      <span>نماذج اللجان التفصيلية</span>
                      <select 
                        className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 font-normal"
                        value={selectedCommittee}
                        onChange={(e) => setSelectedCommittee(e.target.value)}
                      >
                          <option value="">اختر لجنة محددة...</option>
                          {/* ✅ القائمة المرتبة رقمياً */}
                          {sortedCommittees.map(c => (
                              <option key={c.id} value={c.name}>لجنة {c.name}</option>
                          ))}
                      </select>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ReportCard 
                          title="محضر استلام وتسليم (لجنة)"
                          desc="نموذج تفصيلي يحتوي على المواد وتوقيع المراقبين آلياً"
                          icon={FileCheck}
                          onClick={() => {
                              if(!selectedCommittee) alert('الرجاء اختيار لجنة أولاً');
                              else printCommitteeHandover(data, settings, selectedCommittee, selectedDate);
                          }}
                          color="bg-green-50 text-green-700"
                      />
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

const ReportCard = ({ title, desc, icon: Icon, onClick, color }: any) => (
    <button onClick={onClick} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#258f9d] hover:shadow-md transition-all text-right group w-full bg-white">
        <div className={`p-3 rounded-lg ${color} group-hover:scale-110 transition-transform`}><Icon size={24} /></div>
        <div><h4 className="font-bold text-gray-800 mb-1 group-hover:text-[#0e3f51] transition-colors">{title}</h4><p className="text-xs text-gray-500 leading-relaxed">{desc}</p></div>
    </button>
);

export default PrintCenter;
