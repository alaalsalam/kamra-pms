"""Polish the stock showcase into a bilingual Arabic/English hotel demo.

Run after ``hotelpms.scripts.seed_demo.execute``. The script is deliberately
idempotent: it updates the same seeded records and only adds gallery/FAQ rows
when they are absent.
"""

import frappe


LEGACY_PROPERTIES = (
	"Al Riwaq Palace | فندق الرِواق",
	"فندق نُزُل الرياض | Nuzul Riyadh Hotel",
)
PROPERTY = "فندق نُزُل الرياض | Nuzul Riyadh Hotel"
BRAND_LOGO = "/assets/hotelpms/hotelpms-logo.svg"
BRAND_BLUE = "#082B5C"

HERO = (
	"https://images.pexels.com/photos/30866709/pexels-photo-30866709/"
	"free-photo-of-luxury-hotel-exterior-architecture-shot.jpeg"
	"?auto=compress&dpr=1&h=1000&w=1800"
)
GALLERY = [
	(HERO, "واجهة فندق نُزُل الرياض | Nuzul Riyadh Hotel exterior"),
	("https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&auto=format&fit=crop&q=86",
	 "البهو الرئيسي | Grand lobby"),
	("https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1600&auto=format&fit=crop&q=86",
	 "جناح بإطلالة على المدينة | City-view suite"),
	("https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&auto=format&fit=crop&q=86",
	 "غرفة ديلوكس | Deluxe room"),
	("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&auto=format&fit=crop&q=86",
	 "مطعم التراس | Terrace restaurant"),
	("https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1600&auto=format&fit=crop&q=86",
	 "السبا والعافية | Spa and wellness"),
]

ROOM_TYPES = {
	"STD": {
		"name": "غرفة نُزُل كلاسيك | Nuzul Classic Room",
		"description": "غرفة هادئة بتصميم معاصر، سرير مريح ومساحة عمل. | A quiet contemporary room with a comfortable bed and workspace.",
		"view": "أفق الرياض | Riyadh Skyline",
		"image": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1400&auto=format&fit=crop&q=86",
		"rates": (650, 590, 150, 75),
	},
	"DLX": {
		"name": "غرفة نُزُل ديلوكس | Nuzul Deluxe Room",
		"description": "مساحة أرحب وإطلالة على المسبح مع جلسة خاصة. | More space, a pool view and a private sitting area.",
		"view": "المسبح | Pool",
		"image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1400&auto=format&fit=crop&q=86",
		"rates": (950, 850, 180, 90),
	},
	"STE": {
		"name": "جناح نُزُل التنفيذي | Nuzul Executive Suite",
		"description": "جناح فاخر بغرفة معيشة مستقلة وخدمة شخصية. | A premium suite with a separate living room and personalised service.",
		"view": "برج المملكة | Kingdom Centre",
		"image": "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1400&auto=format&fit=crop&q=86",
		"rates": (1650, 1500, 250, 125),
	},
}

GUESTS = [
	("أحمد", "الحضرمي", "+967771810101", "Yemeni"),
	("نورا", "القحطاني", "+966508101002", "Saudi Arabian"),
	("Omar", "Haddad", "+962790101003", "Jordanian"),
	("Lina", "Mansour", "+96170101004", "Lebanese"),
	("سالم", "العمري", "+971508101005", "Emirati"),
	("Maya", "Rahman", "+447700900106", "British"),
	("خالد", "السقاف", "+967733810107", "Yemeni"),
	("Sarah", "Johnson", "+12025550108", "American"),
	("ريم", "الشميري", "+966558101009", "Yemeni"),
	("Daniel", "Lee", "+6591010110", "Singaporean"),
]

EXPERIENCE_NAMES = {
	"Sunrise Safari": "سفاري الشروق | Sunrise Safari",
	"Candlelight Romantic Dinner": "عشاء رومانسي على ضوء الشموع | Candlelight Dinner",
	"Ayurvedic Spa Ritual": "طقوس السبا الأيورفيدية | Ayurvedic Spa Ritual",
	"Couple's Spa Retreat": "تجربة سبا لشخصين | Couple's Spa Retreat",
	"Heritage City Walk": "جولة المدينة التراثية | Heritage City Walk",
	"Cooking Class with the Chef": "درس طبخ مع الشيف | Cooking Class with the Chef",
	"Sunset Lake Cruise": "رحلة بحيرة وقت الغروب | Sunset Lake Cruise",
	"Airport Transfer (Sedan)": "توصيل خاص من المطار | Private Airport Transfer",
	"Yoga at Dawn": "يوغا عند الفجر | Yoga at Dawn",
	"In-Room Floral Turndown": "تجهيز الغرفة بالورود | In-Room Floral Turndown",
}

