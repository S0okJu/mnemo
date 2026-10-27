"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Info,
  XCircle,
} from "lucide-react";
import type { KubeconfigCheck } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PropertyList } from "@/features/resource-explorer/components/PropertyList";
import { SegmentedControl } from "@/features/resource-explorer/components/SegmentedControl";
import {
  AUTH_LABELS,
  KUBECONFIG_MAX_BYTES,
  previewKubeconfig,
} from "../lib/kubeconfig";
import {
  saveErrorMessage,
  useClusterConnectionActions,
} from "../hooks/useClusterConnection";

const FIELD =
  "border-input bg-background text-foreground focus-visible:ring-ring/50 w-full rounded-lg border text-sm focus-visible:ring-2 focus-visible:outline-none";

const CHECK_ICON = {
  ok: <CheckCircle2 aria-hidden className="text-status-healthy size-4" />,
  info: <Info aria-hidden className="text-muted-foreground size-4" />,
  warning: <AlertTriangle aria-hidden className="text-status-warning size-4" />,
  error: <XCircle aria-hidden className="text-status-error size-4" />,
};

function CheckList({
  checks,
  label,
}: {
  checks: KubeconfigCheck[];
  label: string;
}) {
  return (
    <ul aria-label={label} className="space-y-1.5">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 shrink-0">{CHECK_ICON[check.level]}</span>
          <span className={cn(check.level === "error" && "text-status-error")}>
            {check.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <h3 className="flex items-center gap-2 text-[13px] font-medium">
        <span className="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full text-xs tabular-nums">
          {number}
        </span>
        {title}
      </h3>
      <div className="pl-7">{children}</div>
    </section>
  );
}

/**
 * The kubeconfig lives only in this component's state until it is sent to the
 * server; it is never written to browser storage.
 */
export function KubeconfigForm({
  replacing,
  onDone,
}: {
  replacing: boolean;
  /** Called after a save (with the new context) or a cancel. */
  onDone?: (savedContext?: string) => void;
}) {
  const { validate, save } = useClusterConnectionActions();
  const [method, setMethod] = useState<"paste" | "upload">("paste");
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [context, setContext] = useState<string>();
  const [namespace, setNamespace] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const preview = useMemo(
    () => (source.trim() ? previewKubeconfig(source) : undefined),
    [source],
  );
  const selected =
    preview?.contexts.find(
      (entry) => entry.name === (context ?? preview.currentContext),
    ) ?? preview?.contexts[0];
  const clientChecks = [
    ...(preview?.errors ?? []),
    ...(selected?.checks ?? []),
  ];
  const blocked =
    !selected || clientChecks.some((check) => check.level === "error");
  const submission = {
    kubeconfig: source,
    context: selected?.name,
    namespace: namespace.trim() || undefined,
  };

  function change(next: string) {
    setSource(next);
    setContext(undefined);
    validate.reset();
    save.reset();
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > KUBECONFIG_MAX_BYTES) {
      setFileError("The file is larger than 1 MiB.");
      return;
    }
    setFileError(undefined);
    setFileName(file.name);
    change(await file.text());
  }
  function finish(savedContext?: string) {
    setSource("");
    setFileName(undefined);
    setContext(undefined);
    setNamespace("");
    validate.reset();
    onDone?.(savedContext);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          {replacing ? "Replace kubeconfig" : "Connect a cluster"}
        </h3>
        <p className="text-muted-foreground text-sm">
          The kubeconfig is sent once to the mnemo server and stored encrypted
          there. It is never saved in this browser.
        </p>
      </div>

      <Step number={1} title="Provide a kubeconfig">
        <div className="space-y-3">
          <SegmentedControl
            label="Kubeconfig source"
            value={method}
            onChange={setMethod}
            options={[
              { value: "paste", label: "Paste" },
              { value: "upload", label: "Upload file" },
            ]}
          />
          {method === "paste" ? (
            <textarea
              aria-label="Kubeconfig"
              value={source}
              onChange={(event) => change(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              rows={10}
              placeholder="apiVersion: v1&#10;kind: Config&#10;clusters: …"
              className={cn(
                FIELD,
                "min-h-48 px-3 py-2 font-mono text-xs leading-5",
              )}
            />
          ) : (
            <label
              htmlFor={inputId}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void readFile(event.dataTransfer.files[0]);
              }}
              className={cn(
                "text-muted-foreground flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm transition-colors",
                dragging ? "border-primary bg-accent/60" : "hover:bg-accent/40",
              )}
            >
              <FileUp aria-hidden className="size-5" />
              <span>
                {fileName ? (
                  <span className="text-foreground font-medium">
                    {fileName}
                  </span>
                ) : (
                  "Drop a kubeconfig file here, or click to choose one"
                )}
              </span>
              <span className="text-xs">YAML, up to 1 MiB</span>
              <input
                id={inputId}
                type="file"
                accept=".yaml,.yml,.conf,.config,text/yaml,application/x-yaml"
                aria-label="Kubeconfig file"
                className="sr-only"
                onChange={(event) => void readFile(event.target.files?.[0])}
              />
            </label>
          )}
          {fileError && (
            <p role="alert" className="text-status-error text-sm">
              {fileError}
            </p>
          )}
        </div>
      </Step>

      {preview && (
        <Step number={2} title="Review">
          <div className="space-y-4">
            {preview.contexts.length > 1 && (
              <label className="flex max-w-sm flex-col gap-1.5 text-xs">
                <span className="text-muted-foreground">Context</span>
                <select
                  value={selected?.name}
                  onChange={(event) => {
                    setContext(event.target.value);
                    validate.reset();
                  }}
                  className={cn(FIELD, "h-9 px-2.5")}
                >
                  {preview.contexts.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                      {entry.name === preview.currentContext
                        ? " (current)"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selected && (
              <PropertyList
                items={[
                  { label: "Context", value: selected.name },
                  { label: "Cluster", value: selected.cluster },
                  {
                    label: "Server",
                    value: selected.server,
                    mono: true,
                    wide: true,
                  },
                  { label: "User", value: selected.user },
                  {
                    label: "Authentication",
                    value: selected.authType
                      ? `${AUTH_LABELS[selected.authType]}${
                          // Plugins fetch credentials at runtime; the others are stored in the file.
                          selected.authType === "exec" ||
                          selected.authType === "auth-provider"
                            ? ""
                            : " · embedded"
                        }`
                      : undefined,
                  },
                ]}
              />
            )}
            {selected && (
              <label className="flex max-w-sm flex-col gap-1.5 text-xs">
                <span className="text-muted-foreground">
                  Default namespace (optional)
                </span>
                <Input
                  value={namespace}
                  onChange={(event) => setNamespace(event.target.value)}
                  placeholder={selected.namespace ?? "default"}
                  className="h-9"
                />
              </label>
            )}
            {clientChecks.length ? (
              <CheckList checks={clientChecks} label="Kubeconfig checks" />
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                {CHECK_ICON.ok}
                No problems found in the file.
              </p>
            )}
          </div>
        </Step>
      )}

      {preview && (
        <Step number={3} title="Verify and save">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => validate.mutate(submission)}
                disabled={blocked || validate.isPending}
              >
                {validate.isPending ? "Testing…" : "Test connection"}
              </Button>
              <Button
                onClick={() =>
                  save.mutate(submission, {
                    onSuccess: (connection) => finish(connection.context),
                  })
                }
                disabled={blocked || save.isPending}
              >
                {save.isPending
                  ? "Saving…"
                  : replacing
                    ? "Replace connection"
                    : "Save connection"}
              </Button>
              {replacing && (
                <Button variant="ghost" onClick={() => finish()}>
                  Cancel
                </Button>
              )}
            </div>
            {validate.data && (
              <div className="space-y-2">
                <CheckList
                  checks={validate.data.checks}
                  label="Server checks"
                />
                {validate.data.version && (
                  <p className="text-muted-foreground text-xs">
                    Kubernetes {validate.data.version}
                  </p>
                )}
              </div>
            )}
            {validate.isError && (
              <p role="alert" className="text-status-error text-sm">
                The connection test could not be run. Try again.
              </p>
            )}
            {save.isError && (
              <p role="alert" className="text-status-error text-sm">
                {saveErrorMessage(save.error)}
              </p>
            )}
          </div>
        </Step>
      )}

      {!preview && replacing && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => finish()}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
