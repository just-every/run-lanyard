# Try Lanyard

Run `rer demo`, then open its private `RER_OPEN` link. The demo opens as the
owner (Ana Reyes) of Tres Hornos Bakery's Ocean Beach cafe in San Diego, on
Pacific time: the published week with its sales forecast and labor cost, Jess
Morales's Saturday call-out with Luis Ortega's accepted cover waiting for
approval, worked time awaiting approval, an acknowledged payroll batch and next
week's draft. Dates are relative to the visit. Approve the cover, approve hours,
publish next week's draft, export reviewed payroll or invite a teammate. Invitations and sign-in emails succeed silently;
no email leaves the demo. There is no bar or outbox.

`rer demo --stop` deletes this demo's state under `.rer/demo/`. Starting again
creates fresh data and leaves `.wrangler/state` unchanged. Ordinary installations
retain their normal email delivery and approval requirements.

The Run demo workflow uses the `run-demo` environment. Dispatch `test_only` for
the separate test host with published Turnstile test keys, then dispatch it with
`test_only` and `remove` to remove that host. Dispatch without those flags for
production. Each visitor gets their own native Worker Loader isolate with its
own SQLite storage, signed in through Base's signed owner claim, ending after 60
minutes or 15 minutes idle, when that storage is erased. Static files are served
at the edge. Production uses the environment's real Turnstile keys; test-host
starts need the private `RER_DEMO_MEASUREMENT_TOKEN`. Deploys are manual until
enabled by the owner.

The runtime and every copied Base module are from `rer-v0.2.30`. See Base's
[adoption guide](https://github.com/runeditrun/base/blob/rer-v0.2.30/default-seed/DEMO.md).
Lanyard has no public-URL check or AI-provider action. Payroll exports are local
CSV downloads, not provider submissions. Identity-provider discovery is a real
read; authentication token exchanges and mail are guarded by Base in demo mode.
