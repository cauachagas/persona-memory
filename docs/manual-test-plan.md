# Plano de Testes Manuais — persona-memory v0.1

> Validação ponta a ponta do ciclo de trajetória entre harnesses (§40 da spec).
> Estado em 2026-09-22: Testes 0–5.1 ✅ executados com sucesso.

## Pré-requisitos

- `~/.local/bin/persona-memory` instalado (symlink para `dist/src/cli.js`).
- Servidor MCP declarado no `~/.config/opencode/opencode.json` (`PERSONA_MEMORY_PRODUCER=opencode/gpt-5-codex`).
- Vault limpo (`git -C ~/.persona-memory status --short` vazio) — mutações abortam com `VAULT_DIRTY` se houver pendências (§30).

## Teste 0 — Sanidade via CLI ✅

```bash
persona-memory doctor
persona-memory validate
persona-memory search "modular"
```

Esperado: doctor com tudo ✅, validate com 0 errors, search retornando o belief com `trust` e `matched_by`.

## Teste 1 — Escrita: Harness A registra um evento ✅

A CLI não tem comando de mutação por desenho — mutação só via `record_cognitive_event` no MCP.

1. Numa sessão OpenCode, pedir ao agente:
   > *"Use a tool `record_cognitive_event` do servidor `persona-memory` para registrar: [observação real — ex. uma preferência de workflow descoberta na sessão]. Use `event_kind: learning_observation`."*
2. Confirmar no terminal:

```bash
git -C ~/.persona-memory log --oneline -3
git -C ~/.persona-memory status --short   # deve estar limpo
```

Esperado: commit `memory(event): ...` contendo `events/<data>-<slug>.md` + `log.md` + `index.md`, evento com `status: draft`.

## Teste 2 — Amnésia: Harness B recupera sem contexto ✅

1. Abrir **outra sessão limpa** (idealmente no Antigravity, sem acesso à conversa original).
2. Perguntar:
   > *"O que você sabe sobre minhas preferências de arquitetura e como aprendeu isso? Use as tools `search_memory` e `get_memory` do servidor `persona-memory`."*

Critério de sucesso: o agente recupera **belief + evento do Teste 1 + projeto relacionado**, citando os paths do vault — sem que a informação tenha passado pela conversa.

## Teste 3 — Troca de modelo ✅

Repetir o Teste 2 com outro modelo e comparar. O briefing deve ser equivalente — a memória sobrevive à troca de modelo porque vive em Markdown+Git, não nos pesos.

## Teste 4 — Edição humana de Evento no Obsidian ✅

Exercita o desacoplamento do storage: o humano edita o Markdown diretamente no Obsidian sem passar pelo MCP.

1. Abrir o evento em `events/` no Obsidian e alterar o conteúdo (ex: ferramentas/modelos utilizados).
2. Consultar a memória em outro harness/modelo.
3. **Resultado observado:** O agente recuperou o conteúdo atualizado sem que o MCP soubesse da edição prévia. O Markdown é o estado da verdade.

## Teste 5 — Promoção / Edição humana de Belief (Estado Consolidado) ✅

Exercita a regra de ouro: *evento registra trajetória, humano consolida/promove estado* (§27/§28).

Pergunta conceitual: *"O humano consegue consolidar um novo estado persistente?"*

1. Editar `beliefs/modular-monolith.md` no Obsidian adicionando regra estrita: veto a microsserviços e limite de escala para 50 engenheiros.
2. Rodar `persona-memory validate` e `persona-memory index`.
3. Commitar a alteração via Git: `git -C ~/.persona-memory commit -m "feat(belief): consolidar regra dos 50 engenheiros..."`.
4. Em harness novo, perguntar:
   > *"Qual é minha posição e regras atuais sobre arquitetura modular e microsserviços? Use search_memory e get_memory."*
5. **Resultado observado:** O agente recuperou com precisão cirúrgica a postura estrita, as duas regras claras (< 50 engenheiros e exceção única de compliance/GPU), a motivação e a referência com status estável (`status: stable`).

## Teste 5.1 — Recuperação de Trust e Proveniência do Belief ✅

Continuação do Teste 5. Exercita a distinção entre **estado consolidado** (`status: stable`), **nível de confiança** (`trust: human-verified`) e **proveniência** (`generated.by` / `verified.by`).

Pergunta conceitual: *"O sistema preserva a confiança e proveniência desse estado?"*

1. Utilizar o mesmo `beliefs/modular-monolith.md` consolidado no Teste 5.
2. Em um harness novo, perguntar:
   > *"Qual é a minha posição e regras atuais sobre arquitetura modular e microsserviços? Informe também o `trust` e a proveniência do documento utilizado. Use as tools `search_memory` e `get_memory` do servidor `persona-memory`."*
3. **Resultado observado:** O agente recuperou:

```text
Documento: /beliefs/modular-monolith.md
Status: stable
Trust: human-verified
Gerado por: human:caua
Verificado por: human:caua
```

Além disso, recuperou a regra dos **50 engenheiros**, a exceção de compliance/hardware e a fonte relacionada:
```text
/projects/antigravity-projects.md
```

**Critério de sucesso:** O agente deve recuperar o belief correto, reproduzir a regra dos **50 engenheiros** e identificar explicitamente `trust: human-verified`, juntamente com a proveniência humana (`human:caua`).

## Conclusão Arquitetural Validada

```text
                 ┌──────────────┐
                 │   Harness    │ (OpenCode / Antigravity / Claude / etc.)
                 └──────┬───────┘
                        │ MCP
                        ▼
                 ┌──────────────┐
                 │persona-memory│ (Validação, Indexação, Rastreabilidade)
                 │    Core      │
                 └──────┬───────┘
                        │
                        ▼
              ┌───────────────────┐
              │       Vault       │
              │                   │
              │ Markdown + YAML   │
              │ Links + Git       │
              └───┬───────────┬───┘
                  │           │
                  ▼           ▼
              Obsidian       Git
          (Edição Humana) (Linha Temporal)
```

1. **MCP** é a interface de interoperabilidade e mutação segura do agente.
2. **Markdown** é o estado persistente e desacoplado da verdade.
3. **Git** é a memória temporal auditável.
4. **Obsidian** é a interface humana para inspeção, edição e promoção de crenças.
5. **Core** assegura integridade de schema, links e indexação.

### Dimensões Validadas na Memória Consolidada

```text
Teste 5: Estado Consolidado
    "O humano consegue consolidar e alterar um novo estado no Obsidian?"
                    ↓
       Convicção e regras recuperadas com precisão

Teste 5.1: Confiança e Proveniência
    "O sistema preserva a rastreabilidade e confiança do estado?"
                    ↓
       trust (human-verified) + atores (human:caua) + status (stable)
```

