import frappe


def execute():
	"""log_action used to stuff the session user into agent_name when no
	agent was given, which made every human look like an agent in the
	ledger. Move user-looking values to actor and clear agent_name; the
	MCP service account becomes the "HotelPMS Agent"."""
	if not frappe.db.table_exists("Agent Action Log"):
		return
	frappe.db.sql("""
		UPDATE `tabAgent Action Log`
		SET agent_name = 'HotelPMS Agent'
		WHERE agent_name = 'agent@hotelpms.local'
	""")
	frappe.db.sql("""
		UPDATE `tabAgent Action Log`
		SET actor = COALESCE(actor, agent_name), agent_name = NULL
		WHERE agent_name = 'Administrator' OR agent_name LIKE '%@%'
	""")
