# Plano de Testes Manuais — Temporalidade e Revisão Espaçada (SM-2)

> Validação ponta a ponta da feature de revisão espaçada adicionada em 2026-09-26.
> Cobre o ciclo completo: criação de doc com bloco `review` → CLI `review due` → MCP `get_due_reviews` + `record_review_event` → commit → consulta do novo estado.

---

## Pré-requisitos

- `~/.local/bin/persona-memory` atualizado (rebuild ou symlink para `dist/src/cli.js`).
- Vault limpo (`git -C ~/.persona-memory status --short` vazio).
- Ao menos um documento de conhecimento no vault (`belief`, `heuristic`, `competency`, `project` ou `evidence`).

---

## Teste R0 — Sanidade: Validação de Doc Legado

Verifica que documentos sem o bloco `review` geram apenas `WARNING`, não `ERROR`.

```bash
persona-memory validate --vault ~/.persona-memory
```

**Esperado:** cada doc de tipo `belief/heuristic/competency/project/evidence` sem `persona.review` emite:
```
[WARNING] /beliefs/seu-doc.md: ... has no persona.review block (legacy doc — defaults will be applied)
```
Nenhum `[ERROR]` relacionado à ausência do bloco de revisão.

---

## Teste R0b — Validação: Campos Inválidos no Bloco `review`

Verifica que campos fora de range em `persona.review` emitem `ERROR`.

```bash
# Crie um doc temporário com mastery inválido
cat > /tmp/test-invalid-review.md <<'EOF'
---
type: belief
title: "Teste Inválido"
description: "Doc para testar validação"
status: stable
persona:
  state: current
  review:
    mastery: 6          # INVÁLIDO: > 5
    ease_factor: 1.0    # INVÁLIDO: < 1.3
    interval_days: 0    # INVÁLIDO: < 1
    next_review: "not-a-date"
    review_count: 0
    last_review: null
    review_history: []
---
Conteúdo de teste.
EOF

cp /tmp/test-invalid-review.md ~/.persona-memory/beliefs/test-invalid.md
persona-memory validate --vault ~/.persona-memory
rm ~/.persona-memory/beliefs/test-invalid.md
```

**Esperado:** erros claros para cada campo inválido:
```
[ERROR] /beliefs/test-invalid.md: persona.review.mastery must be between 0 and 5 (got 6)
[ERROR] /beliefs/test-invalid.md: persona.review.ease_factor must be ≥ 1.3 (got 1.0)
[ERROR] /beliefs/test-invalid.md: persona.review.interval_days must be ≥ 1 (got 0)
[ERROR] /beliefs/test-invalid.md: persona.review.next_review must be a valid ISO date (got "not-a-date")
```

---

## Teste R1 — Review Due: Nenhuma Revisão Pendente

```bash
persona-memory review due --vault ~/.persona-memory
```

**Esperado (vault sem bloco `review` ainda):**
```
✅ Nenhuma revisão vencida. Bom trabalho!
```

---

## Teste R2 — Adicionar Bloco `review` a um Documento

Edite um documento existente no Obsidian ou diretamente, adicionando o bloco `review` dentro de `persona:`.

Exemplo para `beliefs/modular-monolith.md`:

```yaml
persona:
  state: current
  review:
    mastery: 1
    ease_factor: 2.5
    interval_days: 1
    next_review: "2026-09-25"   # data no passado para aparecer como vencida
    review_count: 0
    last_review: null
    review_history: []
```

Commite manualmente a alteração:

```bash
git -C ~/.persona-memory add beliefs/modular-monolith.md
git -C ~/.persona-memory commit -m "feat(belief): add temporal review block"
```

---

## Teste R3 — Review Due: Doc Aparece na Lista

```bash
persona-memory review due --vault ~/.persona-memory
```

**Esperado:**
```
📚 Revisões vencidas: 1

• [belief] Modular Monolith
  /beliefs/modular-monolith.md
  Mastery: █░░░░ 1/5 | N dias atrás | Revisões: 0
```

---

## Teste R4 — CLI `review answer`: Ciclo Completo

