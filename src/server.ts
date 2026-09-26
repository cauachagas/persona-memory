import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { loadAllDocuments, readDocument } from "./vault.js";
import { searchMemory } from "./search.js";
import { recordCognitiveEvent, recordReviewEvent } from "./mutations.js";
import { getDueReviews, getReviewStats, getMasteryHeatmap } from "./temporal.js";

export function getPersonaContext(
  vaultRoot: string,
  options: { scope?: string[]; include_history?: boolean; max_results?: number; max_chars?: number } = {}
): string {
  const { scope = ["heuristics", "beliefs", "competencies"], include_history = false, max_results = 20, max_chars = 4000 } = options;
  const docs = loadAllDocuments(vaultRoot);

  // §22: draft, rejected e superseded ficam fora do contexto normal;
  // aparecem apenas com include_history = true.
  const isExcluded = (d: { status: string; persona?: Record<string, any> }): boolean => {
    if (include_history) return false;
    if (d.status === "draft") return true;
    const state = d.persona?.state;
    return state === "draft" || state === "superseded" || state === "rejected";
  };

  const lines: string[] = ["# Persona Context Briefing\n"];

  if (scope.includes("heuristics")) {
    lines.push("## Heuristics");
    const items = docs.filter((d) => d.type === "heuristic" && !isExcluded(d)).slice(0, max_results);
    for (const d of items) {
      lines.push("* " + d.title + ": " + d.description + " [trust: " + d.trust + "]");
    }
    lines.push("");
  }

  if (scope.includes("beliefs")) {
    lines.push("## Architectural Beliefs");
    const items = docs.filter((d) => d.type === "belief" && !isExcluded(d)).slice(0, max_results);
    for (const d of items) {
      lines.push("* " + d.title + ": " + d.description + " [trust: " + d.trust + "]");
    }
    lines.push("");
  }

  if (scope.includes("competencies")) {
    lines.push("## Competencies & Active Frontiers");
    const items = docs.filter((d) => d.type === "competency" && !isExcluded(d)).slice(0, max_results);
    for (const d of items) {
      const state = d.persona?.state || "consolidated";
      lines.push("* " + d.title + " (" + state + "): " + d.description);
    }
    lines.push("");
  }

  if (include_history) {
    const events = docs.filter((d) => d.type === "cognitive_event").slice(0, max_results);
    if (events.length > 0) {
      lines.push("## Recent Cognitive Events");
      for (const e of events) {
        lines.push("* " + e.title + " (" + (e.persona?.state || e.status) + "): " + e.description);
      }
      lines.push("");
    }
  }

  let output = lines.join("\n").trim();
  if (output.length > max_chars) {
    output = output.slice(0, max_chars) + "\n... [truncated to context budget]";
  }
  return output;
}

