/**
 * Bootstrap admin = an email listed in ADMIN_EMAILS env var.
 * Always allowed. Always assigned role='admin'. Independent of which AccessPolicy is active.
 */

export function parseAdminEmails(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isBootstrapAdmin(email: string, envValue: string | undefined): boolean {
  const list = parseAdminEmails(envValue);
  return list.includes(email.toLowerCase());
}
