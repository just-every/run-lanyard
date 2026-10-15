// A bounded operator tail for the test host. Log admissions only, never requests or secrets.
import { readFile } from 'node:fs/promises';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (account !== 'b20c0ca9cab0c2b70e13d7cf724b89bd') throw Error('Wrong demo account');
const plan = JSON.parse(await readFile('.rer/demo-host/wrangler.json', 'utf8'));
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${plan.name}/tails`;
const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
const response = await fetch(endpoint, { method: 'POST', headers, body: '{}' });
const result = await response.json();
if (!response.ok || !result.success) throw Error(`Operator tail refused: ${response.status}`);
const tail = result.result;
let socket, admissions = 0;
try {
 socket = new WebSocket(tail.url, 'trace-v1');
 socket.binaryType = 'arraybuffer';
 await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(Error('Tail connection failed')), { once: true }); });
 const since = new Date().toISOString();
 console.log(JSON.stringify({ event: 'demo_observation_started', since }));
 socket.addEventListener('message', event => {
  const value = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
  for (const log of value.logs ?? []) for (const part of log.message ?? []) {
   if (typeof part === 'string' && part.includes('demo_admitted')) { admissions++; console.log(part); }
  }
 });
 await new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, 15 * 60 * 1000);
  socket.addEventListener('close', () => { clearTimeout(timer); reject(Error('Tail closed before observation completed')); }, { once: true });
 });
 console.log(JSON.stringify({ event: 'demo_observation_complete', since, until: new Date().toISOString(), admissions }));
 if (admissions) throw Error('Non-harness visitors were admitted: wait for a clean 15-minute observation before the cohort');
} finally {
 socket?.close();
 const deleted = await fetch(`${endpoint}/${tail.id}`, { method: 'DELETE', headers });
 if (!deleted.ok) throw Error(`Tail cleanup failed: ${deleted.status}`);
}
