# مراجعة أفضل أنظمة PMS عالميًا — وما نأخذه لـ HotelPMS

مراجعة موجهة للتصميم (لا للمزايا التجارية) لأفضل الأنظمة تقييمًا في HotelTechAwards وسوق الفنادق المستقلة، والغرض: استخلاص أنماط تجربة المستخدم التي جعلتها الأفضل، وتحويلها إلى قرارات ملموسة في HotelPMS v2.

## 1) خلاصة كل نظام

### Mews — الأفضل تصميمًا (Best PMS · HotelTechAwards 2024/2025/2026)
فلسفتهم المعلنة: «التصميم الجيد يخدم الوظيفة؛ الجمال ينشأ من السلاسة» و«كشف التعقيد عند الطلب بدل إغراق المستخدم به». أبرز ما يميز الواجهة:
- **الجدول الزمني الموحد Unified Timeline** هو الشاشة الأم للاستقبال — لا لوحة إحصاءات جامدة.
- **نافذة التفاصيل الذكية Smart Detail Panel:** فتح أي حجز/ضيف في لوح جانبي فوق السياق الحالي — التنقل بين الصفحات شبه معدوم.
- بحث سياقي يقود النظام (اكتب اسمًا/غرفة/رقمًا ونفّذ من النتائج).
- أتمتة تُزيل شاشات كاملة (لا Night Audit يدوي؛ مغادرة جماعية للفواتير الصفرية).
- لغة بصرية: أبيض هادئ، كثافة محسوبة، لون واحد قائد، عناوين كبيرة واثقة.

### Cloudbeds — الأسهل تعلمًا (سهولة 4.6/5 للفنادق المستقلة)
- لوحة رئيسية = **قائمة عمل اليوم** (وصول/مغادرة/طلبات) قبل أي رسم بياني.
- بطاقات ودّية بمساحات بيضاء سخية وأيقونات مؤنسنة — إحساس «منتج استهلاكي» لا «نظام إداري».
- Insights 2026: بناء التقارير داخل سياق العمل بفلاتر مبسطة — لا صفحات تقارير معزولة.

### Apaleo — الأنظف بنية (API-first)
- واجهة مقشّرة حتى الأساس: Room Rack كثيف لكنه أحادي اللون تقريبًا، اللون للحالة فقط.
- كل شيء وحدات قابلة للتركيب — درس لنا: الشاشة تتحمل الإضافة دون إعادة تصميم.

### Stayntouch — الأفضل جوالًا/لمسًا
- تصميم Mobile-first فعليًا: تسجيل وصول كامل من جهاز لوحي بأهداف لمس ضخمة وخطوات قليلة.
- «واجهة سريعة للاستقبال» كقيمة بيع أساسية — السرعة سمة معلنة لا تفصيلة.

### RoomRaccoon + WebRezPro/rezStream (فئة المستقلين)
- RoomRaccoon: الأعلى في «واجهة وتجربة» للفنادق المستقلة — جرأة لونية مرحة مضبوطة.
- أدبيات Tape Chart (WebRezPro/rezStream): السحب والإفلات للنقل والتمديد + **Popover إجراءات سريعة** على الشريط (تسجيل وصول/دفع/نقل/مراسلة) دون فتح الفوليو — معيار الفئة.

## 2) الأنماط المشتركة للأفضل (قائمة التحقق)
1. الشاشة الأولى = **ماذا أفعل الآن** (طابور مهام/جدول زمني)، لا مؤشرات صمّاء.
2. **اللوح الجانبي السياقي** بديل التنقل بين الصفحات في 80% من المهام.
3. بحث عالمي يعمل كموزّع أوامر.
4. Tape chart تفاعلي: سحب، Popover، إنشاء بالنقر على الفراغ.
5. لون واحد قائد على قماشة فاتحة؛ الألوان الأخرى للحالات حصراً.
6. أتمتة تحذف شاشات (إغلاق ليلي صامت، مغادرة جماعية، إسناد غرف تلقائي).
7. لمس/جوال كمواطن أول في الاستقبال والتدبير.
8. كثافة «محترفين»: صفوف مدمجة وأرقام tabular — لكن هرمية من ثلاث طبقات في كل بطاقة.

## 3) قرارات v2 المستمدة مباشرة
| النمط المرجعي | تطبيقه في HotelPMS v2 |
|---|---|
| Mews Unified Timeline | «الرئيسية» تجمع طابور «يحتاج منك الآن» + خط زمن اليوم بالساعات |
| Mews Smart Panel | تفاصيل الحجز تفتح لوحًا جانبيًا فوق القائمة (شاشة الحجوزات v2 تعرضه مفتوحًا) |
| Cloudbeds Friendly Light UI | قماشة عاجية فاتحة، بطاقات بيضاء بأركان 16px، شريط جانبي فاتح |
| Apaleo restraint | لون قائد واحد (تيل زمردي) — البقية حالات فقط |
| WebRezPro Tape | Popover إجراءات على الشريط + صف «بدون غرفة» كصينية سحب |
| Stayntouch touch-first | POS وأزرار الإجراءات 48px+ وخطوات مختزلة |
| إزالة الاحتكاك (Mews) | بطاقة «الإغلاق الليلي يعمل تلقائيًا» بدل شاشة تدقيق يدوية |

## 4) الهوية الجديدة «واحة Oasis» (بديل الكحلي/الذهبي)
الكحلي+الذهبي أصبح قالبًا مكررًا في الضيافة ويميل للثِقل. سوق الـPMS مشبع بالأزرق (Cloudbeds/Protel/Opera) — التمايز يأتي من **تيل زمردي عميق** (طابع واحة/نخيل سعودي عصري، يوحي بالهدوء والثقة) على **قماشة عاجية دافئة**، مع **كهرماني مشمشي** بجرعات دقيقة للانتباه والترحيب. خط **Alexandria** العربي الهندسي الحديث بأوزانه الكاملة يمنح شخصية معاصرة تختلف عن أي منافس. التفاصيل الكاملة في `design-system.md` (v2).

## المصادر
- [Mews — How to design a modern PMS](https://www.mews.com/en/blog/ourdesign)
- [Mews — Best Hotel PMS Software](https://www.mews.com/en/property-management-system)
- [HotelTechReport — Cloudbeds vs Mews](https://hoteltechreport.com/compare/cloudbeds-myfrontdesk-vs-mews)
- [Event Temple — Top 5 Modern PMS Providers 2025](https://www.eventtemple.com/blog/the-top-5-modern-pms-providers-for-hotels-in-2025)
- [Taloflow — Cloudbeds vs Mews](https://www.taloflow.ai/guides/comparisons/cloudbeds-vs-mews-hpms)
- [HotelMinder — Cloudbeds Spring Release 2026](https://www.hotelminder.com/cloudbeds-spring-release-2026)
- [Stayntouch — Hotel Front Desk Software with Fast Interface](https://www.stayntouch.com/articles/hotel-front-desk-software-2026)
- [WebRezPro — The Interactive Tape Chart](https://webrezpro.com/getting-know-webrezpro-interactive-tape-chart/)
- [rezStream — 14 Things Your Hotel Tape Chart Should Do](https://www.rezstream.com/our-blog/14-things-your-hotel-tape-chart-should-do/)
- [HotelTechReport — RoomRaccoon vs Stayntouch](https://hoteltechreport.com/compare/roomraccoon-pms-vs-stayntouch)
