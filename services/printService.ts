import { AppData, PrintSettings, Student, Committee } from '../types';

// --- إعدادات التصميم (الكليشة) ---
// تم استخراج الألوان من الصور المرفقة لمحاكاة التصميم بدقة
const COLORS = {
  headerBg: '#0e3f51', // اللون الكحلي الغامق في الهيدر
  footerGradient: 'linear-gradient(90deg, #258f9d 0%, #0e3f51 100%)', // تدرج الفوتر
  tableHeader: '#eef2f3',
  border: '#000000'
};

// دالة مساعدة لإنشاء صفحة HTML للطباعة
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
        
        /* تصميم الكليشة العلوية */
        .header-container {
            background-color: ${COLORS.headerBg};
            color: white;
            padding: 15px 40px;
            height: 140px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 4px solid #258f9d;
            position: relative;
            overflow: hidden;
        }
        
        /* زخرفة بصرية للهيدر */
        .header-curve {
            position: absolute;
            bottom: -20px;
            left: -20px;
            width: 100px;
            height: 100px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
        }

        .school-info { text-align: right; z-index: 10; }
        .school-info h1 { margin: 0; font-size: 18px; font-weight: 900; line-height: 1.5; }
        .school-info h2 { margin: 0; font-size: 14px; font-weight: 400; opacity: 0.9; }
        
        .ministry-logo { text-align: left; z-index: 10; }
        .ministry-logo img { height: 100px; filter: brightness(0) invert(1); } /* تحويل الشعار للأبيض */

        .center-title {
            text-align: center;
            flex-grow: 1;
            z-index: 10;
        }
        .center-title h1 {
            font-size: 24px;
            font-weight: 900;
            border: 2px solid rgba(255,255,255,0.3);
            padding: 10px 30px;
            border-radius: 50px;
            display: inline-block;
            background: rgba(0,0,0,0.1);
        }

        /* المحتوى */
        .content-wrapper { padding: 30px 40px; min-height: 23cm; }

        /* الجداول */
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th { background-color: ${COLORS.tableHeader}; font-weight: 900; padding: 10px; border: 1px solid #000; text-align: center; }
        td { padding: 8px; border: 1px solid #000; text-align: center; font-weight: 500; }
        .text-right { text-align: right; padding-right: 10px; }

        /* الفوتر */
        .footer-container {
            background: ${COLORS.footerGradient};
            height: 40px;
            width: 100%;
            position: fixed;
            bottom: 0;
            left: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 10px;
            border-top-left-radius: 20px; /* محاكاة الانحناء في الصورة */
        }

        /* التواقيع */
        .signatures { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-block { text-align: center; width: 30%; }
        .sig-title { font-weight: bold; margin-bottom: 40px; font-size: 14px; }
        .sig-line { border-bottom: 1px dashed #000; width: 80%; margin: 0 auto; }

        .watermark {
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100px;
            opacity: 0.03;
            font-weight: 900;
            pointer-events: none;
            z-index: 0;
        }

        @media print {
            .no-print { display: none; }
            .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <div class="header-container">
         <div class="header-curve"></div>
         <div class="school-info">
            <h1>المملكة العربية السعودية</h1>
            <h1>وزارة التعليم</h1>
            <h2>الإدارة العامة للتعليم بمحافظة جدة</h2>
            <h2>${settings.schoolName}</h2>
         </div>
         <div class="center-title">
            <h1>${title}</h1>
         </div>
         <div class="ministry-logo">
            <img src="${settings.logoUrl}" alt="وزارة التعليم">
         </div>
      </div>

      <div class="content-wrapper">
         <div class="watermark">نظام الاختبارات</div>
         ${content}
         
         <div class="signatures">
            <div class="sig-block">
                <div class="sig-title">مسؤول الكنترول</div>
                <div class="sig-line"></div>
            </div>
            <div class="sig-block">
                <div class="sig-title">وكيل الشؤون التعليمية</div>
                <div class="sig-title">${settings.agentName}</div>
                <div class="sig-line"></div>
            </div>
            <div class="sig-block">
                <div class="sig-title">مدير المدرسة</div>
                <div class="sig-title">${settings.managerName}</div>
                <div class="sig-line"></div>
            </div>
         </div>
      </div>

      <div class="footer-container">
         نظام الاختبارات الذكي - ثانوية الأمير عبدالمجيد | تم الطباعة بتاريخ: ${new Date().toLocaleDateString('ar-SA')}
      </div>
    </body>
    </html>
  `;
};

// --- 1. تقرير استلام أوراق الإجابة من اللجان (حسب اللجنة) ---
export const printCommitteeReceipt = (data: AppData, settings: PrintSettings) => {
  let content = '';
  
  // تجميع اللجان في صفحة واحدة أو صفحات متعددة
  content += `
    <div style="margin-bottom: 20px; text-align: center; font-weight: bold;">
        الفصل الدراسي: ${data.school.term} | العام الدراسي: ${data.school.year}
    </div>
    
    <table>
        <thead>
            <tr>
                <th width="5%">م</th>
                <th width="10%">رقم اللجنة</th>
                <th width="15%">المقر</th>
                <th width="20%">المادة / الصف</th>
                <th width="10%">عدد الطلاب</th>
                <th width="10%">الحضور</th>
                <th width="10%">الغياب</th>
                <th width="10%">عدد الأوراق</th>
                <th width="10%">توقيع المستلم</th>
            </tr>
        </thead>
        <tbody>
  `;

  // فرز اللجان رقمياً
  const sortedCommittees = [...data.committees].sort((a, b) => 
    parseInt(a.name) - parseInt(b.name)
  );

  sortedCommittees.forEach((comm, index) => {
      // حساب الإحصائيات لهذه اللجنة
      const totalStudents = Object.values(comm.counts).reduce((a, b) => a + b, 0);
      
      // هنا نفترض أن "المواد" تأتي من الجدول أو يتم كتابتها يدوياً
      // سنترك خانة المادة فارغة للكتابة اليدوية أو نملؤها إذا توفر الجدول
      
      content += `
        <tr style="height: 50px;">
            <td>${index + 1}</td>
            <td style="font-size: 16px; font-weight: bold;">${comm.name}</td>
            <td>${comm.location}</td>
            <td></td> <td>${totalStudents}</td>
            <td></td> <td></td> <td></td> <td></td> </tr>
      `;
  });

  content += `
        </tbody>
    </table>
    
    <div style="margin-top: 20px; border: 1px solid #000; padding: 10px; font-size: 11px;">
        <strong>تعليمات للكنترول:</strong>
        <ul>
            <li>يجب التأكد من مطابقة عدد أوراق الإجابة لعدد الطلاب الحاضرين في كشف المناداة.</li>
            <li>يتم رصد الغياب وتدوين أرقام جلوس الغائبين في نموذج مستقل.</li>
            <li>يوقع عضو الكنترول بالاستلام بعد العد والمطابقة.</li>
        </ul>
    </div>
  `;

  const popup = window.open('', '_blank');
  if (popup) {
    popup.document.write(createPrintPage('كشف استلام أوراق الإجابة من اللجان', content, settings));
    popup.document.close();
  }
};

// --- 2. كشف تسليم واستلام لكل لجنة (تفصيلي) ---
export const printCommitteeHandover = (data: AppData, settings: PrintSettings, committeeId: string) => {
    const committee = data.committees.find(c => c.name === committeeId || String(c.id) === committeeId);
    if (!committee) return;

    let content = `
        <div style="border: 2px solid #000; padding: 15px; margin-bottom: 20px; background: #f9f9f9;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                <div>رقم اللجنة: <span style="font-size: 20px;">${committee.name}</span></div>
                <div>المقر: ${committee.location}</div>
                <div>عدد الطلاب الكلي: ${Object.values(committee.counts).reduce((a, b) => a + b, 0)}</div>
            </div>
        </div>
    `;

    // جدول تفصيلي
    content += `
        <table>
            <thead>
                <tr>
                    <th width="30%">الصف الدراسي</th>
                    <th width="30%">المادة</th>
                    <th width="10%">عدد الطلاب</th>
                    <th width="15%">وقت الاستلام</th>
                    <th width="15%">توقيع المراقب</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.stages.forEach(stage => {
        const count = committee.counts[stage.id] || 0;
        if (count > 0) {
            content += `
                <tr style="height: 60px;">
                    <td style="font-weight: bold;">${stage.name}</td>
                    <td></td> <td>${count}</td>
                    <td></td>
                    <td></td>
                </tr>
            `;
        }
    });

    content += `
            </tbody>
        </table>

        <div style="margin-top: 40px;">
            <h3>أسماء الملاحظين:</h3>
            <table style="width: 50%;">
                <tr><th width="10%">م</th><th>اسم المعلم</th><th>التوقيع</th></tr>
                <tr><td>1</td><td></td><td></td></tr>
                <tr><td>2</td><td></td><td></td></tr>
            </table>
        </div>
    `;

    const popup = window.open('', '_blank');
    if (popup) {
        popup.document.write(createPrintPage(`محضر تسليم واستلام - لجنة ${committee.name}`, content, settings));
        popup.document.close();
    }
};

// --- 3. كشف فرز الغياب (حسب المرحلة) ---
export const printAbsenceSorting = (data: AppData, settings: PrintSettings) => {
    let content = '';

    data.stages.forEach((stage, idx) => {
        if (idx > 0) content += `<div class="page-break"></div>`;
        
        content += `
            <div style="background: #eee; padding: 10px; font-weight: bold; font-size: 16px; margin-bottom: 15px; border-radius: 5px;">
                المرحلة: ${stage.name}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th width="5%">م</th>
                        <th width="15%">رقم الجلوس</th>
                        <th width="30%">اسم الطالب</th>
                        <th width="10%">رقم اللجنة</th>
                        <th width="20%">المادة</th>
                        <th width="10%">حالة الغياب</th>
                        <th width="10%">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // هنا ننشئ صفوف فارغة للكتابة، أو نملؤها بالطلاب الغائبين فعلياً إذا توفرت بيانات الغياب
        // سننشئ نموذج فارغ جاهز للتعبئة (20 صف)
        for(let i=1; i<=20; i++) {
            content += `
                <tr style="height: 35px;">
                    <td>${i}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style="font-size: 10px;">(بعذر / بدون)</td>
                    <td></td>
                </tr>
            `;
        }

        content += `
                </tbody>
            </table>
        `;
    });

    const popup = window.open('', '_blank');
    if (popup) {
        popup.document.write(createPrintPage('كشف فرز ورصد الغياب', content, settings));
        popup.document.close();
    }
};

// --- الدوال القديمة (يتم الإبقاء عليها أو تحديثها لتستخدم createPrintPage) ---
// يمكنك استدعاء الدوال القديمة هنا أيضاً لكن بتغليفها في التصميم الجديد