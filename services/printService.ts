import { AppData, PrintSettings, AttendanceStatus } from '../types';

const COLORS = {
  headerBg: '#0e3f51',
  footerGradient: 'linear-gradient(90deg, #258f9d 0%, #0e3f51 100%)',
  tableHeader: '#eef2f3',
  border: '#000000'
};

const createPrintPage = (title: string, content: string, settings: PrintSettings) => {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        @page { size: A4; margin: 0; }
        body { margin: 0; font-family: 'Tajawal', sans-serif; -webkit-print-color-adjust: exact; background: white; }
        .header-container { background-color: ${COLORS.headerBg}; color: white; padding: 15px 40px; height: 140px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #258f9d; position: relative; overflow: hidden; }
        .header-curve { position: absolute; bottom: -20px; left: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; }
        .school-info { text-align: right; z-index: 10; }
        .school-info h1 { margin: 0; font-size: 18px; font-weight: 900; line-height: 1.5; }
        .school-info h2 { margin: 0; font-size: 14px; font-weight: 400; opacity: 0.9; }
        .ministry-logo { text-align: left; z-index: 10; }
        .ministry-logo img { height: 100px; filter: brightness(0) invert(1); }
        .center-title { text-align: center; flex-grow: 1; z-index: 10; }
        .center-title h1 { font-size: 24px; font-weight: 900; border: 2px solid rgba(255,255,255,0.3); padding: 10px 30px; border-radius: 50px; display: inline-block; background: rgba(0,0,0,0.1); }
        .content-wrapper { padding: 30px 40px; min-height: 23cm; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background-color: ${COLORS.tableHeader}; font-weight: 900; padding: 10px; border: 1px solid #000; text-align: center; }
        td { padding: 8px; border: 1px solid #000; text-align: center; font-weight: 500; }
        .footer-container { background: ${COLORS.footerGradient}; height: 40px; width: 100%; position: fixed; bottom: 0; left: 0; display: flex; justify-content: center; align-items: center; color: white; font-size: 10px; border-top-left-radius: 20px; }
        .signatures { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-block { text-align: center; width: 30%; }
        .sig-title { font-weight: bold; margin-bottom: 40px; font-size: 14px; }
        .sig-line { border-bottom: 1px dashed #000; width: 80%; margin: 0 auto; }
        
        /* إزالة الفواصل الإجبارية واستبدالها بمسافات */
        .grade-section { margin-bottom: 30px; page-break-inside: avoid; }
        
        @media print { .page-break { page-break-before: always; } }
      </style>
    </head>
    <body>
      <div class="header-container">
         <div class="header-curve"></div>
         <div class="school-info"><h1>المملكة العربية السعودية</h1><h1>وزارة التعليم</h1><h2>الإدارة العامة للتعليم بمحافظة جدة</h2><h2>${settings.schoolName}</h2></div>
         <div class="center-title"><h1>${title}</h1></div>
         <div class="ministry-logo"><img src="${settings.logoUrl}" alt="وزارة التعليم"></div>
      </div>
      <div class="content-wrapper">
         <div style="text-align:center; font-weight:bold; margin-bottom:20px;">التاريخ: ${settings.date || new Date().toLocaleDateString('en-CA')}</div>
         ${content}
         <div class="signatures">
            <div class="sig-block"><div class="sig-title">مسؤول الكنترول</div><div class="sig-line"></div></div>
            <div class="sig-block"><div class="sig-title">وكيل الشؤون التعليمية</div><div class="sig-title">${settings.agentName}</div><div class="sig-line"></div></div>
            <div class="sig-block"><div class="sig-title">مدير المدرسة</div><div class="sig-title">${settings.managerName}</div><div class="sig-line"></div></div>
         </div>
      </div>
      <div class="footer-container">نظام الاختبارات الذكي - ثانوية الأمير عبدالمجيد</div>
    </body>
    </html>
  `;
};

// --- كشف استلام الأوراق (عام) ---
export const printCommitteeReceipt = (data: AppData, settings: PrintSettings, date: string) => {
  let content = `
    <table>
        <thead>
            <tr>
                <th width="5%">م</th>
                <th width="10%">رقم اللجنة</th>
                <th width="15%">المقر</th>
                <th width="30%">المادة / الصف</th>
                <th width="10%">العدد</th>
                <th width="10%">الأوراق</th>
                <th width="20%">توقيع المستلم</th>
            </tr>
        </thead>
        <tbody>
  `;

  const sortedCommittees = [...data.committees].sort((a, b) => parseInt(a.name) - parseInt(b.name));
  
  sortedCommittees.forEach((comm, index) => {
      // ✅ الآن هذا السطر سيعمل لأننا ملأنا counts في App.tsx
      const totalStudents = Object.values(comm.counts || {}).reduce((a, b) => a + b, 0);
      
      content += `
        <tr style="height: 50px;">
            <td>${index + 1}</td>
            <td style="font-size: 16px; font-weight: bold;">${comm.name}</td>
            <td>${comm.location}</td>
            <td></td> 
            <td style="font-weight:900; font-size:14px;">${totalStudents}</td>
            <td></td> <td></td> 
        </tr>`;
  });
  content += `</tbody></table>`;
  
  const popup = window.open('', '_blank');
  if (popup) {
    popup.document.write(createPrintPage('كشف استلام أوراق الإجابة', content, { ...settings, date }));
    popup.document.close();
  }
};

// --- كشف فرز الغياب (المدمج في ورقة واحدة) ---
export const printAbsenceSorting = (data: AppData, settings: PrintSettings, date: string) => {
    let content = '';
    const exams = (data as any).rawExams || [];
    
    const absentStudents = exams
        .filter((e: any) => e.date === date)
        .flatMap((e: any) => e.students.filter((s: any) => {
            const record = e.attendance.find((a: any) => a.studentId === s.id);
            return record?.status === AttendanceStatus.ABSENT;
        }).map((s: any) => ({ ...s, examSubject: e.subject, committee: e.committeeNumber })));

    if (absentStudents.length === 0) {
        content = `<div style="text-align:center; padding:50px; font-size:18px;">لا يوجد طلاب غائبين مسجلين بتاريخ ${date}</div>`;
    } else {
        const groupedByGrade: any = {};
        absentStudents.forEach((s: any) => {
            if(!groupedByGrade[s.grade]) groupedByGrade[s.grade] = [];
            groupedByGrade[s.grade].push(s);
        });

        // ترتيب المراحل لضمان الظهور: أول، ثاني، ثالث
        const sortedGrades = Object.keys(groupedByGrade).sort(); 

        sortedGrades.forEach((grade, idx) => {
            // ⛔ حذفنا <div class="page-break"></div>
            // ✅ استبدلناه بـ div له هامش علوي فقط لفصل الجداول بصرياً
            
            content += `
                <div class="grade-section" style="${idx > 0 ? 'margin-top: 40px;' : ''}">
                    <div style="background: #eee; padding: 8px; font-weight: bold; font-size: 14px; border: 1px solid #000; border-bottom: none; width: fit-content; border-top-left-radius: 5px; border-top-right-radius: 5px;">
                        المرحلة: ${grade}
                    </div>
                    <table style="margin-top:0;">
                        <thead>
                            <tr>
                                <th width="5%">م</th>
                                <th width="15%">رقم الجلوس</th>
                                <th width="30%">اسم الطالب</th>
                                <th width="10%">رقم اللجنة</th>
                                <th width="20%">المادة</th>
                                <th width="20%">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            groupedByGrade[grade].forEach((student: any, i: number) => {
                const cleanSubject = [...new Set(student.examSubject.split('+').map((s: string) => s.trim()))].join(' + ');
                
                content += `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${student.seatNumber}</td>
                        <td style="text-align:right; padding-right:10px;">${student.name}</td>
                        <td>${student.committee}</td>
                        <td>${cleanSubject}</td>
                        <td></td>
                    </tr>
                `;
            });
            content += `</tbody></table></div>`;
        });
    }

    const popup = window.open('', '_blank');
    if (popup) {
        popup.document.write(createPrintPage('كشف فرز ورصد الغياب الفعلي', content, { ...settings, date }));
        popup.document.close();
    }
};

export const printCommitteeHandover = (data: AppData, settings: PrintSettings, committeeId: string, date: string) => {
    const committee = data.committees.find(c => c.name === committeeId || String(c.id) === committeeId);
    if (!committee) return;

    let content = `
        <div style="border: 2px solid #000; padding: 15px; margin-bottom: 20px; background: #f9f9f9;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                <div>رقم اللجنة: <span style="font-size: 20px;">${committee.name}</span></div>
                <div>المقر: ${committee.location}</div>
            </div>
        </div>
        <table>
            <thead>
                <tr><th width="30%">الصف</th><th width="30%">المادة</th><th width="10%">العدد</th><th width="15%">وقت الاستلام</th><th width="15%">توقيع</th></tr>
            </thead>
            <tbody>
    `;
    data.stages.forEach(stage => {
        // ✅ الآن هذا سيقرأ القيمة الصحيحة
        const count = committee.counts[stage.id] || 0;
        
        // عرض الصف حتى لو العدد 0 إذا أردت، أو إخفاؤه (الوضع الحالي يخفيه إذا 0)
        // لضمان ظهور الجدول دائماً، يمكنك إزالة شرط if(count > 0)
        content += `<tr style="height: 60px;"><td style="font-weight: bold;">${stage.name}</td><td></td><td>${count > 0 ? count : ''}</td><td></td><td></td></tr>`;
    });
    content += `</tbody></table>`;
    
    const popup = window.open('', '_blank');
    if (popup) {
        popup.document.write(createPrintPage(`محضر تسليم واستلام - لجنة ${committee.name}`, content, { ...settings, date }));
        popup.document.close();
    }
};
