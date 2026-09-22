# persona-memory v0.1

> Sistema local, versionado e portátil para representar a trajetória cognitiva, heurísticas, crenças arquiteturais, competências, projetos e eventos relevantes de um desenvolvedor.

Padronizado no **Open Knowledge Format (OKF v0.2)**, navegável visualmente no **Obsidian** e operado por agentes via **Model Context Protocol (MCP)**.

---

## Princípio Fundamental

```text
Memória informa. Memória não governa.
```

* **Eventos** explicam a evolução.
* **Documentos** representam o estado atual.
* **Git** preserva a história material.

---

## Ferramentas MCP (4 Tools na v0.1)

1. `get_persona_context`: briefing compacto da persona com orçamento de contexto.
2. `search_memory`: descoberta léxica ponderada + expansão de grafo 1-hop (snippets).
3. `get_memory`: leitura integral e segura de um documento específico.
4. `record_cognitive_event`: registro de evento cognitivo (`status: draft`) com commit atômico no Git. Agentes **nunca** alteram crenças vigentes de forma automática.

---

## Comandos CLI

```bash
persona-memory doctor                    # Diagnóstico de integridade do ambiente
persona-memory validate                  # Validação de conformidade OKF v0.2 + Persona
persona-memory search "WebAssembly"      # Busca na memória com orçamento de contexto
persona-memory index                     # Regeneração determinística da seção gerenciada do index.md
persona-memory serve                     # Inicialização do servidor MCP via stdio
```
