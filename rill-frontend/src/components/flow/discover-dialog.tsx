import { useState } from "react";
import { motion } from "framer-motion";
import { X, Package, FileSearch, Boxes, Sparkles, Loader2, ChevronRight } from "lucide-react";
import { introspect, KNOWN_PROTOCOL_IDS, SAMPLE_PACKAGE_IDS, type IntrospectionResult, type DiscoveredFunction } from "@/lib/introspect";

type Tab = "package" | "tx" | "protocol";

export function DiscoverDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (fns: DiscoveredFunction[], meta: IntrospectionResult) => void;
}) {
  const [tab, setTab] = useState<Tab>("package");
  const [pkg, setPkg] = useState("");
  const [tx, setTx] = useState("");
  const [proto, setProto] = useState("cetus");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntrospectionResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const run = async () => {
    setLoading(true);
    setResult(null);
    setPicked(new Set());
    const value = tab === "package" ? pkg : tab === "tx" ? tx : proto;
    if (!value.trim()) {
      setLoading(false);
      return;
    }
    const r = await introspect({ kind: tab, value });
    setResult(r);
    setPicked(new Set(r.functions.map((f) => f.id)));
    setLoading(false);
  };

  const toggle = (id: string) => {
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const importPicked = () => {
    if (!result) return;
    onImport(result.functions.filter((f) => picked.has(f.id)), result);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-[var(--shadow-float)] overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Auto-introspection
            </div>
            <h3 className="font-display text-2xl tracking-tight">Discover a Sui protocol</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste a package ID, a transaction example, or pick a protocol — Rill reads the ABI and labels every input/output.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 flex gap-1">
          {(
            [
              { id: "package", label: "Package ID", icon: Package },
              { id: "tx", label: "Transaction", icon: FileSearch },
              { id: "protocol", label: "Protocol", icon: Boxes },
            ] as { id: Tab; label: string; icon: typeof Package }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setResult(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
                tab === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "package" && (
            <div>
              <label className="text-xs text-muted-foreground">Sui package ID</label>
              <input
                value={pkg}
                onChange={(e) => setPkg(e.target.value)}
                placeholder="0x1eabed72c5…"
                className="mt-1 w-full rounded-lg bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted-foreground self-center mr-1">Try:</span>
                {Object.entries(SAMPLE_PACKAGE_IDS).slice(0, 5).map(([id, v]) => (
                  <button
                    key={id}
                    onClick={() => setPkg(v)}
                    className="text-[11px] font-mono rounded-md border border-border bg-background px-2 py-1 hover:bg-secondary"
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "tx" && (
            <div>
              <label className="text-xs text-muted-foreground">Transaction digest</label>
              <input
                value={tx}
                onChange={(e) => setTx(e.target.value)}
                placeholder="DkA9k…q3WQ"
                className="mt-1 w-full rounded-lg bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Conduit replays the tx, matches emitted events, and reconstructs the call graph.
              </p>
            </div>
          )}
          {tab === "protocol" && (
            <div>
              <label className="text-xs text-muted-foreground">Protocol</label>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {KNOWN_PROTOCOL_IDS.map((id) => (
                  <button
                    key={id}
                    onClick={() => setProto(id)}
                    className={`rounded-lg border px-3 py-2 text-sm capitalize text-left ${
                      proto === id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                    }`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={run}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Introspecting…" : "Run introspection"}
            </button>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-xl border border-border bg-background/60 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Detected · confidence{" "}
                    <span className="font-mono text-foreground">{(result.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="font-display text-xl tracking-tight">{result.protocol}</div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[420px]">
                    {result.packageId}
                  </div>
                </div>
                <span className="text-[11px] rounded-full bg-mint/60 text-mint-foreground px-2 py-1">
                  {result.functions.length} entry functions
                </span>
              </div>
              <div className="max-h-[260px] overflow-y-auto divide-y divide-border">
                {result.functions.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/60 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(f.id)}
                      onChange={() => toggle(f.id)}
                      className="mt-1 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-foreground/80">{f.module}::{f.name}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{f.description}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {f.inputs.map((p) => (
                          <span key={"i" + p.key} className="text-[10px] font-mono rounded bg-mint/40 text-mint-foreground px-1.5 py-0.5">
                            in · {p.label}
                          </span>
                        ))}
                        {f.outputs.map((p) => (
                          <span key={"o" + p.key} className="text-[10px] font-mono rounded bg-peach/40 text-peach-foreground px-1.5 py-0.5">
                            out · {p.label}
                          </span>
                        ))}
                        {f.events.map((e) => (
                          <span key={e} className="text-[10px] font-mono rounded bg-foreground/10 px-1.5 py-0.5">
                            event · {e.split("::").pop()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm hover:bg-secondary transition"
                >
                  Cancel
                </button>
                <button
                  onClick={importPicked}
                  disabled={picked.size === 0}
                  className="rounded-full bg-foreground text-background px-3.5 py-1.5 text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  Import {picked.size} {picked.size === 1 ? "node" : "nodes"} to canvas
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
