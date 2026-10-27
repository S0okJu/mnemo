let counter = 0;

export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString().padStart(6, "0")}`;
}

export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function hoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}
