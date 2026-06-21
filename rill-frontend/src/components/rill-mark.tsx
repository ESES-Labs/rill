import { Waves } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rill wordmark — water/stream motif, not the generic AI sparkle. */
export function RillMark({ className }: { className?: string }) {
  return <Waves className={cn("h-3.5 w-3.5", className)} strokeWidth={2.25} aria-hidden />;
}
