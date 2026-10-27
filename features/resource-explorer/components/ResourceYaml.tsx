"use client";
import { useState } from "react";
import { dump } from "js-yaml";
import { Download, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { K8sResource } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

export function ResourceYaml({
  resource,
}: {
  resource: K8sResource<unknown, unknown>;
}) {
  const [wrap, setWrap] = useState(false);
  const yaml = dump(resource, { noRefs: true, lineWidth: 100 });
  const lines = yaml.replace(/\n$/, "").split("\n");
  function download() {
    const url = URL.createObjectURL(new Blob([yaml], { type: "text/yaml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${resource.kind.toLowerCase()}-${resource.metadata.name}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section aria-label="Resource YAML" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
          Read-only
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {lines.length} lines
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={wrap}
            onClick={() => setWrap((value) => !value)}
            className={cn(wrap && "bg-muted")}
          >
            <WrapText aria-hidden />
            Wrap lines
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download aria-hidden />
            Download
          </Button>
          <CopyButton value={yaml} label="Copy YAML">
            Copy YAML
          </CopyButton>
        </div>
      </div>
      <div
        tabIndex={0}
        aria-label="YAML content"
        className="bg-muted/30 focus-visible:ring-ring/50 flex max-h-[calc(100vh-16rem)] min-h-48 overflow-auto rounded-lg border font-mono text-xs leading-5 focus-visible:ring-2 focus-visible:outline-none"
      >
        {!wrap && (
          <div
            aria-hidden
            className="bg-muted/40 text-muted-foreground/70 sticky left-0 shrink-0 border-r px-3 py-3 text-right select-none"
          >
            {lines.map((_, index) => (
              <div key={index} className="tabular-nums">
                {index + 1}
              </div>
            ))}
          </div>
        )}
        <pre
          className={cn(
            "min-w-0 flex-1 px-4 py-3",
            wrap ? "break-all whitespace-pre-wrap" : "whitespace-pre",
          )}
        >
          <code>{yaml}</code>
        </pre>
      </div>
    </section>
  );
}
