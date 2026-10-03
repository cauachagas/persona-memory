# Arquitetura do persona-memory

O persona-memory é estruturado em três camadas conceituais:

1. **AI Harnesses:** Google Antigravity, OpenCode, Claude Code, Cursor comunicando-se via Model Context Protocol (MCP stdio).
2. **persona-memory engine:** Core TypeScript provendo busca ponderada com context budget, percurso de grafo de links, geração atômica de eventos cognitivos, coleta segura de evidências e auditoria Git.
3. **Persona Vault:** Armazenamento local puro em Markdown + YAML conforme especificação OKF v0.2, versionado com Git e compatível diretamente como vault do Obsidian.
