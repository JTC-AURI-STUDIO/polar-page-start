import { useEffect, useRef } from "react";

export interface LogEntry {
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: Date;
}

interface TerminalLogProps {
  logs: LogEntry[];
}

const typeColors: Record<LogEntry["type"], string> = {
  info: "text-muted-foreground",
  success: "text-primary",
  error: "text-destructive",
  warning: "text-yellow-500",
};

const typePrefix: Record<LogEntry["type"], string> = {
  info: "→",
  success: "✓",
  error: "✗",
  warning: "⚠",
};

const TerminalLog = ({ logs }: TerminalLogProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="relative rounded-lg border border-border bg-terminal-bg overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/50">
        <div className="w-3 h-3 rounded-full bg-destructive/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-primary/70" />
        <span className="ml-2 text-xs text-muted-foreground">remix-terminal</span>
      </div>

      {/* Terminal body */}
      <div className="p-4 h-64 overflow-y-auto font-mono text-sm terminal-scanline">
        {logs.length === 0 ? (
          <div className="text-muted-foreground animate-pulse-glow">
            <span className="text-primary">$</span> Aguardando comando...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`mb-1 ${typeColors[log.type]}`}>
              <span className="text-muted-foreground text-xs mr-2">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className="mr-1">{typePrefix[log.type]}</span>
              {log.message}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default TerminalLog;