```bash
persona-memory review answer /beliefs/modular-monolith.md good \
  --vault ~/.persona-memory
```

**Esperado:**
```
📝 Registrando revisão: /beliefs/modular-monolith.md → good ...
✅ Revisão registrada!
  Mastery: ██░░░ 2/5
  Próxima revisão: 2026-10-03 (em 7 dia(s))
  Ease factor: 2.50
  Evento: /events/2026-09-26-review-modular-monolith.md
  Commit: <hash>
```

Verifique o commit e o frontmatter atualizado:

```bash
git -C ~/.persona-memory log --oneline -3
git -C ~/.persona-memory show HEAD -- beliefs/modular-monolith.md | head -30
```

**Esperado no `show`:** o bloco `review` deve ter `mastery: 2`, `interval_days: 7`, `next_review: <data futura>`, `review_count: 1`, `ease_factor: 2.50` (inalterado para `good`), e `review_history` com 1 entrada de `outcome: good`.

---

## Teste R5 — Review Due: Doc Some da Lista Após Resposta

```bash
persona-memory review due --vault ~/.persona-memory
```

**Esperado:** o doc revisado não aparece mais (próxima revisão é futura).

---

## Teste R6 — Resposta `again`: Regressão de Mastery

```bash
# Primeiro force o next_review para hoje
# (edite o frontmatter ou aguarde a data)

persona-memory review answer /beliefs/modular-monolith.md again \
  --vault ~/.persona-memory
```

**Esperado:**
- `mastery` diminuiu 1 (ex: 2 → 1)
- `interval_days` voltou a 1
- `next_review` é amanhã
- `ease_factor` não desce abaixo de 1.3 (se aplicável)

---

## Teste R7 — Stats: Heatmap de Mastery

```bash
persona-memory review stats --vault ~/.persona-memory
```

**Esperado (com pelo menos 1 doc revisado):**
```
📊 Review Stats

  Total de documentos com revisão: 1
  Vencidas hoje:  0
  Atrasadas (>7d): 0
  Dominados (≥4): 0
  Aprendendo (≤2): 1
  Desconhecidos (0): 0

📈 Mastery por tipo:
  belief          2:1

📋 Mastery por tag:
  architecture    2:1
  monolith        1:1

📁 Mastery por projeto:
  system-design   2:1
```

---

## Teste R8 — MCP: `get_due_reviews` em Sessão de Agente

> Num harness (Antigravity, OpenCode ou Claude), com o servidor `persona-memory` declarado no config MCP.

1. Manualmente, edite um doc e ponha `next_review` no passado (igual ao Teste R2).
2. No chat, peça:
   > *"Use a tool `get_due_reviews` do servidor `persona-memory` e me diga quais documentos precisam de revisão agora."*

**Esperado:** o agente chama `get_due_reviews` e lista os docs vencidos com mastery, dias de atraso e próxima data.

---

## Teste R9 — MCP: `record_review_event` em Sessão de Agente

Continuação do Teste R8. Após o agente apresentar o doc para revisão:

1. Responda com seu outcome (ex: *"difícil, lembrei parcialmente"* → `hard`).
2. O agente deve chamar:

   ```json
   {
     "target": "/beliefs/modular-monolith.md",
     "outcome": "hard",
     "summary": "Usuário lembrou parcialmente do conceito de monolito modular"
   }
   ```

**Esperado:** o agente confirma commit, retorna o novo `next_review` e `mastery`.

Verifique no terminal:

```bash
git -C ~/.persona-memory log --oneline -3
cat ~/.persona-memory/beliefs/modular-monolith.md | grep -A 10 "review:"
```

---

## Teste R10 — Obsidian: Bloco `review` Visível e Legível + Truncamento de Histórico

Abra o vault no Obsidian e abra o doc revisado.

**Esperado:**
- O bloco `review:` aparece no frontmatter Properties do Obsidian.
- O `review_history` é legível como lista YAML.
- O corpo do documento (abaixo do frontmatter) está intacto — a reescrita via `matter.stringify` não corrompeu o conteúdo.
- Se houver mais de 10 revisões, apenas as 10 mais recentes são mantidas em `review_history` (teste fazendo 12 reviews e verificando que apenas 10 permanecem).

