// Each policy round prepares a distinct interval. The native time service
// continues to refuse overlapping work; the verifier never rewrites history.
let day = 6
export default async function () {
 const start = new Date(Date.UTC(2026, 0, day++, 10))
 return {values: {time: {start: start.toISOString(), end: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString()}}}
}