export function createPersonaServer(vaultArg?: string, producerArg?: string): McpServer {
  const config = getConfig(vaultArg, producerArg);

  const server = new McpServer({
    name: "persona-memory",
    version: "0.1.0",
  });

  // Tool 1: get_persona_context
  server.tool(
    "get_persona_context",
    "Fornece ao agente um briefing compacto da persona (heurísticas, crenças arquiteturais vigentes, fronteiras de competência e restrições). Respeita o orçamento de contexto.",
    {
      scope: z.array(z.string()).optional().describe("Escopos a incluir: heuristics, beliefs, competencies (default todos)"),
      include_history: z.boolean().optional().describe("Se verdadeiro, inclui crenças superseded e eventos em rascunho"),
      max_results: z.number().optional().describe("Quantidade máxima de itens por seção (default 20)"),
      max_chars: z.number().optional().describe("Teto máximo de caracteres do briefing (default 4000)"),
    },
    async (params) => {
      try {
        const text = getPersonaContext(config.vaultPath, params);
        return {
          content: [{ type: "text", text }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in get_persona_context: " + err.message }],
        };
      }
    }
  );

  // Tool 2: search_memory
  server.tool(
    "search_memory",
    "Descobre conceitos, heurísticas, crenças, projetos e eventos na memória por busca léxica ponderada e expansão de grafo (1-hop). Retorna metadados e snippets curtos sem descarregar o documento completo.",
    {
      query: z.string().describe("Termo ou palavras-chave de busca na memória"),
      types: z.array(z.string()).optional().describe("Filtrar por tipos: heuristic, belief, competency, project, cognitive_event, evidence"),
      limit: z.number().optional().describe("Quantidade máxima de resultados (default 5)"),
      expand_graph: z.boolean().optional().describe("Expandir documentos conectados por 1 hop de link (default true)"),
      max_chars: z.number().optional().describe("Orçamento de contexto para os resultados (default 8000)"),
    },
    async (params) => {
      try {
        const output = searchMemory(config.vaultPath, params.query, params);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in search_memory: " + err.message }],
        };
      }
    }
  );

  // Tool 3: get_memory
  server.tool(
    "get_memory",
    "Recupera a fonte integral e o frontmatter de um documento específico localizado via search_memory. Confinado estritamente à fronteira física do cofre.",
    {
      path: z.string().describe("Caminho bundle-relative do documento no cofre (ex: /beliefs/modular-monolith.md)"),
    },
    async ({ path: requestPath }) => {
      try {
        const doc = readDocument(config.vaultPath, requestPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  path: doc.path,
                  type: doc.type,
                  title: doc.title,
                  frontmatter: doc.frontmatter,
                  content: doc.content,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in get_memory: " + err.message }],
        };
      }
    }
  );

  // Tool 4: record_cognitive_event
  server.tool(
    "record_cognitive_event",
    "Registra um evento cognitivo na trajetória (acontecimento, aprendizado, revisão de crença ou observação). O evento é gravado como status: draft e commitado no Git, sem jamais alterar crenças vigentes de forma automática.",
    {
      title: z.string().describe("Título curto e descritivo do evento"),
      description: z.string().describe("Descrição em uma frase para o índice e metadados"),
      event_kind: z.string().describe("Tipo de evento: belief_change, belief_challenge, competency_milestone, project_lesson, learning_observation"),
      summary: z.string().describe("Resumo contextual do que ocorreu"),
      details: z.string().describe("Detalhes completos, análise, observações e conclusões"),
      target: z.string().optional().describe("Caminho bundle-relative do documento alvo (obrigatório para belief_change/challenge, milestone, lesson)"),
      related_paths: z.array(z.string()).optional().describe("Caminhos bundle-relative de documentos relacionados"),
    },
    async (input) => {
      try {
        const result = await recordCognitiveEvent(config.vaultPath, {
          ...input,
          producer: config.producer,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in record_cognitive_event: " + err.message }],
        };
      }
    }
  );

  // Tool 5: get_due_reviews
  server.tool(
    "get_due_reviews",
    "Retorna documentos de conhecimento com revisão espaçada vencida ou crítica (slipping). Use no início de uma sessão de estudo para conduzir revisão SM-2 com o usuário.",
    {
      include_slipping: z
        .boolean()
        .optional()
        .describe("Se verdadeiro, marca documentos com mais de 7 dias de atraso como urgentes"),
      max_results: z.number().optional().describe("Máximo de documentos retornados (default: 10)"),
      include_stats: z
        .boolean()
        .optional()
        .describe("Se verdadeiro, inclui estatísticas gerais de mastery no resultado"),
    },
    async (params) => {
      try {
        const due = getDueReviews(config.vaultPath);
        const limited = due.slice(0, params.max_results ?? 10);
        const stats = params.include_stats ? getReviewStats(config.vaultPath) : undefined;

        const output = {
          due_count: due.length,
          shown: limited.length,
          items: limited.map((r) => ({
            path: r.path,
            type: r.type,
            title: r.title,
            description: r.description,
            days_overdue: r.days_overdue,
            mastery: r.review.mastery,
            next_review: r.review.next_review,
            review_count: r.review.review_count,
            ...(params.include_slipping ? { urgent: r.days_overdue >= 7 } : {}),
          })),
          ...(stats ? { stats } : {}),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in get_due_reviews: " + err.message }],
        };
      }
    }
  );

  // Tool 6: record_review_event
  server.tool(
    "record_review_event",
    "Registra o resultado de uma revisão espaçada (SM-2) num documento de conhecimento: actualiza o seu agendamento no frontmatter e cria um cognitive_event de tipo review commitado no Git.",
    {
      target: z
        .string()
        .describe("Caminho bundle-relative do documento revisado (ex: /beliefs/modular-monolith.md)"),
      outcome: z
        .enum(["again", "hard", "good", "easy"])
        .describe(
          "Resultado da revisão: again=esqueci completamente | hard=difícil, lembrei parcialmente | good=lembrei bem | easy=trivial"
        ),
      summary: z
        .string()
        .describe("Breve descrição do que foi revisado e como correu a sessão"),
      details: z.string().optional().describe("Notas adicionais, dúvidas ou observações da revisão"),
    },
    async (input) => {
      try {
        const result = await recordReviewEvent(config.vaultPath, {
          ...input,
          producer: config.producer,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in record_review_event: " + err.message }],
        };
      }
    }
  );

  return server;
}

export async function runServer(vaultArg?: string, producerArg?: string): Promise<void> {
  const config = getConfig(vaultArg, producerArg);
  console.error("[persona-memory] Starting MCP stdio server for vault:", config.vaultPath);
  console.error("[persona-memory] Configured producer:", config.producer);

  const server = createPersonaServer(vaultArg, producerArg);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[persona-memory] MCP server connected via stdio transport.");
}
