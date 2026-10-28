# Operational reports and native tip pools

Open **Operational reports** to choose inclusive dates, cafe, report kind, job
and person. The owner can choose **All cafes** to combine the same authorized
sources across recorded organization locations. A native manager continues to
read only their home cafe and permitted people. This control grants no new
manager, analyst or delegated authority.

**Download matching CSV** uses the same filters and current approved sources.
A pending correction leaves approved totals intact; an approved correction
replaces its earlier source. Source IDs and revisions remain visible. Different
report kinds are not additive. Missing source data and unresolved received
captures remain incomplete; devices that have never connected are unknowable.
Manual sales and employer payroll acknowledgements do not establish POS or
provider reconciliation.

## Reviewed pool sources

The native owner can prepare a pool through the existing authenticated command
endpoint, `POST /api/lanyard/command`. There is no automatic pool creation or
payment. This interim workflow supports one completed venue date and one cafe,
ordinary hourly employees whose eligibility the employer has reviewed, and
allocation proportional to actual approved minutes in explicitly chosen jobs.
Owner and manager roles cannot participate. It does not verify legal eligibility
or import POS tips. Other contribution rules, dedicated pool administration and
employee discrepancy review remain open.

Send `tip.pool.prepare` with this input shape, substituting current record IDs:

```json
{
  "name": "tip.pool.prepare",
  "input": {
    "site": "East",
    "date": "2026-10-12",
    "jobs": ["current-job-id"],
    "participants": ["current-employee-id"],
    "inputs": [{"reference": "synthetic-lanyard-1", "cents": 700}],
    "declarationIds": ["original-approved-punch-time-id"],
    "reason": "Employer reviewed eligibility and service sources"
  }
}
```

`inputs` holds employer-recorded cash or card totals with unique source
references; it may be empty when the pool consists of declarations.
`declarationIds` selects whole cash-tip declarations from original punches
with current approved eligible work; it may be empty for a manually entered
pool. Each participant needs approved work in a chosen job on that date at that
cafe. Pending time, open punches and unresolved received captures require review
first. Largest remainders distribute leftover cents, with stable person and job
IDs breaking ties. The allocated cents exactly equal the pool's input total.

Inspect the returned allocations, eligible minutes and source revisions, then
send `tip.pool.approve` with its `id`, `revision` and `consent: true`. The owner
must explicitly review eligibility and the allocation. Changed work or eligibility
refuses the old review. A repeated approval or reused approved input is refused.
A prepared pool has no effect on approved reports, earnings or payroll.

To correct a pool, prepare again with `corrects` naming its latest approved ID,
the original cafe and date, complete replacement inputs and a reason. Approve
that new review separately. Old approvals remain retained; reports use only the
latest approved allocation. Stable payroll input identities make a later mapped
export carry signed differences, including reductions. A draft payroll batch
reviewed before the pool changed cannot be exported.

Approved allocations appear separately from original declared tips in reports.
A pooled declaration is replaced by the allocation in tip-credit checks, rather
than counted twice. The employee's own earnings estimate includes their approved
pool amount. Native managers see only allocations within current scope; the
whole pool total is withheld when its participants exceed that scope. Raw pool
reviews and employer payroll inputs remain owner-only. No native approval or
mapped file proves provider application, payment, settlement or legal compliance.

Scheduled report configuration remains under **Settings**. Email contains only
an expiring, recipient-bound link, and requires fresh owner approval after
recipient authority changes or archive restoration. SendGrid network-edge tests
establish request handling; real delivery remains unproved.
