// Keep people and the original owner claim so approvals and import journals keep
// their authors. Sessions, links, provider credentials and the outbox never travel.
export default {
  product: 'workforce/lanyard',
  includeTables: ['oa_operators', 'oa_bootstrap', 'oa_invitation_cancellations'],
  excludeTables: ['l_agent_keys', 'l_clock_browsers'],
  replaceableTables: ['l_meta'],
  requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
}
