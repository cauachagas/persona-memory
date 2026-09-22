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
          "/Users/cauachagas/.nvm/versions/node/v24.21.0/bin/persona-memory",
          "serve",
          "--vault",
          "/Users/cauachagas/.persona-memory"
        ]
      }
    }
  }
}
```
