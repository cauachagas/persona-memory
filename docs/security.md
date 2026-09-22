# Diretrizes de Segurança

1. **Rejeição de Staged Worktree:** Se houver arquivos staged pelo usuário (`git diff --cached --quiet`), nenhuma mutação é executada para evitar commits acidentais de arquivos externos.
2. **Path Traversal Shield:** Todo caminho relativo é sanitizado e validado contra a fronteira física do cofre; symlinks que apontam para fora do vault são estritamente rejeitados.
3. **Lockfile Externo:** O lockfile de exclusão mútua reside fora do cofre em `/tmp/persona-memory-<hash>.lock` com expiração automática de stale locks.
4. **Redaction Automático:** O registro de evidências aplica regex para mascarar chaves de API, senhas, tokens e chaves privadas antes de persistir em disco.
