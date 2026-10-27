export function KeyList({
  keys,
  masked = false,
  emptyMessage = "No keys",
}: {
  keys?: string[];
  masked?: boolean;
  emptyMessage?: string;
}) {
  if (!keys?.length)
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {keys.map((key) => (
        <li
          key={key}
          className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-xs"
        >
          <span className="min-w-0 break-all">{key}</span>
          {masked && (
            <span aria-label="Value hidden" className="text-muted-foreground">
              ••••••••
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
