import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LogEntry {
  message: string;
  type: "info" | "success" | "error" | "warning";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: LogEntry[] = [];
  const log = (message: string, type: LogEntry["type"] = "info") => {
    logs.push({ message, type });
  };

  try {
    const { sourceOwner, sourceRepo, destOwner, destRepo, token, sourceToken, destToken } =
      await req.json();

    // Support both old (single token) and new (dual token) formats
    const effectiveSourceToken = sourceToken || token;
    const effectiveDestToken = destToken || token;

    if (!sourceOwner || !sourceRepo || !destOwner || !destRepo || !effectiveSourceToken || !effectiveDestToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campos obrigatórios faltando",
          logs,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghSource = (path: string, options?: RequestInit) =>
      fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${effectiveSourceToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });

    const ghDest = (path: string, options?: RequestInit) =>
      fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${effectiveDestToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });

    // 1. Get source repo default branch
    log("Obtendo informações do repositório fonte...");
    const sourceInfoRes = await ghSource(`/repos/${sourceOwner}/${sourceRepo}`);
    if (!sourceInfoRes.ok) {
      log(`Erro ao acessar repo fonte: ${sourceInfoRes.status}`, "error");
      return new Response(
        JSON.stringify({ success: false, error: "Não foi possível acessar o repo fonte", logs }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const sourceInfo = await sourceInfoRes.json();
    const sourceBranch = sourceInfo.default_branch;
    log(`Branch fonte: ${sourceBranch}`, "success");

    // 2. Get source tree recursively
    log("Baixando árvore de arquivos do fonte...");
    const treeRes = await ghSource(
      `/repos/${sourceOwner}/${sourceRepo}/git/trees/${sourceBranch}?recursive=1`
    );
    if (!treeRes.ok) {
      log("Erro ao obter árvore de arquivos", "error");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao obter árvore", logs }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const treeData = await treeRes.json();
    const files = treeData.tree.filter((item: any) => item.type === "blob");
    log(`${files.length} arquivos encontrados`, "success");

    // 3. Get dest repo info
    log("Obtendo informações do repositório destino...");
    const destInfoRes = await ghDest(`/repos/${destOwner}/${destRepo}`);
    if (!destInfoRes.ok) {
      log(`Erro ao acessar repo destino: ${destInfoRes.status}`, "error");
      return new Response(
        JSON.stringify({ success: false, error: "Não foi possível acessar o repo destino", logs }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const destInfo = await destInfoRes.json();
    const destBranch = destInfo.default_branch;
    log(`Branch destino: ${destBranch}`, "success");

    // 4. Get dest branch ref
    log("Obtendo referência do branch destino...");
    const destRefRes = await ghDest(
      `/repos/${destOwner}/${destRepo}/git/ref/heads/${destBranch}`
    );
    if (!destRefRes.ok) {
      log("Erro ao obter ref do destino", "error");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao obter ref destino", logs }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const destRef = await destRefRes.json();
    const baseCommitSha = destRef.object.sha;

    // 5. Get all blobs from source
    log("Transferindo blobs dos arquivos...");
    const newTreeItems: any[] = [];

    for (const file of files) {
      // Get blob content from source
      const blobRes = await ghSource(
        `/repos/${sourceOwner}/${sourceRepo}/git/blobs/${file.sha}`
      );
      if (!blobRes.ok) {
        log(`Aviso: não foi possível ler ${file.path}`, "warning");
        continue;
      }
      const blobData = await blobRes.json();

      // Create blob in dest
      const newBlobRes = await ghDest(
        `/repos/${destOwner}/${destRepo}/git/blobs`,
        {
          method: "POST",
          body: JSON.stringify({
            content: blobData.content,
            encoding: "base64",
          }),
        }
      );
      if (!newBlobRes.ok) {
        log(`Aviso: não foi possível criar blob para ${file.path}`, "warning");
        continue;
      }
      const newBlob = await newBlobRes.json();

      newTreeItems.push({
        path: file.path,
        mode: file.mode,
        type: "blob",
        sha: newBlob.sha,
      });
    }
    log(`${newTreeItems.length} blobs transferidos`, "success");

    // 6. Create new tree (not based on previous - effectively replaces all content)
    log("Criando nova árvore de arquivos...");
    const newTreeRes = await ghDest(
      `/repos/${destOwner}/${destRepo}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({
          tree: newTreeItems,
        }),
      }
    );
    if (!newTreeRes.ok) {
      const errText = await newTreeRes.text();
      log(`Erro ao criar árvore: ${errText}`, "error");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar árvore", logs }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const newTree = await newTreeRes.json();
    log("Árvore criada!", "success");

    // 7. Create commit
    log("Criando commit...");
    const commitRes = await ghDest(
      `/repos/${destOwner}/${destRepo}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message: `remix: conteúdo clonado de ${sourceOwner}/${sourceRepo}`,
          tree: newTree.sha,
          parents: [baseCommitSha],
        }),
      }
    );
    if (!commitRes.ok) {
      log("Erro ao criar commit", "error");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar commit", logs }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const commit = await commitRes.json();
    log(`Commit criado: ${commit.sha.substring(0, 7)}`, "success");

    // 8. Update ref
    log("Atualizando branch...");
    const updateRefRes = await ghDest(
      `/repos/${destOwner}/${destRepo}/git/refs/heads/${destBranch}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sha: commit.sha,
          force: true,
        }),
      }
    );
    if (!updateRefRes.ok) {
      log("Erro ao atualizar branch", "error");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao atualizar branch", logs }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    log("Branch atualizado com force push!", "success");
    log("Remix completo! ✅", "success");

    return new Response(
      JSON.stringify({ success: true, logs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    log(`Erro interno: ${err.message}`, "error");
    return new Response(
      JSON.stringify({ success: false, error: err.message, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
