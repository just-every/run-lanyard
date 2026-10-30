// Keep people and the original owner claim so approvals and import journals keep
// their authors. Sessions, links, provider credentials and the outbox never travel.
export default {
  product: 'workforce/lanyard',
  buckets: { FILES: { prefix: 'logbook/', objectReferences: { table: 'l_log_files', keyColumn: 'object_key' } } },
  includeTables: ['oa_operators', 'oa_bootstrap', 'oa_invitation_cancellations'],
  excludeTables: ['l_calendar_feeds','l_partner_keys','bs_%','agent_door_state','agent_door_agents','agent_door_approvals','agent_door_reviews','agent_door_usage','l_report_approvals','l_agent_keys', 'l_clock_browsers','l_kiosk_devices','l_kiosk_pins','l_kiosk_sessions','l_kiosk_attempts'],
  replaceableTables: ['l_meta'],
  requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'INSTALLATION_KEY', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
}
