import { createMailSender } from './modules/mail/index.mjs'

// Base validates and silently suppresses development mail; its auth module
// accepts that result in local dev and hosted demos.
export function operatorMail(env) {
 // Mail off (MAIL_PROVIDER=none): no sender, so email sign-in and invitations refuse
 // as mail_unavailable and the owner signs in with `rer signin`.
 if (!env.MAIL_PROVIDER || env.MAIL_PROVIDER === 'none') return undefined
 return {
  send(message) {
   if (env.MAIL_PROVIDER === 'development' && env.AUTH_LOCAL !== 'true' && env.RER_DEMO !== '1') throw new Error('mail_unavailable')
   return createMailSender({ provider: env.MAIL_PROVIDER, mode: env.MAIL_PROVIDER === 'development' ? 'development' : 'production',
    ...(env.MAIL_PROVIDER === 'development' ? {} : { apiKey: env.MAIL_API_KEY }),
    ...(env.MAIL_PROVIDER === 'rer' ? { relayUrl: env.MAIL_RELAY_URL } : {}),
    ...(env.MAIL_PROVIDER === 'cloudflare' ? { accountId: env.MAIL_ACCOUNT_ID } : {}),
   }).send(message)
  },
 }
}
