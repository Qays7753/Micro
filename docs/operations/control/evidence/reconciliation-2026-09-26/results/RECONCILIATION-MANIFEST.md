# RECONCILIATION-MANIFEST — 2026-09-26

> رفيق آلي لتقرير `RECONCILIATION-REPORT-AR.md` في الدليل نفسه. يسجل خط الأساس والأوامر والفحوص المنفذة وغير المنفذة وحدود الكتابة. قراءة فقط ما عدا ملفات `results/` الثلاثة هذه.

## 1. خط الأساس

| البند | القيمة |
|---|---|
| المستودع | https://github.com/Qays7753/Micro |
| `origin/main` وقت التنفيذ | `3d5503a20e173500856dbe9946b84a3e475123f6` |
| خط أساس حزمة الأدلة | `c02fb458b1c97d30f67ca7f5a82de82bbc77325d` (والد main الحي — STATE_DRIFT مُسوّى: دمج PR #238 وحده، 13 ملف أدلة، صفر تغيير مصدر) |
| فرع الأدلة | `docs/reconciliation-evidence-20260926` @ `dfffd082807a7183374dca4b4a0ec78a25a41694` (مطابق للتكليف حرفيًا) |
| PR الأدلة | #238 — مدمج (squash) في 2026-09-26T08:30:09Z → merge_commit_sha `3d5503a2` |
| PRs المفتوحة وقت التنفيذ | 0 |
| بيئة العمل | worktree معزول قراءة فقط عند `3d5503a` (`/home/z/my-project/work/recon`)؛ لم تُمس worktrees سابقة |
| التوقيت | 2026-09-26 · Asia/Amman |

## 2. مدخلات الأدلة (تحقق التجزئة)

`sha256sum -c SHA256SUMS.txt` من جذر العمل → **11/11 OK** (الأحد عشر ملفًا: التقرير الشامل + التصويب + 7 TSV + تدقيق المعادلات + تجوال Flash). المصدران المتبقيان في الدليل (SOURCE-MANIFEST.md وSHA256SUMS.txt) غير مجزّأين ذاتيًا. ملفات `evidence/` الـ36 المشار إليها في EVIDENCE-MANIFEST للحزمة 01 غير مرفقة بالحزمة (غير قابلة للتحقق محليًا).

## 3. الأوامر المستخدمة (قراءة فقط)

```bash
git fetch origin --prune
git rev-parse origin/main origin/docs/reconciliation-evidence-20260926
git merge-base --is-ancestor c02fb458... 3d5503a...        # نعم: main تقدم للأمام فقط
git log --oneline c02fb458..3d5503a                        # التزام واحد (حزمة الأدلة)
git diff origin/docs/reconciliation-evidence-20260926 origin/main -- docs/operations/control/evidence/reconciliation-2026-09-26/   # فارغ = مطابقة بايتية
git worktree add --detach /home/z/my-project/work/recon 3d5503a...
sha256sum -c docs/operations/control/evidence/reconciliation-2026-09-26/SHA256SUMS.txt
# GitHub API (token من ملف chmod 600، لم يُطبع أبدًا):
#   GET /repos/Qays7753/Micro/pulls/238        → state=closed, merged=true
#   GET /repos/Qays7753/Micro/pulls?state=open → 0
# فحوص مصدر: sed/grep/Read على الملفات المذكورة في التقرير
```

## 4. الفحوص المركزية المنفذة (كلها قراءة فقط)

| الفحص | النطاق | أبرز النتائج |
|---|---|---|
| SP-UI (21 بندًا) | كل خلافات F1–F23 العرضية/التفاعلية بالكود | F4-B مؤكد (QuickExpenseForm.tsx:317-335)؛ F11 تنقل حقيقي (Orders.tsx:396-398 + اختبار UI)؛ F16-B آلية كاملة (UnsavedChangesGuard.tsx:62-73,91-112)؛ F13-B بنية حاصرة (Tools.tsx:192-213)؛ F8/F22 مردودان بإحصاء المصدر؛ F23 آلية مؤكدة (Setup.tsx:184) |
| SP-FIN (6 بنود) | C1/C2/C7/EQ-136/EQ-033/C10 بالكود والاختبارات والعقود | C1 مؤكد مع اكتشاف أقوى: تحصيل الدين المسجل كاملًا مستحيل عند أجرة > 0؛ C2 مؤكد مع تصويب «الخصم مرتين» إلى ازدواج عرضي بين السطحين؛ C7 مؤكد مع تصويب محرك الاختلاف (directlyLinked:false مثبت في g5Service.ts:222)؛ EQ-136 مؤكد مع إثبات أن الواجهتين تعلنان الافتراض مسبقًا |
| SP-COUNT | عدّ ميكانيكي لكل الجداول والتقاطعات | FINDINGS.tsv: FIX_NOW حرفي 15 (+2 مؤهل)؛ المعادلات: 171 صفًا = 161/5/4/1 (تطابق «أرقام الجرد»؛ الملخص 160+2 يعدّ صيغتي EQ-033)؛ كل أعداد الحزم (40/75/73/26/25/22/313) صحيحة؛ ملف docx غائب (فجوة تسليم) |
| الوكيل الرئيسي | تحققان نقعيان | Statement.tsx:591-593 (سطر المعادلة بثلاثة حدود)؛ EnglishNumberInput.tsx:44,58-60 (pattern+form = آلية الفقاعة الأصلية لـ F6) |

## 5. الفحوص غير المنفذة (عمدًا، مع السبب)

- **تشغيل المتصفح:** لم يلزم — كل خلاف بين التقريرين المتصفحيين كان قابلًا للحسم بالمصدر عند الالتزام المدقق؛ لم تُكتب بيانات ولم يُفتح أي URL في هذه المرحلة.
- **تشغيل الاختبارات:** لم يلزم — الاستشهاد بالاختبارات المجمّدة تحقق وجودها وتسمياتها دون تشغيل.
- **أي كتابة في مستودع التصميم:** ممنوعة ومتفاداة.
- التحقق من SHA فرع التصميم `4af1c50b…`: غير ممكن من مستودع Micro (مستودع منفصل).

## 6. حدود الكتابة في هذه المرحلة

**حالة النشر (محدّثة بعد المحاولة):** حُاول النشر ثلاث مرات بالاعتماد المسموح وحده وفشل بصلاحية 403 على Micro في كل مرة — (1) `git push` عبر HTTPS: «Permission to Qays7753/Micro.git denied to Qays7753»؛ (2) Git Data API `POST /git/blobs`: «Resource not accessible by personal access token»؛ (3) PR API `POST /pulls`: الصليب نفسه. **الخلاصة:** الاعتماد (DOCUMENTS_WRITE_ACCESS_TOKEN) مقروء فقط على Micro (بلا Contents:Write ولا Pull-requests:Write)؛ الفرع التوثيكي جاهز محليًا بملفاته الثلاثة كاملة بانتظار صلاحية نشر — لا يلزم تعديل أي ملف لاستكمال النشر متى مُنحت الصلاحيات. النسخ نفسها منسوخة خارج المستودع للاسترجاع الفوري.

**المسموح حصرًا (والمنفذ محليًا):** إنشاء `docs/operations/control/evidence/reconciliation-2026-09-26/results/` بثلاثة ملفات جديدة (هذا المانيفست + RECONCILIATION-REPORT-AR.md + UNIFIED-FINDINGS.tsv)، على فرع توثيقي مخصص مقتطع من `main` عند `3d5503a20e173500856dbe9946b84a3e475123f6`، مع push وPR واحد إلى main عند توفر الصلاحية — **بلا دمج**.

**الممنوع ولم يحدث:** أي تعديل على مدخلات الأدلة (01/02/03) أو إعادة تسمية أو حذف؛ أي كتابة في src/apps/اختبارات/مكونات/tokens/مسارات/تخزين/مخططات/تصدير/نشر/إعدادات؛ تعديل AGENTS.md أو current-state.md أو العقود أو سجل القرارات أو Tracker/todo؛ إنشاء أو إغلاق عناصر أو claims؛ دمج أي PR؛ كتابة main مباشرة؛ تنظيف/حذف فروع/reset/force-push؛ تنفيذ أي من F1..F23 أو أي تغيير مالي؛ الادعاء بأن توصية نُفذت.

## 7. مخرجات هذه المرحلة

| الملف | الدور |
|---|---|
| `results/RECONCILIATION-REPORT-AR.md` | التقرير الأساسي للمراجعة (8 أقسام) |
| `results/UNIFIED-FINDINGS.tsv` | الجدول الموحد الآلي (26 صفًّا: F1–F23 + تقسيمات F4/F13/F16) بعموده الأربعة عشر |
| `results/RECONCILIATION-MANIFEST.md` | هذا الملف |
