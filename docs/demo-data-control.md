# بيانات HotelPMS التجريبية والتحكم بها

هذا هو المرجع التشغيلي الوحيد لبيانات العرض. لا توجد بيانات وهمية مخفية داخل
الواجهة؛ كل ما يظهر يأتي من قاعدة Frappe أو من ملفات البذر المبينة أدناه.

## الجرد الفعلي قبل جولة الإدخال النظيفة — 6 سبتمبر 2026

تم استخراج الأرقام مباشرة من `hotelpms.yemenfrappe.com` بواسطة
`hotelpms.scripts.data_control.inventory`:

| الفئة | عدد السجلات |
|---|---:|
| Master Data رئيسية | 210 |
| معاملات وتشغيل | 109 |
| إعدادات وربط تقني | 1 |
| صفوف فرعية تابعة | 147 |
| **الإجمالي** | **467** |

أبرز الـMaster Data: 3 منشآت، 9 أنواع غرف، 24 غرفة، 25 وحدة قابلة للبيع،
1 خطة سعر، 4 خطط وجبات، موسمان، 4 قسائم، 3 وكلاء سفر، 4 شركات، 10 تجارب،
منفذا مطعم، 8 أصناف قائمة، 19 مكوّنًا، 21 رصيد مخزون، 22 سعر مغسلة، و4 قاعات.

أبرز بيانات التشغيل: 10 ضيوف، 10 حجوزات، 5 ملفات Folio، 4 طلبات POS،
طلبا مغسلة، 10 طلبات خدمة، 3 تسليمات وردية، 21 حركة مخزون، و4 حجوزات قاعات.

لإظهار الجرد الحالي في أي وقت:

```bash
bench --site hotelpms.yemenfrappe.com execute hotelpms.scripts.data_control.inventory
```

## مصادر البيانات

| النطاق | المصدر المعتمد |
|---|---|
| الفندق الرئيسي، الغرف، الضيوف والحجوزات | `hotelpms/scripts/seed_demo.py` |
| المطعم، الصور، الأصناف، المخزون، التجارب والقاعات | `hotelpms/scripts/seed_showcase.py` |
| النصوص والبيانات السعودية ثنائية اللغة | `hotelpms/scripts/seed_arabic_demo.py` |
| حسابات العرض والأدوار وكلمات المرور | `hotelpms/scripts/seed_users.py` |
| الجرد والحذف النظيف المحمي | `hotelpms/scripts/data_control.py` |
| إعادة بناء الديمو كاملًا | `hotelpms/scripts/reset_demo.py` |

## الحذف النظيف

الحذف مسموح فقط لساحة الديمو المعروفة، ويتطلب عبارة تأكيد حرفية. يحذف جميع
مستندات HotelPMS، المرفقات وسجلات اللعب، لكنه يبقي مخطط النظام وحسابات العرض
حتى يمكن تسجيل الدخول وإجراء جولة إدخال يدوية. كما يعطّل إعادة البذر الليلي
حتى لا تعود البيانات الساعة 04:15.

خذ نسخة احتياطية أولًا، ثم نفّذ:

```bash
bench --site hotelpms.yemenfrappe.com backup --with-files
bench --site hotelpms.yemenfrappe.com execute hotelpms.scripts.data_control.purge \
  --kwargs '{"confirm":"PURGE HOTELPMS DEMO DATA"}'
```

تحقق أن كل الفئات أصبحت صفرًا:

```bash
bench --site hotelpms.yemenfrappe.com execute hotelpms.scripts.data_control.inventory
```

لا تستخدم SQL أو تحذف الجداول يدويًا. قيود العلاقات بين الحجوزات والفواتير
والغرف تجعل الحذف الجزئي اليدوي سببًا مباشرًا لبيانات يتيمة وأخطاء لاحقة.

## استعادة بيانات العرض

إذا انتهت جولة الإدخال وأردت إعادة الديمو السعودي الاحترافي:

```bash
bench --site hotelpms.yemenfrappe.com execute hotelpms.scripts.reset_demo.execute
```

هذا يعيد البذر ويعيد تفعيل التنظيف الليلي. دليل الإدخال اليدوي الكامل موجود في
`docs/clean-data-entry-guide-ar.md`.
