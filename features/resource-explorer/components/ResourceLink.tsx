"use client";

import Link from "next/link";
import { useResourceNavigation } from "./ResourceNavigation";

import { resolveResourceReference } from "@/lib/resource-registry/resource-reference";

/** References are names, namespace/name, or (without kind) Kind/[namespace/]name. */
export function ResourceLink({
  kind,
  name,
  namespace,
}: {
  kind?: string;
  name: string;
  namespace?: string;
}) {
  const navigate = useResourceNavigation();
  const { href } = resolveResourceReference({ kind, name, namespace });
  if (!href) return <span>{name}</span>;

  return (
    <Link
      href={navigate(href)}
      className="text-primary decoration-primary/40 hover:decoration-primary rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={(event) => event.stopPropagation()}
    >
      {name}
    </Link>
  );
}
