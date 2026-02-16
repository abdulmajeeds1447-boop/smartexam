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
        
        /* ضبط الهوامش لمنع تداخل الفوتر */
        @page { 
            size: A4; 
            margin: 0; 
            margin-bottom: 2cm; 
        }
        
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

        .content-wrapper { padding: 30px 40px; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { background-color: ${COLORS.tableHeader}; font-weight: 900; padding: 10px; border: 1px solid #000; text-align: center; }
        td { padding: 8px; border: 1px solid #000; text-align: center; font-weight: 500; }
        
        .footer-container {
            background: ${COLORS.footerGradient};
            height: 30px;
            width: 100%;
            position: fixed;
            bottom: 0;
            left: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 10px;
            border-top-left-radius: 20px;
            z-index: 1000;
        }

        .signatures { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-block { text-align: center; width: 30%; }
        .sig-title { font-weight: bold; margin-bottom: 40px; font-size: 14px; }
        .sig-line { border-bottom: 1px dashed #000; width: 80%; margin: 0 auto; }
        
        .grade-section { margin-bottom: 30px; page-break-inside: avoid; }
        .period-header { background-color: #374151; color: white; padding: 10px; font-weight: bold; margin-top: 20px; border-radius: 8px; text-align: center; margin-bottom: 10px; }
        
        @media print { 
            .page-break { page-break-before: always; } 
            .no-break { page-break-inside: avoid; }
        }
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

// --- دالة: كشف استلام الأوراق (مقسم حسب الفترات + حسابات حية) ---
export const printCommitteeReceipt = (data: AppData, settings: PrintSettings, date: string) => {
  let content = '';
  
  const rawExams = (data as any).rawExams || [];
  const teachersList = (data as any).teachers || [];

  // فلترة اختبارات اليوم
  const todaysExams = rawExams.filter((e: any) => e.date === date);

  if (todaysExams.length === 0) {
      alert('لا توجد اختبارات مسجلة في هذا التاريخ!');
      return;
  }

  // تقسيم حسب الفترات
  const periodsMap: Record<string, any[]> = {};
  todaysExams.forEach((exam: any) => {
      const periodName = exam.period || 'فترة عامة';
      if (!periodsMap[periodName]) periodsMap[periodName] = [];
      periodsMap[periodName].push(exam);
  });

  // ترتيب الفترات وبناء الجداول
  Object.keys(periodsMap).sort().forEach((periodName, pIdx) => {
      // صفحة جديدة لكل فترة
      if (pIdx > 0) content += `<div class="page-break"></div>`;

      content += `<div class="period-header">${periodName}</div>`;
      
      content += `
        <table>
            <thead>
                <tr>
                    <th width="5%">م</th>
                    <th width="8%">اللجنة</th>
                    <th width="15%">المقر</th>
                    <th width="20%">المادة</th>
                    <th width="10%">المسجلين</th>
                    <th width="10%">الغياب</th>
                    <th width="10%">الحضور الفعلي</th>
                    <th width="22%">اسم وتوقيع المستلم</th>
                </tr>
            </thead>
            <tbody>
      `;

      const examsInPeriod = periodsMap[periodName];
      const committeeNumbers = [...new Set(examsInPeriod.map((e: any) => e.committeeNumber))]
          .sort((a: any, b: any) => parseInt(a) - parseInt(b));

      committeeNumbers.forEach((commNum: any, index) => {
          const commExams = examsInPeriod.filter((e: any) => e.committeeNumber === commNum);
          
          let totalRegistered = 0;
          let totalAbsent = 0;
          const subjectsSet = new Set<string>();
          const teacherNamesSet = new Set<string>();
          let location = '';

          commExams.forEach((exam: any) => {
              totalRegistered += exam.students.length;
              totalAbsent += exam.attendance.filter((a: any) => a.status === AttendanceStatus.ABSENT).length;
              
              // تنظيف أسماء المواد
              const cleanSubject = exam.subject.split('+').map((s: string) => s.trim()).join(' + ');
              subjectsSet.add(cleanSubject);
              
              if (exam.location) location = exam.location;

              // البحث عن اسم المعلم
              if (exam.teacherId) {
                  const teacherObj = teachersList.find((t: any) => t.id === exam.teacherId || t.phone === exam.teacherId);
                  teacherNamesSet.add(teacherObj ? teacherObj.name : exam.teacherId);
              }
          });

          const actualPresent = totalRegistered - totalAbsent;
          const finalSubjects = Array.from(subjectsSet).join(' + '); 
          const finalTeachers = Array.from(teacherNamesSet).join(' / ');

          content += `
            <tr style="height: 45px;">
                <td>${index + 1}</td>
                <td style="font-size: 16px; font-weight: bold;">${commNum}</td>
                <td>${location}</td>
                <td style="font-size: 11px;">${finalSubjects}</td>
                <td>${totalRegistered}</td>
                <td style="color: red; font-weight: bold;">${totalAbsent}</td>
                <td style="color: green; font-weight: 900; font-size: 14px;">${actualPresent}</td>
                <td style="font-family: 'Tajawal'; font-weight:bold; color: #0e3f51; font-size: 11px;">${finalTeachers}</td> 
            </tr>`;
      });

      content += `</tbody></table>`;
  });
  
  const popup = window.open('', '_blank');
  if (popup) {
    popup.document.write(createPrintPage('كشف استلام أوراق الإجابة', content, { ...settings, date }));
    popup.document.close();
  }
};

// --- دالة: كشف فرز ورصد الغياب ---
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

        // ترتيب المراحل
        Object.keys(groupedByGrade).sort().forEach((grade, idx) => {
            content += `
                <div class="grade-section" style="${idx > 0 ? 'margin-top: 40px;' : ''}">
                    <div style="background: #eee; padding: 8px; font-weight: bold; border: 1px solid #000; border-bottom: none; width: fit-content; border-top-left-radius: 5px; border-top-right-radius: 5px;">
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

// --- دالة: محضر تسليم واستلام (لجنة) ---
export const printCommitteeHandover = (data: AppData, settings: PrintSettings, committeeId: string, date: string) => {
    const committee = data.committees.find(c => c.name === committeeId || String(c.id) === committeeId);
    if (!committee) return;

    const rawExams = (data as any).rawExams || [];
    const examsInCommittee = rawExams.filter((e: any) => e.committeeNumber === committee.name && e.date === date);
    
    const teachersList = (data as any).teachers || [];
    const teacherNames = [...new Set(examsInCommittee.map((e: any) => {
        if (!e.teacherId) return '';
        const t = teachersList.find((teach: any) => teach.id === e.teacherId || teach.phone === e.teacherId);
        return t ? t.name : e.teacherId;
    }).filter(Boolean))];

    let content = `
        <div style="border: 2px solid #000; padding: 15px; margin-bottom: 20px; background: #f9f9f9;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                <div>رقم اللجنة: <span style="font-size: 20px;">${committee.name}</span></div>
                <div>المقر: ${committee.location}</div>
            </div>
        </div>
        <table>
            <thead><tr><th width="25%">الصف</th><th width="30%">المادة</th><th width="10%">المسجلين</th><th width="10%">حضور فعلي</th><th width="25%">توقيع المراقب</th></tr></thead>
            <tbody>
    `;
    
    const gradesInComm = [...new Set(examsInCommittee.flatMap((e: any) => e.grades))];
    const getWeight = (s: string) => { if(s.includes('أول')) return 1; if(s.includes('ثاني')) return 2; return 3; };
    gradesInComm.sort((a: any, b: any) => getWeight(a) - getWeight(b));

    gradesInComm.forEach((grade: any) => {
        const exam = examsInCommittee.find((e: any) => e.grades.includes(grade));
        const subject = exam ? exam.subject : '';
        const studentsInGrade = exam ? exam.students.filter((s: any) => s.grade === grade) : [];
        const total = studentsInGrade.length;
        
        const absents = exam ? exam.attendance.filter((a: any) => 
            studentsInGrade.some((s: any) => s.id === a.studentId) && a.status === AttendanceStatus.ABSENT
        ).length : 0;
        const actualPresence = total - absents;

        content += `<tr style="height: 60px;">
            <td style="font-weight: bold;">${grade}</td>
            <td>${subject}</td>
            <td>${total}</td>
            <td style="font-weight:bold;">${actualPresence}</td>
            <td></td>
        </tr>`;
    });
    content += `</tbody></table>`;

    content += `<div style="margin-top: 40px;"><h3>أسماء الملاحظين:</h3><table style="width: 60%;"><tr><th width="10%">م</th><th>اسم المعلم</th><th>التوقيع</th></tr>`;
    
    if (teacherNames.length > 0) {
        teacherNames.forEach((name: any, idx: number) => {
            content += `<tr><td>${idx + 1}</td><td>${name}</td><td></td></tr>`;
        });
    } else {
        content += `<tr><td>1</td><td></td><td></td></tr><tr><td>2</td><td></td><td></td></tr>`;
    }
    content += `</table></div>`;
    
    const popup = window.open('', '_blank');
    if (popup) {
        popup.document.write(createPrintPage(`محضر تسليم واستلام - لجنة ${committee.name}`, content, { ...settings, date }));
        popup.document.close();
    }
};
