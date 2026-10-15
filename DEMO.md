# Try Lanyard

Run `rer demo`, then open its private `RER_OPEN` link. The demo opens as the
owner with a Brisbane venue team, two rosters, availability and leave, worked
time awaiting approval, and draft and acknowledged payroll batches. Dates are
relative to the visit. Approve hours, publish the draft roster, export reviewed
payroll or invite a teammate. Invitations and sign-in emails succeed silently;
no email leaves the demo. There is no bar or outbox.

`rer demo --stop` deletes this demo's state under `.rer/demo/`. Starting again
creates fresh data and leaves `.wrangler/state` unchanged. Ordinary installations
retain their normal email delivery and approval requirements.

The Run demo workflow uses the `run-demo` environment. Dispatch `test_only` for
the separate test host with published Turnstile test keys, then dispatch it with
`test_only` and `remove` to remove that host. Dispatch without those flags for
production. Each visitor gets a separate container, signed in through Base's
signed owner claim, ending after 60 minutes or 15 minutes idle. Production uses
the environment's real Turnstile keys. Deploys are manual until enabled by the
owner; the homepage link is added only after production readback succeeds.

The runtime and every copied Base module are from `rer-v0.2.22`. See Base's
[adoption guide](https://github.com/runeditrun/base/blob/rer-v0.2.22/default-seed/DEMO.md).
Lanyard has no public-URL check or AI-provider action. Payroll exports are local
CSV downloads, not provider submissions. Identity-provider discovery is a real
read; authentication token exchanges and mail are guarded by Base in demo mode.