VENUE_NAMES = {
	"Grand Ballroom": "قاعة الدرعية الكبرى | Diriyah Grand Ballroom",
	"Garden Lawn": "حديقة النخيل للمناسبات | Palm Events Garden",
	"Riverside Deck": "تراس سكاي لاين | Skyline Terrace",
	"Boardroom": "قاعة الاجتماعات التنفيذية | Executive Boardroom",
}

EXPERIENCE_PRICES = {
	"Sunrise Safari": 350,
	"Candlelight Romantic Dinner": 480,
	"Ayurvedic Spa Ritual": 320,
	"Couple's Spa Retreat": 590,
	"Heritage City Walk": 120,
	"Cooking Class with the Chef": 250,
	"Sunset Lake Cruise": 280,
	"Airport Transfer (Sedan)": 180,
	"Yoga at Dawn": 90,
	"In-Room Floral Turndown": 150,
}

VENUE_PRICES = {
	"Grand Ballroom": (15000, 2500),
	"Garden Lawn": (12000, 1800),
	"Riverside Deck": (8000, 1400),
	"Boardroom": (3500, 650),
}

OUTLET_NAMES = {
	"The Terrace Restaurant": "مطعم التراس | The Terrace Restaurant",
	"Poolside Bar": "مقهى المسبح | Poolside Café",
	"Chalet": "ردهة نُزُل | Nuzul Lounge",
}

LEGACY_TITLES = {
	("Venue", "Grand Ballroom"): ["قاعة الرِواق الكبرى | Al Riwaq Grand Ballroom"],
	("Venue", "Garden Lawn"): ["حديقة المناسبات | Garden Lawn"],
	("Venue", "Riverside Deck"): ["تراس البحيرة | Lakeside Deck"],
	("POS Outlet", "Chalet"): ["الشاليه"],
}

MENU_NAMES = {
	"Masala Dosa": "شكشوكة نجدية | Najdi Shakshuka",
	"Butter Chicken": "كبسة دجاج ملكية | Royal Chicken Kabsa",
	"Paneer Tikka": "حمص بالشمندر | Beetroot Hummus",
	"Veg Biryani": "أرز صيادية بالخضار | Vegetable Sayadiyah",
	"Gulab Jamun": "تشيز كيك بالتمر | Date Cheesecake",
	"Cold Coffee": "قهوة سعودية باردة | Iced Saudi Coffee",
	"Fresh Lime Soda": "موهيتو ليمون ونعناع | Lemon Mint Mojito",
	"Kingfisher Beer": "كوكتيل رمان فوار | Sparkling Pomegranate",
}

LEGACY_MENU_NAMES = {
	"Masala Dosa": "ماسالا دوسا | Masala Dosa",
	"Butter Chicken": "دجاج بالزبدة | Butter Chicken",
	"Paneer Tikka": "بانير تيكا | Paneer Tikka",
	"Veg Biryani": "برياني خضار | Veg Biryani",
	"Gulab Jamun": "جولاب جامون | Gulab Jamun",
	"Cold Coffee": "قهوة باردة | Cold Coffee",
	"Fresh Lime Soda": "صودا ليمون طازجة | Fresh Lime Soda",
	"Kingfisher Beer": "مشروب شعير | Malt Beverage",
}

