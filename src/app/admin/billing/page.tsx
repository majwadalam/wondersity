import { A, Badge, PageHead, Section, Stats, Table, Time, num, usd } from "@/components/admin/ui";
import { emailsById, listPartners, listSubscriptions, requireAdmin } from "@/lib/admin";
import { billingEnabled } from "@/lib/plans";

// Subscriptions mirrored from Paddle, and creator partners with what they brought in.

const PAYING = ["active", "trialing", "past_due"];
// List prices less Paddle's fee, as in ECONOMICS.md (an estimate, not Paddle's record).
const MONTHLY_NET = { monthly: 18.5, yearly: 9.45 } as Record<string, number>;

export default async function AdminBilling() {
  await requireAdmin();
  const [subs, { partners, companions, signups }, email] = await Promise.all([listSubscriptions(), listPartners(), emailsById()]);
  const paying = subs.filter((s) => PAYING.includes(s.status ?? ""));
  const mrr = paying.reduce((n, s) => n + (MONTHLY_NET[s.plan ?? ""] ?? 0), 0);

  return (
    <>
      <PageHead title="Subscriptions & partners" sub={billingEnabled() ? "Billing is on: plan limits apply." : "Billing is off: Paddle isn't configured, so everything is free in beta."} />
      <div className="mt-8">
        <Stats
          items={[
            { label: "Paying now", value: num(paying.length), sub: `${paying.filter((s) => s.plan === "yearly").length} yearly · ${paying.filter((s) => s.plan === "monthly").length} monthly` },
            { label: "Est. monthly revenue", value: usd(mrr), sub: "net of Paddle's fee" },
            { label: "Canceling", value: num(paying.filter((s) => s.canceled_at).length) },
            { label: "Partners", value: num(partners.length), sub: `${companions.length} companion pages` },
          ]}
        />
      </div>

      <Section title="Subscriptions">
        <Table
          rows={subs}
          rowKey={(s) => s.learner_id!}
          empty="No subscriptions yet."
          columns={[
            { label: "Learner", cell: (s) => <A href={`/admin/users/${s.learner_id}`}>{email.get(s.learner_id!) ?? s.learner_id}</A> },
            { label: "Plan", cell: (s) => s.plan ?? "–" },
            { label: "Status", cell: (s) => <Badge tone={PAYING.includes(s.status ?? "") ? "good" : "muted"}>{s.status}</Badge> },
            { label: "Renews / ends", cell: (s) => <Time iso={s.current_period_end} /> },
            { label: "Canceled", cell: (s) => (s.canceled_at ? <Time iso={s.canceled_at} /> : "–") },
            { label: "Referred by", cell: (s) => s.referred_by ?? "–" },
          ]}
        />
      </Section>

      <Section title="Creator partners" sub="Partners and companion pages are added with SQL (docs/CREATORS.md).">
        <Table
          rows={partners}
          rowKey={(p) => String(p.code)}
          empty="No partners yet."
          columns={[
            { label: "Code", cell: (p) => <span className="font-mono">{String(p.code)}</span> },
            { label: "Name", cell: (p) => String(p.name) },
            { label: "Commission", cell: (p) => `${p.commission_pct}% for ${p.commission_months} months` },
            { label: "Signups", align: "right", cell: (p) => signups.get(String(p.code)) ?? 0 },
            { label: "Subscribers", align: "right", cell: (p) => subs.filter((s) => s.referred_by === p.code).length },
            { label: "Active", cell: (p) => (p.active ? <Badge tone="good">yes</Badge> : <Badge>no</Badge>) },
          ]}
        />
      </Section>

      {companions.length > 0 && (
        <Section title="Companion pages">
          <Table
            rows={companions}
            rowKey={(c) => String(c.slug)}
            columns={[
              { label: "Page", cell: (c) => <A href={`/c/${c.slug}`}>/c/{String(c.slug)}</A> },
              { label: "Partner", cell: (c) => String(c.partner_code) },
              { label: "Topic", cell: (c) => String(c.topic) },
              { label: "Active", cell: (c) => (c.active ? <Badge tone="good">yes</Badge> : <Badge>no</Badge>) },
            ]}
          />
        </Section>
      )}
    </>
  );
}
