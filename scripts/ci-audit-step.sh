#!/usr/bin/env bash
# الخطوة ٢ (برنامج تصحيح ما بعد المسح لPR #316 — 2026-10-06): خطوة تدقيق
# التبعيات في CI بإعادة محاولة محدودة — المنطق مستخرج إلى هذا الملف ليكون
# قابلًا للاختبار الانحداري (scripts/ci-audit-step.test.mjs) بدل نص مضمن
# في ci.yml لا يمكن إثبات سلوكه.
#
# العلة الجذرية للعيب الأصلي (D8-a في Entry 45): كان `code=$?` يُلتقط بعد
# جملة `if pnpm audit; then …; fi` كاذبة — فيرصد خرج جملة if ذاتها (0) لا
# خرج التدقيق — فتنجح الخطوة حتى عند فشل التدقيق ثلاث مرات. الشاهد:
# تشغيل CI 37328419419 أخضر مع مكتشف high واحد (braces).
#
# الإصلاح: التقاط الخرج داخل فرع else (حيث $? = حالة شرط if نفسه = خرج
# أمر التدقيق)، وخرج دفاعي غير صفري بعد الحلقة (مسار غير قابل للوصول
# عمدًا: المحاولة الأخيرة تخرج دائمًا). لا قناع للفشل عبر tail/أنابيب/
# أغلفة فرعية/أوامر شرطية: خرج أمر التدقيق ينتقل حرفيًا.
#
# الاستخدام (كما في ci.yml):  bash scripts/ci-audit-step.sh
# لأغراض الاختبار:             CI_AUDIT_MAX_ATTEMPTS=2 CI_AUDIT_RETRY_SLEEP=0 \
#                              bash scripts/ci-audit-step.sh <stub...>
# الأمر الافتراضي: node scripts/ci-audit-check.mjs (فاحص التدقيق + سجل
# الاستثناءات الأمنية الموثق — الخطوة ٣). وسائط البيئة:
#   CI_AUDIT_MAX_ATTEMPTS  (افتراضي 3)   CI_AUDIT_RETRY_SLEEP (افتراضي 60 ثانية)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ATTEMPTS="${CI_AUDIT_MAX_ATTEMPTS:-3}"
RETRY_SLEEP_SECONDS="${CI_AUDIT_RETRY_SLEEP:-60}"

if [ "$#" -gt 0 ]; then
  AUDIT_CMD=("$@")
else
  AUDIT_CMD=(node "${SCRIPT_DIR}/ci-audit-check.mjs")
fi

attempt=1
while [ "${attempt}" -le "${MAX_ATTEMPTS}" ]; do
  if "${AUDIT_CMD[@]}"; then
    echo "audit passed on attempt ${attempt}"
    exit 0
  else
    code=$?
    echo "audit attempt ${attempt} failed (exit ${code})"
    if [ "${attempt}" -eq "${MAX_ATTEMPTS}" ]; then
      echo "::error::dependency audit failed ${MAX_ATTEMPTS} times (last exit ${code}) — treat as a real finding unless https://status.npmjs.org reports an outage"
      exit "${code}"
    fi
    echo "waiting ${RETRY_SLEEP_SECONDS}s before retry (known registry endpoint outages: PRs #150/#151/#152)"
    sleep "${RETRY_SLEEP_SECONDS}"
  fi
  attempt=$((attempt + 1))
done

# مسار دفاعي غير قابل للوصول عندما MAX_ATTEMPTS >= 1 (المحاولة الأخيرة تخرج
# دائمًا أعلاه) — وجوده يمنع أي نجاح عبر سقوط الحلقة مستقبلًا.
echo "::error::audit retry loop exhausted without an exit — defensive failure"
exit 1
