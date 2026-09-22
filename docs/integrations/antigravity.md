# Integração com Google Antigravity

Adicionar ao arquivo `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "persona-memory": {
      "command": "/Users/cauachagas/.nvm/versions/node/v24.21.0/bin/persona-memory",
      "args": [
        "serve",
        "--vault",
        "/Users/cauachagas/.persona-memory"
      ]
    }
  }
}
```
