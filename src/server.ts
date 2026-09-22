import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { getPersonaContext } from "./tools/context.js";
import { searchTrajectory } from "./tools/search.js";
import { handleGetMemory } from "./tools/memory.js";
import { handleRecordCognitiveEvent } from "./tools/event.js";
import { handleRecordEvidence } from "./tools/evidence.js";

export function createPersonaServer(vaultArg?: string): McpServer {
  const config = getConfig(vaultArg);

  const server = new McpServer({
    name: "persona-memory",
    version: "0.1.0",
  });

  // Tool 1: get_persona_context
  server.tool(
    "get_persona_context",
    "Retorna o bootstrap de contexto compacto da sessão com a identidade, heurísticas ativas, convicções arquiteturais atuais, fronteiras de aprendizado e restrições.",
    {
      scope: z.string().optional().describe("Escopo do contexto (default: 'default')"),
      include_history: z.boolean().optional().describe("Se verdadeiro, inclui crenças superseded e eventos cognitivos aceitos"),
    },
    async ({ scope, include_history }) => {
      try {
        const context = getPersonaContext(config.vaultPath, { scope, include_history });
        return {
          content: [{ type: "text", text: JSON.stringify(context, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in get_persona_context: " + err.message }],
        };
      }
    }
  );

  // Tool 2: search_trajectory
  server.tool(
    "search_trajectory",
    "Executa busca léxica, filtragem por metadados e expansão de grafo (1-hop) respeitando o orçamento de contexto (Context Budget).",
    {
      query: z.string().describe("Termo ou palavras-chave de busca na trajetória"),
      types: z.array(z.string()).optional().describe("Filtrar por tipos específicos (ex: belief, project, event, competency, heuristic)"),
      limit: z.number().optional().describe("Quantidade máxima de resultados (default 5)"),
      max_chars: z.number().optional().describe("Orçamento máximo de caracteres retornados (default 8000)"),
      expand_graph: z.boolean().optional().describe("Expandir resultados conectados no grafo por 1-hop (default true)"),
    },
    async ({ query, types, limit, max_chars, expand_graph }) => {
      try {
        const output = searchTrajectory(config.vaultPath, query, { types, limit, max_chars, expand_graph });
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in search_trajectory: " + err.message }],
        };
      }
    }
  );

  // Tool 3: get_memory
  server.tool(
    "get_memory",
    "Retorna o conteúdo integral e o frontmatter de um documento específico no cofre.",
    {
      path: z.string().describe("Caminho relativo do documento dentro do cofre (ex: beliefs/modular-monolith.md)"),
    },
    async ({ path: requestPath }) => {
      try {
        const memory = handleGetMemory(config.vaultPath, requestPath);
        return {
          content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
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
    "Registra um evento cognitivo (aprendizado, mudança de entendimento ou evidência). O documento é criado como status: draft e persona.state: draft com commit no Git, sem modificar crenças estáveis sem ratificação humana.",
    {
      title: z.string().describe("Título do evento cognitivo"),
      event_kind: z.string().describe("Tipo de evento: belief_change, learning, milestone, evidence, observation"),
      summary: z.string().describe("Resumo curto da observação"),
      details: z.string().describe("Detalhes analíticos completos, observações e evidências"),
      related_paths: z.array(z.string()).optional().describe("Caminhos de documentos relacionados (ex: beliefs/modular-monolith.md)"),
      target: z.string().optional().describe("Caminho do documento que este evento propõe atualizar"),
      proposed_state: z.string().optional().describe("Estado proposto para o target (ex: current, superseded)"),
    },
    async (input) => {
      try {
        const result = await handleRecordCognitiveEvent(config.vaultPath, input);
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

  // Tool 5: record_evidence
  server.tool(
    "record_evidence",
    "Registra explicitamente um trecho ou artefato de evidência (logs selecionados, diffs, benchmarks). Aplica redaction automático de segredos e limite de 100KB.",
    {
      title: z.string().describe("Título da evidência"),
      content: z.string().describe("Conteúdo textual ou trecho selecionado da evidência"),
      context: z.string().optional().describe("Contexto ou objetivo da captura desta evidência"),
      related_paths: z.array(z.string()).optional().describe("Documentos relacionados a esta evidência"),
    },
    async (input) => {
      try {
        const result = await handleRecordEvidence(config.vaultPath, input);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in record_evidence: " + err.message }],
        };
      }
    }
  );

  return server;
}

export async function runServer(vaultArg?: string): Promise<void> {
  const config = getConfig(vaultArg);
  console.error("[persona-memory] Starting MCP server for vault:", config.vaultPath);

  const server = createPersonaServer(vaultArg);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[persona-memory] MCP server connected via stdio transport.");
}