---

## Teste R11 — Evento Cognitivo de Review em `/events/`

```bash
ls ~/.persona-memory/events/ | grep review
cat ~/.persona-memory/events/<data>-review-*.md
```

**Esperado:** o arquivo de evento existe, contém:
- `type: cognitive_event`
- `event_kind: review` (em `persona:`)
- `outcome: <o outcome dado>`
- `mastery_before` e `mastery_after` corretos

---

## Teste R12 — Concorrência: Lock Previne Race Condition

Valida que chamadas simultâneas de review para o mesmo vault/documento não corrompem o estado nem geram commits git em conflito.

```bash
persona-memory review answer /beliefs/modular-monolith.md good --vault ~/.persona-memory & \
persona-memory review answer /beliefs/modular-monolith.md easy --vault ~/.persona-memory & \
wait
```

**Esperado:**
- Ambos os comandos finalizam com sucesso sequencial (o segundo aguarda a liberação do lock do primeiro).
- `git -C ~/.persona-memory log --oneline -2` exibe exatamente 2 commits de review.
- O frontmatter final reflete 2 reviews (`review_count: 2`) com histórico íntegro contendo as 2 entradas.

---

## Teste R13 — Rollback: Falha no Commit Reverte Documento e Índices

Valida que, caso o Git falhe no momento do commit, a mutação é abortada e todos os arquivos alterados (documento alvo, `index.md`, `log.md`) retornam intactos ao estado inicial, sem sobrar arquivos de evento órfãos.

```bash
# 1. Simular falha forçada no commit via hook nativo do Git
mkdir -p ~/.persona-memory/.git/hooks
cat > ~/.persona-memory/.git/hooks/pre-commit << 'EOF'
#!/bin/sh
echo "Simulando falha no git commit"
exit 1
EOF
chmod +x ~/.persona-memory/.git/hooks/pre-commit

# 2. Tentar registrar uma revisão (deve falhar)
persona-memory review answer /beliefs/modular-monolith.md good --vault ~/.persona-memory

# 3. Verificar que o rollback recuperou o estado original
git -C ~/.persona-memory status --short
# Deve estar limpo (sem staged ou unstaged changes)

# 4. Remover o hook de teste
rm ~/.persona-memory/.git/hooks/pre-commit
```

**Esperado:**
- O comando falha acusando erro de commit / rollback.
- O documento `/beliefs/modular-monolith.md` mantém os valores anteriores ao comando.
- O diretório `events/` não contém nenhum evento órfão gerado pela tentativa falha.
- O working tree do Git permanece limpo.

---

## Resumo dos Critérios de Sucesso

| Teste | Critério |
|-------|----------|
| R0 | Doc legado emite `WARNING`, não `ERROR` |
| R0b | Campos inválidos em `persona.review` emitem `ERROR` (mastery>5, ease_factor<1.3, interval_days<1, data inválida) |
| R1 | Lista vazia quando não há revisões vencidas |
| R2 | Frontmatter com bloco `review` é aceito pelo validate |
| R3 | CLI `review due` lista docs com `next_review ≤ hoje` |
| R4 | `review answer good` atualiza mastery, interval e commita; ease_factor mantido ≥ 1.3 |
| R5 | Doc revisado some da lista due |
| R6 | `again` regride mastery e reseta interval para 1; ease_factor mantido ≥ 1.3 |
| R7 | `review stats` exibe contadores, heatmap por tipo, por tag e por projeto corretos |
| R8 | MCP `get_due_reviews` retorna docs vencidos ao agente |
| R9 | MCP `record_review_event` atualiza doc e commita via agente |
| R10 | Conteúdo do doc intacto no Obsidian após reescrita; `review_history` truncado em 10 entradas |
| R11 | Evento `cognitive_event` de tipo `review` criado em `/events/` |
| R12 | Concorrência: chamadas paralelas são serializadas pelo lock sem conflitos ou corrupção |
| R13 | Rollback: falha em commit git via hook restaura target, index e log sem arquivos órfãos |
