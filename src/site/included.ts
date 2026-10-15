const icons = {
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2ZM17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v2h-3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  journal: '<path d="M11 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8l5 5v3M13 3v5h5M7 11h5m-5 4h3"/><circle cx="17" cy="17" r="5"/><path d="M17 14v3l2 1"/>',
  deactivate: '<circle cx="9" cy="7" r="4"/><path d="M12 21H3v-2a6 6 0 0 1 9-5"/><circle cx="18" cy="18" r="4"/><path d="M16 18h4"/>',
}

export function includedFeatures(): string {
  const features: [keyof typeof icons, string][] = [
    ['people', 'Owner, manager and staff roles'], ['calendar', 'Leave requests'], ['globe', 'Australian venue timezones'],
    ['download', 'Export and restore'], ['journal', 'Import journal with undo'], ['deactivate', 'Deactivate staff instantly'],
  ]
  return `<section id="included" class="included site-width" aria-labelledby="included-heading"><h2 id="included-heading">Also included</h2><ul>${features.map(([icon, label]) => `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon]}</svg><span>${label}</span></li>`).join('')}</ul></section>`
}
