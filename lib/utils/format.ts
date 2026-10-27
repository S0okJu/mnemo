import { formatDistanceToNowStrict } from "date-fns";

export function formatAge(isoDate: string): string {
  return formatDistanceToNowStrict(new Date(isoDate), { addSuffix: false });
}

export function formatUpdatedAgo(timestamp: number): string {
  if (!timestamp) return "never";
  return `${formatDistanceToNowStrict(new Date(timestamp))} ago`;
}

/** English plural for a resource label, e.g. Ingress → Ingresses, NetworkPolicy → NetworkPolicies. */
export function pluralize(label: string): string {
  if (/(s|x|ch|sh)$/.test(label)) return `${label}es`;
  if (/[^aeiou]y$/.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}
