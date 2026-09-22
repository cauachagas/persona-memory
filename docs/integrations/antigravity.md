# Integração com Google Antigravity

Adicionar ao arquivo `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "persona-memory": {
      "command": "/Users/cauachagas/.local/bin/persona-memory",
      "args": [
        "serve",
        "--vault",
        "/Users/cauachagas/.persona-memory"
      ],
      "env": {
        "PERSONA_MEMORY_VAULT": "/Users/cauachagas/.persona-memory",
        "PERSONA_MEMORY_PRODUCER": "antigravity/gemini-3-pro"
      }
    }
  }
}
```
