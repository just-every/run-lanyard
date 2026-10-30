/* Catalog translation uses literal templates only; interpolated records are never translated. */
(() => {
  function translate(catalog, language, source, values = {}) {
    if (typeof catalog[source] !== 'string' || !catalog[source].trim()) throw new Error('Missing Spanish staff text: ' + source)
    const text = language === 'es' ? catalog[source] : source
    return text.replace(/\{(\w+)\}/g, (_, key) => {
      if (!Object.hasOwn(values, key)) throw new Error('Missing staff text value: ' + key)
      return String(values[key])
    })
  }
  function template(catalog, language, strings, values, collect) {
    const skeleton = strings.map((part, i) => part + (i < values.length ? '\u0001' + i + '\u0002' : '')).join('')
    const phrase = text => {
      const trimmed = text.trim(), refs = []
      const source = trimmed.replace(/\u0001(\d+)\u0002/g, (_, index) => '{' + (refs.push(Number(index)) - 1) + '}')
      if (!/[A-Za-z]/.test(source.replace(/\{\d+\}/g, ''))) return text
      const params = Object.fromEntries(refs.map((index, i) => [i, '\u0001' + index + '\u0002']))
      if (collect) { collect(source); return text }
      const translated = translate(catalog, language, source, params)
      return text.slice(0, text.indexOf(trimmed)) + translated + text.slice(text.indexOf(trimmed) + trimmed.length)
    }
    const result = skeleton.replace(/<[^>]*>|[^<]+/g, part => part.startsWith('<') ? part.replace(/(aria-label|data-tooltip|data-label|placeholder|title|alt)="([^"]*)"/g, (_, name, text) => name + '="' + phrase(text) + '"') : phrase(part))
    return result.replace(/\u0001(\d+)\u0002/g, (_, index) => String(values[Number(index)] ?? ''))
  }
  globalThis.LanyardI18n = {translate, template}
  if (typeof document !== 'undefined') {
    const node = document.querySelector('#staff-catalog')
    if (!node) throw new Error('Staff language catalog is unavailable')
    const catalog = JSON.parse(node.textContent)
    const language = () => document.documentElement.lang.startsWith('es') ? 'es' : 'en'
    globalThis.LanyardStaff = {
      t: (source, values) => translate(catalog, language(), source, values),
      text: (strings, ...values) => template(catalog, language(), strings, values),
      error: source => language() === 'en' ? source : Object.hasOwn(catalog, source) ? translate(catalog, 'es', source) : Object.values(catalog).includes(source) ? source : translate(catalog, 'es', 'This action could not be completed. Review the current records and try again.'),
      setLanguage: value => { document.documentElement.lang = value === 'es' ? 'es-US' : 'en-US' },
    }
  }
})()
