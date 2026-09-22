# Integração com OpenCode v2

Adicionar ao arquivo `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "persona-memory": {
        "type": "local",
        "command": [
          "/Users/cauachagas/.local/bin/persona-memory",
          "serve",
          "--vault",
          "/Users/cauachagas/.persona-memory"
        ],
        "environment": {
          "PERSONA_MEMORY_VAULT": "/Users/cauachagas/.persona-memory",
          "PERSONA_MEMORY_PRODUCER": "opencode/gpt-5-codex"
        },
        "timeout": 30000
      }
    }
  }
}
```

### Compatibilidade com OpenCode v1 (Legado)
Caso utilize versão anterior ao OpenCode v2:
```json
{
  "mcpServers": {
    "persona-memory": {
      "command": "persona-memory",
      "args": ["serve", "--vault", "/Users/cauachagas/.persona-memory"]
    }
  }
}
```
