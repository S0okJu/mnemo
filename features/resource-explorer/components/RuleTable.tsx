import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RuleTable({
  rules,
  emptyMessage = "No rules",
}: {
  rules: { verbs: string[]; resources: string[] }[];
  emptyMessage?: string;
}) {
  if (rules.length === 0)
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground h-9 px-3 text-xs">
              Resources
            </TableHead>
            <TableHead className="text-muted-foreground h-9 px-3 text-xs">
              Verbs
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule, i) => (
            <TableRow key={i}>
              <TableCell className="px-3 py-2 font-mono text-xs whitespace-normal">
                {rule.resources.join(", ")}
              </TableCell>
              <TableCell className="px-3 py-2 whitespace-normal">
                <span className="flex flex-wrap gap-1">
                  {rule.verbs.map((verb) => (
                    <span
                      key={verb}
                      className="bg-muted/60 rounded px-1.5 py-0.5 font-mono text-xs"
                    >
                      {verb}
                    </span>
                  ))}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
