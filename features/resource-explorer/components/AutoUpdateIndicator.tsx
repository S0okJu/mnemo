"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { formatUpdatedAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const AutoRefreshContext = createContext<{
  paused: boolean;
  setPaused: (paused: boolean) => void;
} | null>(null);

/** Lets readers pause polling so rows stop moving while they read. */
export function AutoRefreshProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useLocalStorageState(
    "mnemo.autorefresh.paused",
    false,
  );
  return (
    <AutoRefreshContext.Provider value={{ paused, setPaused }}>
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefresh() {
  return useContext(AutoRefreshContext);
}

export function AutoUpdateIndicator({
  dataUpdatedAt,
  isFetching,
  onRefresh,
}: {
  dataUpdatedAt: number;
  isFetching: boolean;
  onRefresh?: () => void;
}) {
  const [, forceTick] = useState(0);
  const autoRefresh = useAutoRefresh();
  const paused = autoRefresh?.paused ?? false;

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <span aria-live="polite" className="mr-1 flex items-center gap-1.5">
        <motion.span
          animate={isFetching ? { rotate: 360 } : { rotate: 0 }}
          transition={
            isFetching
              ? { duration: 0.8, repeat: Infinity, ease: "linear" }
              : undefined
          }
          className={cn(
            "flex items-center",
            paused ? "text-muted-foreground" : "text-status-progressing",
          )}
        >
          <RefreshCw aria-hidden className="size-3.5" />
        </motion.span>
        <span>
          {paused ? "Paused · " : ""}Updated{" "}
          {dataUpdatedAt ? formatUpdatedAgo(dataUpdatedAt) : "never"}
        </span>
      </span>
      {onRefresh && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Refresh now"
                onClick={onRefresh}
                disabled={isFetching}
              />
            }
          >
            <RefreshCw aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Refresh now</TooltipContent>
        </Tooltip>
      )}
      {autoRefresh && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-pressed={paused}
                aria-label="Pause auto-refresh"
                onClick={() => autoRefresh.setPaused(!paused)}
              />
            }
          >
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          </TooltipTrigger>
          <TooltipContent>
            {paused ? "Resume auto-refresh" : "Pause auto-refresh"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
