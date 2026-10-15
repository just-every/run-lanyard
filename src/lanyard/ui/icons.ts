// Small native line icons keep empty states legible without image requests.
export function emptyIcon(kind:'calendar'|'document') {
 const shape=kind==='calendar'?'<rect x="10" y="14" width="44" height="40" rx="5"/><path d="M10 24h44"/><path class="icon-accent" d="M20 9v12m24-12v12"/><path d="M20 33h4m8 0h4m8 0h2M20 43h4m8 0h4m8 0h2"/>':'<path d="M17 9h22l12 12v34H17zM39 9v13h12M24 31h20M24 39h20M24 47h13"/>'
 return `<svg class="empty-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`
}
