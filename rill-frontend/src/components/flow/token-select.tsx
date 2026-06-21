import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SWAP_TOKENS, TOKEN_LOGOS, type SwapTokenSymbol } from "@/lib/action-config";
import { cn } from "@/lib/utils";

function CoinLogo({ symbol, className }: { symbol: SwapTokenSymbol; className?: string }) {
  return (
    <img
      src={TOKEN_LOGOS[symbol]}
      alt=""
      className={cn("h-4 w-4 shrink-0 rounded-full object-contain", className)}
      loading="lazy"
      decoding="async"
    />
  );
}

function TokenOption({ symbol }: { symbol: SwapTokenSymbol }) {
  return (
    <span className="flex items-center gap-2">
      <CoinLogo symbol={symbol} />
      <span className="font-medium">{symbol}</span>
    </span>
  );
}

export function TokenSelect({
  value,
  onChange,
  className,
}: {
  value: SwapTokenSymbol;
  onChange: (symbol: SwapTokenSymbol) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SwapTokenSymbol)}>
      <SelectTrigger
        className={cn(
          "nodrag nowheel mt-0.5 h-8 w-full cursor-pointer bg-background text-[11px] shadow-none focus:ring-1 focus:ring-primary/40",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[200] cursor-pointer">
        {SWAP_TOKENS.map((t) => (
          <SelectItem
            key={t.symbol}
            value={t.symbol}
            className="cursor-pointer py-2 pl-2 pr-8 text-[11px]"
          >
            <TokenOption symbol={t.symbol} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TokenBadge({ symbol }: { symbol: SwapTokenSymbol }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-mono text-muted-foreground">
      <CoinLogo symbol={symbol} className="h-3.5 w-3.5" />
      {symbol}
    </span>
  );
}