MENU_DETAILS = {
	"Masala Dosa": (42, "Breakfast", "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Shakshuka_-_Black_Mocha_2025-03-13.jpg/960px-Shakshuka_-_Black_Mocha_2025-03-13.jpg", "بيض عضوي وطماطم وفلفل محمص مع خبز التنور | Organic eggs, tomato and roasted peppers with tanoor bread."),
	"Butter Chicken": (86, "Main Courses", "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Chicken_Kabsa.jpg/960px-Chicken_Kabsa.jpg", "دجاج متبل وأرز بسمتي وصلصة دقوس | Spiced chicken, basmati rice and house daqqus."),
	"Paneer Tikka": (38, "Starters", "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/Hummus_1.JPG/960px-Hummus_1.JPG", "حمص كريمي بالشمندر وزيت الزيتون | Creamy beetroot hummus with olive oil."),
	"Veg Biryani": (62, "Main Courses", "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Vegetable_rice_image.jpg/960px-Vegetable_rice_image.jpg", "أرز متبل وخضار موسمية محمصة | Spiced rice with roasted seasonal vegetables."),
	"Gulab Jamun": (36, "Desserts", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&auto=format&fit=crop&q=82", "تشيز كيك كريمي بدبس التمر | Creamy cheesecake with date molasses."),
	"Cold Coffee": (26, "Beverages", "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=900&auto=format&fit=crop&q=82", "قهوة باردة بالهيل ولمسة زعفران | Iced coffee with cardamom and saffron."),
	"Fresh Lime Soda": (24, "Mocktails", "https://images.unsplash.com/photo-1556881261-e41e8db21055?w=900&auto=format&fit=crop&q=82", "ليمون طازج ونعناع وصودا | Fresh lime, mint and soda."),
	"Kingfisher Beer": (32, "Mocktails", "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=900&auto=format&fit=crop&q=82", "رمان فوار وإكليل الجبل دون كحول | Sparkling pomegranate and rosemary, alcohol-free."),
}


def _property_name() -> str:
	if frappe.db.exists("Property", PROPERTY):
		return PROPERTY
	for source in LEGACY_PROPERTIES:
		if frappe.db.exists("Property", source):
			frappe.rename_doc("Property", source, PROPERTY, force=True)
			return PROPERTY
	frappe.throw("Run hotelpms.scripts.seed_demo.execute before the Arabic showcase seed.")


def _polish_property(name: str) -> bool:
	doc = frappe.get_doc("Property", name)
	convert_stock_prices = doc.currency != "SAR"
	doc.update({
		"property_name": PROPERTY,
		"legal_name": "شركة نُزُل الضيافة المحدودة | Nuzul Hospitality Co. Ltd.",
		"phone": "+966114008000",
		"email": "reservations@hotelpms.sa",
		"website": "https://hotelpms.yemenfrappe.com/book",
		"address_line": "King Fahd Road, Al Olaya | طريق الملك فهد، حي العليا",
		"city": "Riyadh | الرياض",
		"state": "Riyadh",
		"country": "Saudi Arabia",
		"pincode": "12214",
		"latitude": 24.7117,
		"longitude": 46.6744,
		"timezone": "Asia/Riyadh",
		"currency": "SAR",
		"locale": "ar-SA",
		"gstin": "310123456700003",
		"gst_mode": "Fixed",
		"gst_rate_low": 15,
		"gst_rate_high": 15,
		"security_deposit_amount": 500,
		"checkin_time": "14:00:00",
		"checkout_time": "11:00:00",
		"booking_engine_enabled": 1,
		"booking_payment_mode": "Pay at hotel",
		"brand_accent": BRAND_BLUE,
		"star_category": "5 Star",
		"showcase_description": (
			"ضيافة سعودية عصرية في قلب الرياض، مع غرف راقية ومطاعم وسبا وقاعات "
			"فعاليات متكاملة. | Contemporary Saudi hospitality in central Riyadh, "
			"with refined rooms, dining, spa and complete event spaces."
		),
		"sell_message": (
			"احجز مباشرة لأفضل سعر ومزايا وصول مرنة. | Book direct for our best "
			"available rate and flexible arrival benefits."
		),
		"hero_image": HERO,
		"og_image": HERO,
		"logo_url": BRAND_LOGO,
		"page_slug": "nuzul-riyadh",
		"property_amenities": (
			"واي فاي مجاني | Free Wi-Fi\nمسبح | Swimming Pool\nسبا | Spa\n"
			"مطعم | Restaurant\nخدمة غرف 24 ساعة | 24-hour Room Service\n"
			"مواقف سيارات | Parking\nنقل من مطار الملك خالد | King Khalid Airport Transfer"
		),
		"house_rules": (
			"تسجيل الوصول 2:00 م والمغادرة 11:00 ص. هوية سارية مطلوبة لكل ضيف بالغ. "
			"الهدوء من 10:00 م حتى 7:00 ص. | Check-in 2:00 PM, check-out 11:00 AM. "
			"Valid ID is required for every adult guest. Quiet hours 10:00 PM-7:00 AM."
		),
		"children_policy": (
			"الأطفال دون 6 سنوات يقيمون مجانًا باستخدام الأسرّة الحالية. | Children "
			"under 6 stay free when using existing beds."
		),
		"pets_policy": (
			"تُقبل الحيوانات الأليفة الصغيرة عند الطلب في غرف محددة. | Small pets are "
			"welcome on request in selected rooms."
		),
		"extra_bed_policy": (
			"سرير إضافي متاح حسب مساحة الغرفة. | Rollaway beds are available subject "
			"to room size."
		),
		"driving_directions": (
			"نحو 30 دقيقة من مطار الملك خالد الدولي عبر طريق المطار، والمدخل من طريق الملك فهد. | "
			"Around 30 minutes from King Khalid International Airport; enter from King Fahd Road."
		),
		"meta_title": "فندق نُزُل الرياض | Nuzul Riyadh Hotel",
		"meta_description": (
			"احجز مباشرة في فندق نُزُل الرياض: غرف وأجنحة ومطاعم وسبا وفعاليات. | "
			"Book direct at Nuzul Riyadh Hotel for refined rooms, dining, spa and events."
		),
	})
	doc.set("gallery", [{"url": url, "caption": caption} for url, caption in GALLERY])
	doc.set("faqs", [
		{"question": "ما وقت تسجيل الوصول والمغادرة؟ | What are check-in and check-out times?",
		 "answer": "الوصول من 2:00 م والمغادرة حتى 11:00 ص. | Check-in is from 2:00 PM and check-out is by 11:00 AM."},
		{"question": "هل الإفطار مشمول؟ | Is breakfast included?",
		 "answer": "يشمل الإفطار خطط CP وMAP وAP، ويمكن إضافته لأي حجز. | Breakfast is included in CP, MAP and AP plans and can be added to any stay."},
		{"question": "هل يتوفر نقل من المطار؟ | Is airport transfer available?",
		 "answer": "نعم، سيارة خاصة مع استقبال عند الوصول متاحة بالحجز المسبق. | Yes, a private meet-and-greet sedan is available with advance booking."},
		{"question": "هل يمكن الإلغاء مجانًا؟ | Is free cancellation available?",
		 "answer": "يمكن إلغاء السعر المرن مجانًا حتى 48 ساعة قبل الوصول. | Flexible rates may be cancelled free up to 48 hours before arrival."},
	])
	doc.flags.ignore_validate = True
	doc.save(ignore_permissions=True)
	if frappe.db.exists("Currency", "SAR"):
		frappe.db.set_value("Currency", "SAR", "enabled", 1, update_modified=False)
	return convert_stock_prices


def _polish_room_types(property_name: str):
	for code, values in ROOM_TYPES.items():
		name = frappe.db.get_value(
			"Room Type", {"property": property_name, "room_type_code": code}
		)
		if not name:
			continue
		doc = frappe.get_doc("Room Type", name)
		doc.room_type_name = values["name"]
		doc.description = values["description"]
		doc.room_view = values["view"]
		doc.amenities = (
			"واي فاي | Wi-Fi, تكييف | AC, تلفاز ذكي | Smart TV, "
			"خزنة | Safe, قهوة وشاي | Tea & Coffee"
		)
		base, single, extra_adult, child = values["rates"]
		doc.base_price = base
		doc.single_occupancy_price = single
		doc.extra_adult_price = extra_adult
		doc.child_price = child
		doc.tax_percent = 15
		doc.image = values["image"]
		doc.set("media", [{
			"media_type": "Image", "url": values["image"],
			"caption": values["name"],
		}])
		doc.save(ignore_permissions=True)


def _polish_guests():
	rows = frappe.get_all(
		"Guest", fields=["name"], order_by="creation asc", limit_page_length=len(GUESTS)
	)
	for row, (first, last, phone, nationality) in zip(rows, GUESTS, strict=False):
		doc = frappe.get_doc("Guest", row.name)
		doc.update({
			"first_name": first,
			"last_name": last,
			"phone": phone,
			"email": f"guest.{doc.name[-6:].lower()}@example.com",
			"nationality": nationality,
			"city": "Riyadh",
			"guest_notes": "يفضل طابقًا هادئًا | Prefers a quiet floor" if doc.vip else None,
		})
		doc.save(ignore_permissions=True)


def _rename_titles(doctype: str, field: str, mapping: dict[str, str], property_name: str):
	for source, bilingual in mapping.items():
		name = frappe.db.get_value(
			doctype,
			{"property": property_name, field: ["in", [
				source, bilingual, *LEGACY_TITLES.get((doctype, source), []),
			]]},
		)
		if name:
			frappe.db.set_value(doctype, name, field, bilingual, update_modified=False)


def _polish_content(property_name: str):
	_rename_titles("Experience", "experience_name", EXPERIENCE_NAMES, property_name)
	_rename_titles("Venue", "venue_name", VENUE_NAMES, property_name)
	_rename_titles("POS Outlet", "outlet_name", OUTLET_NAMES, property_name)
	_rename_titles("Menu Item", "item_name", MENU_NAMES, property_name)

	for source, price in EXPERIENCE_PRICES.items():
		name = frappe.db.get_value(
			"Experience", {"property": property_name,
			"experience_name": ["in", [source, EXPERIENCE_NAMES[source]]]},
		)
		if name:
			frappe.db.set_value("Experience", name,
				{"price": price, "gst_rate": 15}, update_modified=False)

	for source, (base, hourly) in VENUE_PRICES.items():
		name = frappe.db.get_value(
			"Venue", {"property": property_name,
			"venue_name": ["in", [source, VENUE_NAMES[source],
				*LEGACY_TITLES.get(("Venue", source), [])]]},
		)
		if name:
			frappe.db.set_value("Venue", name,
				{"base_price": base, "hourly_rate": hourly, "gst_rate": 15}, update_modified=False)

	for source, (price, category, image, description) in MENU_DETAILS.items():
		name = frappe.db.get_value(
			"Menu Item", {"property": property_name,
			"item_name": ["in", [source, MENU_NAMES[source], LEGACY_MENU_NAMES[source]]]},
		)
		if name:
			frappe.db.set_value("Menu Item", name, {
				"item_name": MENU_NAMES[source], "price": price, "category": category,
				"image": image, "description": description, "is_alcohol": 0,
			}, update_modified=False)

	# A menu row must belong to the same property as its outlet. Hide malformed
	# playground rows so test input cannot leak into the polished demo POS.
	for item in frappe.get_all("Menu Item", fields=["name", "property", "outlet"]):
		outlet_property = frappe.db.get_value("POS Outlet", item.outlet, "property")
		if outlet_property and item.property != outlet_property:
			frappe.db.set_value("Menu Item", item.name, "available", 0, update_modified=False)

	# Every taxable Saudi showcase service uses the same standard VAT rate.
	for doctype in (
		"POS Outlet", "Ingredient", "Banquet Menu", "Banquet Service Item",
	):
		for row_name in frappe.get_all(doctype,
			filters={"property": property_name}, pluck="name"):
			frappe.db.set_value(doctype, row_name, "gst_rate", 15,
				update_modified=False)


def _seed_pos_showcase(property_name: str):
	"""Keep the restaurant screen camera-ready with realistic live states."""
	outlet = frappe.db.get_value(
		"POS Outlet", {"property": property_name, "outlet_type": "Restaurant"}, "name"
	)
	if not outlet:
		return
	menu = frappe.get_all(
		"Menu Item", filters={"outlet": outlet, "available": 1},
		fields=["name", "item_name", "price"], order_by="category, item_name"
	)
	if len(menu) < 4:
		return

	def create_if_missing(marker, table_no, status, item_indexes, *, kot_no=None,
			kot_status="New", paid=0, payment_mode=None):
		if frappe.db.exists("POS Order", {
			"property": property_name, "notes": marker,
			"status": ["in", ["Placed", "Confirmed", "Preparing", "Delivered"]],
		}):
			return
		now = frappe.utils.now()
		doc = frappe.get_doc({
			"doctype": "POS Order", "property": property_name, "outlet": outlet,
			"status": status, "source": "Manual", "order_type": "Dine In",
			"table_no": table_no, "guests": 2 if table_no != "F2" else 4,
			"notes": marker, "captain": "pos@hotelpms.local",
			"kot_fired": 1 if kot_no else 0, "kot_no": kot_no,
			"paid": paid, "payment_mode": payment_mode,
			"items": [{
				"menu_item": menu[i].name, "item_name": menu[i].item_name,
				"qty": 1, "rate": menu[i].price, "kot_status": kot_status,
				"fired_at": now if kot_no else None,
				"prepared_at": now if kot_status == "Prepared" else None,
			} for i in item_indexes],
		})
		doc.insert(ignore_permissions=True)

	create_if_missing("HotelPMS demo · pending KOT", "T3", "Confirmed", [0, 1])
	create_if_missing("HotelPMS demo · cooking", "T6", "Preparing", [1, 2],
		kot_no=121, kot_status="Fired")
	create_if_missing("HotelPMS demo · ready", "F2", "Preparing", [2, 3],
		kot_no=122, kot_status="Prepared")
	create_if_missing("HotelPMS demo · paid", "P2", "Delivered", [0, 3],
		kot_no=120, kot_status="Prepared", paid=1, payment_mode="Mada")

	# Make the sample WhatsApp thread visibly bilingual without pretending to
	# contact a real guest or external account.
	messages = frappe.get_all(
		"WhatsApp Message", filters={"property": property_name},
		fields=["name", "direction"], order_by="creation asc",
	)
	copy = [
		"تم تأكيد حجزك في فندق نُزُل الرياض. | Your booking at Nuzul Riyadh Hotel is confirmed.",
		"أكمل تسجيل الوصول المسبق من الرابط الآمن. | Complete pre-check-in using your secure link.",
		"مرحبًا، هل يمكن تسجيل مغادرة متأخر يوم الأحد؟ | Hi, may we have a late checkout on Sunday?",
		"بكل سرور، تم تأكيد المغادرة حتى 2:00 م. | Of course, late checkout until 2:00 PM is confirmed.",
	]
	for row, content in zip(messages, copy, strict=False):
		frappe.db.set_value("WhatsApp Message", row.name, "content", content, update_modified=False)


def _polish_financials(property_name: str, convert_stock_prices: bool):
	"""Make the Saudi demo financially credible and safe to rerun."""
	if convert_stock_prices:
		for row in frappe.get_all("Laundry Rate", filters={"property": property_name},
			fields=["name", "rate", "express_rate"]):
			values = {"rate": max(5, round(float(row.rate or 0) * 0.08))}
			if row.express_rate:
				values["express_rate"] = max(8, round(float(row.express_rate) * 0.08))
			frappe.db.set_value("Laundry Rate", row.name, values, update_modified=False)

	for row in frappe.get_all("Hurdle Rate", filters={"property": property_name},
		fields=["name", "occupancy_from"]):
		frappe.db.set_value("Hurdle Rate", row.name, "min_rate",
			1200 if float(row.occupancy_from or 0) >= 85 else 0,
			update_modified=False)

	# Requote stays from the new SAR room rates. The seed data is internally
	# valid, so normal document validation remains enabled.
	for name in frappe.get_all("Reservation", filters={"property": property_name}, pluck="name"):
		doc = frappe.get_doc("Reservation", name)
		if not doc.room_type:
			continue
		doc.auto_price = 1
		doc.save(ignore_permissions=True)

	# Demo folio room lines are refreshed to the new rate and 15% VAT.
	from hotelpms.folio import _recalculate
	for name in frappe.get_all("Folio", filters={"property": property_name}, pluck="name"):
		doc = frappe.get_doc("Folio", name)
		changed = False
		for charge in doc.charges:
			if charge.charge_type == "Room":
				reservation = charge.reservation or doc.reservation
				room_type = frappe.db.get_value("Reservation", reservation, "room_type") if reservation else None
				rate = frappe.db.get_value("Room Type", room_type, "base_price") if room_type else None
				if rate is not None:
					charge.rate = rate
					charge.amount = float(rate) * float(charge.qty or 1)
			if charge.charge_type not in ("Discount", "Allowance"):
				charge.gst_rate = 15
			else:
				charge.gst_rate = 0
			changed = True
		if changed:
			_recalculate(doc)
			doc.save(ignore_permissions=True)


def _polish_secondary_properties():
	updates = {
		"منتجع نُزُل الدرعية | Nuzul Diriyah Retreat": {
			"property_name": "منتجع نُزُل الدرعية | Nuzul Diriyah Retreat",
			"showcase_description": "منتجع صحراوي خاص للعائلات والمجموعات. | A private desert retreat for families and groups.",
			"hero_image": "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1600&auto=format&fit=crop&q=86",
		},
		"أجنحة نُزُل العليا | Nuzul Olaya Suites": {
			"property_name": "أجنحة نُزُل العليا | Nuzul Olaya Suites",
			"showcase_description": "أجنحة عصرية بخيارات إقامة مرنة. | Contemporary suites with flexible stay options.",
			"hero_image": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1600&auto=format&fit=crop&q=86",
		},
	}
	for name, values in updates.items():
		if not frappe.db.exists("Property", name):
			continue
		doc = frappe.get_doc("Property", name)
		# Keep document names stable because these generic properties are used by
		# the upstream demo seed; their visible title is bilingual.
		doc.update(values)
		# Keep the secondary stock fixtures available to staff for exploration,
		# but do not let /book pick one of them as the public demo hotel.
		doc.booking_engine_enabled = 0
		doc.brand_accent = BRAND_BLUE
		doc.logo_url = BRAND_LOGO
		doc.country = "Saudi Arabia"
		doc.city = "Riyadh | الرياض"
		doc.state = "Riyadh"
		doc.address_line = "Riyadh, Saudi Arabia | الرياض، المملكة العربية السعودية"
		doc.pincode = "12214"
		doc.timezone = "Asia/Riyadh"
		doc.currency = "SAR"
		doc.locale = "ar-SA"
		is_diriyah = "Diriyah" in name
		doc.phone = "+966 11 400 8001" if is_diriyah else "+966 11 400 8002"
		doc.email = "diriyah@hotelpms.sa" if is_diriyah else "olaya@hotelpms.sa"
		doc.gstin = "310123456700003"
		doc.gst_mode = "Fixed"
		doc.gst_rate_low = 15
		doc.gst_rate_high = 15
		doc.save(ignore_permissions=True)
		frappe.db.set_value("Property", name, "property_name", values["property_name"], update_modified=False)

	room_updates = {
		("منتجع نُزُل الدرعية | Nuzul Diriyah Retreat", "STD"): ("غرفة منتجع كلاسيك | Retreat Classic Room", 800),
		("منتجع نُزُل الدرعية | Nuzul Diriyah Retreat", "VILLA"): ("المنتجع بالكامل | Entire Retreat", 4500),
		("أجنحة نُزُل العليا | Nuzul Olaya Suites", "GFNA"): ("استوديو نُزُل | Nuzul Studio", 480),
		("أجنحة نُزُل العليا | Nuzul Olaya Suites", "GFNB"): ("استوديو نُزُل بلس | Nuzul Studio Plus", 520),
		("أجنحة نُزُل العليا | Nuzul Olaya Suites", "TFAC"): ("جناح نُزُل سكاي | Nuzul Sky Suite", 680),
		("أجنحة نُزُل العليا | Nuzul Olaya Suites", "UF2R"): ("جناح عائلي بغرفتين | Two-bedroom Family Suite", 950),
	}
	for (property_name, code), (title, rate) in room_updates.items():
		room_type = frappe.db.get_value("Room Type", {
			"property": property_name, "room_type_code": code,
		})
		if not room_type:
			continue
		frappe.db.set_value("Room Type", room_type, {
			"room_type_name": title,
			"base_price": rate,
			"single_occupancy_price": rate,
			"tax_percent": 15,
		}, update_modified=False)


def execute() -> dict:
	name = _property_name()
	convert_stock_prices = _polish_property(name)
	_polish_room_types(name)
	_polish_guests()
	_polish_content(name)
	_seed_pos_showcase(name)
	_polish_financials(name, convert_stock_prices)
	_polish_secondary_properties()
	# meal plans, corporate accounts, travel agents and vouchers
	from hotelpms.scripts import seed_commercial
	seed_commercial.execute(name)
	frappe.db.set_default("currency", "SAR")
	frappe.db.set_default("country", "Saudi Arabia")
	frappe.db.set_default("time_zone", "Asia/Riyadh")
	frappe.db.set_single_value("System Settings", "time_zone", "Asia/Riyadh")
	frappe.db.set_default("hotelpms_demo_mode", "1")
	frappe.db.set_default("hotelpms_demo_language", "ar")
	frappe.db.commit()  # nosemgrep: frappe-manual-commit -- explicit demo fixture command
	frappe.clear_cache()
	result = {
		"property": name,
		"rooms": frappe.db.count("Room", {"property": name}),
		"room_types": frappe.db.count("Room Type", {"property": name}),
		"guests": frappe.db.count("Guest"),
		"reservations": frappe.db.count("Reservation", {"property": name}),
		"language": "Arabic + English",
	}
	print(result)
	return result
