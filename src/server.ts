import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { getPersonaContext } from "./tools/context.js";
import { handleSearchMemory, handleGetMemory } from "./tools/memory.js";
import { handleRecordCognitiveEvent } from "./tools/recorder.js";

export function createPersonaServer(vaultArg?: string): McpServer {
  const config = getConfig(vaultArg);

  const server = new McpServer({
    name: "persona-memory",
    version: "0.1.0",
  });

  // Tool 1: get_persona_context
  server.tool(
    "get_persona_context",
    "Retorna um contexto compacto para inicialização da sessão com a identidade, heurísticas ativas, crenças atuais e fronteiras de aprendizado.",
    {},
    async () => {
      try {
        const context = getPersonaContext(config.vaultPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(context, null, 2),
            },
          ],
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
    "Executa busca léxica, filtragem por metadados e expansão de grafo (1-hop) em conceitos, heurísticas, crenças, projetos e eventos.",
    {
      query: z.string().describe("Termo ou palavras-chave de busca"),
      types: z.array(z.string()).optional().describe("Filtrar por tipos específicos de documentos (ex: belief, project, event)"),
      limit: z.number().optional().describe("Quantidade máxima de resultados (default 5)"),
      expand_graph: z.boolean().optional().describe("Expandir resultados conectados por links bidirecionais (default true)"),
    },
    async ({ query, types, limit, expand_graph }) => {
      try {
        const results = handleSearchMemory(config.vaultPath, query, { types, limit, expand_graph });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ results }, null, 2),
            },
          ],
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
    "Retorna o conteúdo integral e o frontmatter de um documento específico no cofre.",
    {
      path: z.string().describe("Caminho relativo do documento dentro do cofre (ex: beliefs/modular-monolith.md)"),
    },
    async ({ path: requestPath }) => {
      try {
        const memory = handleGetMemory(config.vaultPath, requestPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(memory, null, 2),
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
    "Permite ao agente registrar um evento cognitivo (aprendizado, mudança de entendimento ou evidência). O documento é criado como status: draft e registrado no log.md e Git, sem alterar crenças estáveis sem validação humana.",
    {
      title: z.string().describe("Título do evento cognitivo"),
      event_kind: z.string().describe("Tipo de evento: belief_change, learning, milestone, evidence, observation"),
      summary: z.string().describe("Resumo curto da observação"),
      details: z.string().describe("Detalhes analíticos completos, evidências e contexto"),
      related_paths: z.array(z.string()).optional().describe("Caminhos de documentos relacionados (ex: beliefs/modular-monolith.md)"),
      target: z.string().optional().describe("Caminho do documento que este evento propõe atualizar ou criar"),
      proposed_state: z.string().optional().describe("Estado proposto para o target (ex: current, superseded)"),
    },
    async (input) => {
      try {
        const result = await handleRecordCognitiveEvent(config.vaultPath, input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error in record_cognitive_event: " + err.message }],
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
