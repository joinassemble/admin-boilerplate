/**
 * Deterministic fake CRM dataset for the design-system samples.
 *
 * Generated at module load time (no per-request cost beyond array indexing).
 * Deterministic seed so the data is stable — list views render the same
 * order on every request.
 */

const FIRST = ['Ada', 'Alan', 'Grace', 'Edsger', 'Barbara', 'Donald', 'Linus', 'Margaret', 'John', 'Anita', 'Tony', 'Brian', 'Dennis', 'Ken', 'Niklaus', 'Bjarne', 'Guido', 'Yukihiro', 'James', 'Brendan'];
const LAST = ['Lovelace', 'Turing', 'Hopper', 'Dijkstra', 'Liskov', 'Knuth', 'Torvalds', 'Hamilton', 'Backus', 'Borg', 'Hoare', 'Kernighan', 'Ritchie', 'Thompson', 'Wirth', 'Stroustrup', 'Rossum', 'Matsumoto', 'Gosling', 'Eich'];
const CITIES = ['London', 'Berlin', 'Tokyo', 'New York', 'Paris', 'Sydney', 'Toronto', 'Amsterdam', 'Singapore', 'Stockholm'];
const PLANS = ['Pro', 'Team', 'Business', 'Enterprise'];
const STATUSES = ['active', 'past_due', 'canceled', 'trialing'] as const;

// Simple deterministic pseudo-random integer in [0, mod).
// Note: this Math.sin-based PRNG is biased and clusters near low values —
// fine for stable demo data, but don't reuse it where you need a uniform
// distribution.
function det(seed: number, i: number, mod: number): number {
  return Math.floor(Math.abs(Math.sin(seed * 9301 + i * 49297) * 233280) % mod);
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  city: string;
  plan: string;
  mrr_cents: number;
  status: typeof STATUSES[number];
  created_at: number;
}

export interface Subscription {
  id: string;
  customer_id: string;
  plan: string;
  status: typeof STATUSES[number];
  amount_cents: number;
  current_period_end: number;
  created_at: number;
}

export interface Invoice {
  id: string;
  customer_id: string;
  amount_cents: number;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  due_at: number;
  paid_at: number | null;
}

export interface Activity {
  id: string;
  customer_id: string;
  action: string;
  detail: string;
  ts: number;
}

const NOW = 1726000000; // Stable epoch for deterministic dates.

export const customers: Customer[] = Array.from({ length: 30 }, (_, i) => {
  const first = FIRST[det(1, i, FIRST.length)]!;
  const last = LAST[det(2, i, LAST.length)]!;
  const plan = PLANS[det(3, i, PLANS.length)]!;
  return {
    id: `cus_${(i + 1).toString().padStart(4, '0')}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    name: `${first} ${last}`,
    city: CITIES[det(4, i, CITIES.length)]!,
    plan,
    mrr_cents: det(5, i, 100) * 100 + 2900,
    status: STATUSES[det(6, i, STATUSES.length)]!,
    created_at: NOW - det(7, i, 365 * 86400),
  };
});

export const subscriptions: Subscription[] = Array.from({ length: 50 }, (_, i) => {
  const c = customers[det(10, i, customers.length)]!;
  return {
    id: `sub_${(i + 1).toString().padStart(4, '0')}`,
    customer_id: c.id,
    plan: c.plan,
    status: STATUSES[det(11, i, STATUSES.length)]!,
    amount_cents: c.mrr_cents,
    current_period_end: NOW + det(12, i, 30 * 86400),
    created_at: c.created_at,
  };
});

export const invoices: Invoice[] = Array.from({ length: 80 }, (_, i) => {
  const c = customers[det(20, i, customers.length)]!;
  const status = (['paid', 'paid', 'paid', 'open', 'void'] as const)[det(21, i, 5)]!;
  const due = NOW - det(22, i, 60 * 86400);
  return {
    id: `inv_${(i + 1).toString().padStart(4, '0')}`,
    customer_id: c.id,
    amount_cents: c.mrr_cents,
    status,
    due_at: due,
    paid_at: status === 'paid' ? due - 86400 * 2 : null,
  };
});

const ACTIONS = ['signed_in', 'updated_card', 'plan_upgraded', 'plan_downgraded', 'invoice_paid', 'invoice_failed', 'created_team', 'invited_member'];
export const activity: Activity[] = Array.from({ length: 100 }, (_, i) => {
  const c = customers[det(30, i, customers.length)]!;
  const action = ACTIONS[det(31, i, ACTIONS.length)]!;
  return {
    id: `act_${(i + 1).toString().padStart(5, '0')}`,
    customer_id: c.id,
    action,
    detail: `${c.email} · ${action}`,
    ts: NOW - det(32, i, 7 * 86400),
  };
}).sort((a, b) => b.ts - a.ts); // recent-first
