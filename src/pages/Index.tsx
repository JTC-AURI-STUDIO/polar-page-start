import { useState } from "react";
import { GitBranch, ArrowRight, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import TerminalLog, { LogEntry } from "@/components/TerminalLog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const [sourceUrl, setSourceUrl] = useState("");
  const [destUrl, setDestUrl] = useState("");
  const [tokenMae, setTokenMae] = useState("");
  const [tokenFilha, setTokenFilha] = useState("");
  const [sameAccount, setSameAccount] = useState(true);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };

  const parseGitHubUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/\s?.]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  };

  const handleRemix = async () => {
    if (!sourceUrl || !destUrl || !tokenMae || (!sameAccount && !tokenFilha)) {
      toast.error("Preencha todos os campos!");
      return;
    }

    const source = parseGitHubUrl(sourceUrl);
    const dest = parseGitHubUrl(destUrl);

    if (!source || !dest) {
      toast.error("URLs inválidas! Use links do GitHub.");
      return;
    }

    setLoading(true);
    setLogs([]);

    addLog("Iniciando processo de remix...");
    addLog(`Fonte: ${source.owner}/${source.repo}`);
    addLog(`Destino: ${dest.owner}/${dest.repo}`);

    try {
      addLog("Enviando para o servidor...");

      const { data, error } = await supabase.functions.invoke("github-remix", {
        body: {
          sourceOwner: source.owner,
          sourceRepo: source.repo,
          destOwner: dest.owner,
          destRepo: dest.repo,
          sourceToken: tokenMae,
          destToken: sameAccount ? tokenMae : tokenFilha,
        },
      });

      if (error) {
        addLog(`Erro: ${error.message}`, "error");
        toast.error("Falha no remix!");
        return;
      }

      if (data?.logs) {
        data.logs.forEach((log: { message: string; type: LogEntry["type"] }) => {
          addLog(log.message, log.type);
        });
      }

      if (data?.success) {
        addLog("Remix concluído com sucesso! 🎉", "success");
        toast.success("Remix concluído!");
      } else {
        addLog(`Erro: ${data?.error || "Erro desconhecido"}`, "error");
        toast.error("Falha no remix!");
      }
    } catch (err: any) {
      addLog(`Erro: ${err.message}`, "error");
      toast.error("Erro na execução!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <GitBranch className="w-10 h-10 text-primary glow-text" />
          <h1 className="text-4xl font-sans font-extrabold text-foreground tracking-tight">
            Git<span className="text-primary glow-text">Remix</span>
          </h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-md">
          Clone o conteúdo de um repositório e envie para outro. Simples, rápido, direto no terminal.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl space-y-6">
        {/* Same account toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
          <span className="text-sm text-foreground">
            As duas contas são do <strong>mesmo usuário</strong> GitHub?
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{sameAccount ? "Sim" : "Não"}</span>
            <Switch checked={sameAccount} onCheckedChange={setSameAccount} />
          </div>
        </div>

        {/* Token Mãe */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">
            🔑 Token da Conta Mãe {sameAccount && <span className="text-primary">(único token)</span>}
          </label>
          <Input
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={tokenMae}
            onChange={(e) => setTokenMae(e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono"
          />
          <p className="text-xs text-muted-foreground">
            {sameAccount
              ? "Como é a mesma conta, esse token será usado para ler o repo mãe e escrever no repo filha."
              : "Token da conta que TEM o conteúdo. Precisa de permissão de leitura."
            }{" "}
            Permissão <code className="text-primary">repo</code> necessária.{" "}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
              Criar token →
            </a>
          </p>
        </div>

        {/* Token Filha (only if different accounts) */}
        {!sameAccount && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              🔑 Token da Conta Filha
            </label>
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={tokenFilha}
              onChange={(e) => setTokenFilha(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Token da conta que VAI RECEBER o conteúdo. Precisa de permissão de escrita.{" "}
              <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                Criar token →
              </a>
            </p>
          </div>
        )}

        {/* Repos */}
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Conta Mãe (tem o conteúdo)
            </label>
            <Input
              placeholder="https://github.com/user/source-repo"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
            />
          </div>

          <ArrowRight className="w-5 h-5 text-primary mt-6 flex-shrink-0" />

          <div className="flex-1 space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Conta Filha (vai receber)
            </label>
            <Input
              placeholder="https://github.com/user/dest-repo"
              value={destUrl}
              onChange={(e) => setDestUrl(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
            />
          </div>
        </div>

        {/* Action */}
        <Button
          onClick={handleRemix}
          disabled={loading}
          className="w-full h-12 text-base font-sans font-bold glow-green bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              Executar Remix
            </>
          )}
        </Button>

        {/* Terminal */}
        <TerminalLog logs={logs} />
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-muted-foreground">
        <span className="text-primary">●</span> Seus tokens nunca são armazenados
      </p>
    </div>
  );
};

export default Index;
