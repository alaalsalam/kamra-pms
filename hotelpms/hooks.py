app_name = "hotelpms"
app_title = "HotelPMS"
app_publisher = "YemenFrappe"
app_description = (
	"HotelPMS hospitality operations — front desk, direct booking, "
	"housekeeping, folios, Saudi VAT billing and hotel intelligence."
)
app_email = "product@hotelpms.sa"
app_license = "agpl-3.0"

# Branding shown in the Desk navbar, app switcher and marketplace listing.
app_logo_url = "/assets/hotelpms/hotelpms-mark.svg"
app_icon = "octicon octicon-home"
app_color = "#082B5C"

# The product UI is the React SPA at /hotelpms; surface it in the Apps launcher
# (and the /apps grid) so users land on it instead of the Desk.
add_to_apps_screen = [
	{
		"name": "hotelpms",
		"logo": "/assets/hotelpms/hotelpms-mark.svg",
		"title": "HotelPMS",
		"route": "/hotelpms",
	}
]

# Automated end-of-day: post room charges, flag no-shows, per property.
scheduler_events = {
	"cron": {
		"0 * * * *": ["hotelpms.channel_manager.push_all_ari"],
		# 03:00 site time, daily - the night audit closes the day
		"0 3 * * *": ["hotelpms.folio.nightly_audit_all_properties"],
		# 09:00 - send self check-in links to upcoming arrivals, for properties
		# that turned the setting on (a plain automation, not an agent)
		"0 9 * * *": ["hotelpms.prearrival.run_prearrival_outreach"],
		# every 15 min - escalate overdue housekeeping tasks up the ladder;
		# also release expired Held / Pending Payment reservations (ADR-006)
		"*/15 * * * *": [
			"hotelpms.housekeeping.escalate_overdue_tasks",
			"hotelpms.reservation_state.expire_holds",
		],
		# 08:30 - the banquet team's morning list: follow-ups gone quiet,
		# tentative holds about to lapse, payments due, event orders missing
		"30 8 * * *": ["hotelpms.banquet.run_banquet_reminders"],
		# 04:15 - wipe the public demo so it cannot be used as a live PMS
		# (no-op unless hotelpms_demo_mode is on and the site is a playground)
		"15 4 * * *": ["hotelpms.scripts.reset_demo.scheduled"],
	},
}

# Apps
# ------------------

required_apps = ["payments"]

# Localization packs by country (regional_overrides style). A future
# hotelpms_uae APP declares its own to claim "United Arab Emirates".
hotelpms_localization = {
	"India": "hotelpms.localization.india",
	"Indonesia": "hotelpms.localization.indonesia",
	"Thailand": "hotelpms.localization.thailand",
	"Malaysia": "hotelpms.localization.malaysia",
	"Saudi Arabia": "hotelpms.localization.saudi_arabia",
	"United Arab Emirates": "hotelpms.localization.uae",
}

# Served single-page app
# -----------------------
# The React front-end mounts at /hotelpms and owns all client-side routes
# (front desk, booking engine, housekeeping, self check-in). The `hotelpms` www
# page (hotelpms/www/hotelpms.py) serves the built shell with the CSRF token
# injected; every deep link falls through to it so browser refresh works.
website_route_rules = [
	{"from_route": "/hotelpms/<path:app_path>", "to_route": "hotelpms"},
]

# Clean, shareable guest URLs redirect into the SPA's routes.
website_redirects = [
	{"source": r"/book$", "target": "/hotelpms/book"},
	{"source": r"/book/(.*)", "target": r"/hotelpms/book/\1"},
	{"source": r"/stay$", "target": "/hotelpms/stay"},
	{"source": r"/stay/(.*)", "target": r"/hotelpms/stay/\1"},
	{"source": r"/hk$", "target": "/hotelpms/hk"},
	{"source": r"/checkin/(.*)", "target": r"/hotelpms/checkin/\1"},
]

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "hotelpms",
# 		"logo": "/assets/hotelpms/logo.png",
# 		"title": "HotelPMS",
# 		"route": "/hotelpms",
# 		"has_permission": "hotelpms.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/hotelpms/css/hotelpms.css"
# app_include_js = "/assets/hotelpms/js/hotelpms.js"

# include js, css files in header of web template
# web_include_css = "/assets/hotelpms/css/hotelpms.css"
# web_include_js = "/assets/hotelpms/js/hotelpms.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "hotelpms/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "hotelpms/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "hotelpms.utils.jinja_methods",
# 	"filters": "hotelpms.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "hotelpms.install.before_install"
after_install = "hotelpms.install.after_install"

# Re-sync the admin tier's Custom DocPerms after every migrate. seed_users
# scopes doctypes to operator roles via Custom DocPerm (which overrides their
# JSON perms), so without this System Manager + Hotel Admin drift out of
# Lost & Found / POS. Idempotent.
after_migrate = ["hotelpms.install.sync_permissions"]

# Uninstallation
# ------------

# before_uninstall = "hotelpms.uninstall.before_uninstall"
# after_uninstall = "hotelpms.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "hotelpms.utils.before_app_install"
# after_app_install = "hotelpms.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "hotelpms.utils.before_app_uninstall"
# after_app_uninstall = "hotelpms.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "hotelpms.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "hotelpms.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	doctype: {
		"on_update": "hotelpms.realtime.notify",
		"after_insert": "hotelpms.realtime.notify",
		"on_trash": "hotelpms.realtime.notify",
	}
	for doctype in ("Reservation", "Folio", "Room", "Housekeeping Task",
	                "Venue Booking", "Group Booking", "POS Order",
	                "Service Ticket", "Agent Action Log")
}

# A reservation booked/modified/cancelled moves availability, so fan the new
# numbers out to the channel manager (Pipeline 1). Runs alongside the realtime
# notify; best-effort and after-commit so it never affects the booking itself.
doc_events["Reservation"] = {
	"after_insert": ["hotelpms.realtime.notify",
	                 "hotelpms.channel_manager.on_reservation_change"],
	"on_update": ["hotelpms.realtime.notify",
	              "hotelpms.channel_manager.on_reservation_change"],
	"on_trash": "hotelpms.realtime.notify",
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"hotelpms.tasks.all"
# 	],
# 	"daily": [
# 		"hotelpms.tasks.daily"
# 	],
# 	"hourly": [
# 		"hotelpms.tasks.hourly"
# 	],
# 	"weekly": [
# 		"hotelpms.tasks.weekly"
# 	],
# 	"monthly": [
# 		"hotelpms.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "hotelpms.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "hotelpms.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "hotelpms.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "hotelpms.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Remote MCP + OAuth live at /mcp and /mcp/oauth/* (not the SPA).
page_renderer = ["hotelpms.mcp_http.MCPPageRenderer"]

# Request Events
# ----------------
# Preserve AioSell's Basic-auth header for the channel webhook before Frappe's
# own api-key auth rejects it (see hotelpms.channels.aiosell.preserve_webhook_auth).
before_request = ["hotelpms.channels.aiosell.preserve_webhook_auth"]
# after_request = ["hotelpms.utils.after_request"]

# Job Events
# ----------
# before_job = ["hotelpms.utils.before_job"]
# after_job = ["hotelpms.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"hotelpms.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
