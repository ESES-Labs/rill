import { type ReactNode } from "react";
import { Handle, Position, type HandleType } from "reactflow";
import { cn } from "@/lib/utils";

type PortRowProps = {
  handleId: string;
  handleType: HandleType;
  side: "left" | "right";
  tone?: "flow" | "coin-in" | "coin-out";
  className?: string;
  children: ReactNode;
};

/** Full-bleed wire row with an inline handle — edges snap to the visible circle. */
export function PortRow({
  handleId,
  handleType,
  side,
  tone = "flow",
  className,
  children,
}: PortRowProps) {
  const toneCls =
    tone === "coin-out"
      ? "border-peach/45 bg-peach/10"
      : tone === "coin-in"
        ? "border-mint/45 bg-mint/10"
        : "border-border/55 bg-muted/25";

  return (
    <div
      className={cn(
        "flex min-h-[38px] items-center gap-2 border-t border-dashed px-2 py-2.5 text-[10px]",
        toneCls,
        className,
      )}
    >
      {side === "left" && (
        <Handle
          id={handleId}
          type={handleType}
          position={Position.Left}
          className="flow-handle-port flow-handle-inline shrink-0"
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {side === "right" && (
        <Handle
          id={handleId}
          type={handleType}
          position={Position.Right}
          className="flow-handle-port flow-handle-inline shrink-0"
        />
      )}
    </div>
  );
}

type InlineHandleProps = {
  id: string;
  type: HandleType;
  position: Position;
  className?: string;
};

/** Small inline handle for port grid rows (discovered ABI nodes). */
export function InlineHandle({ id, type, position, className }: InlineHandleProps) {
  return (
    <Handle
      id={id}
      type={type}
      position={position}
      className={cn("flow-handle-port flow-handle-inline shrink-0", className)}
    />
  );
}
