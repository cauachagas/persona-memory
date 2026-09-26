# persona-memory v0.2

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

## Ferramentas MCP (6 Tools na v0.2)

1. `get_persona_context`: briefing compacto da persona com orçamento de contexto.
2. `search_memory`: descoberta léxica ponderada + expansão de grafo 1-hop (snippets).
3. `get_memory`: leitura integral e segura de um documento específico.
4. `record_cognitive_event`: registro de evento cognitivo (`status: draft`) com commit atômico no Git. Agentes **nunca** alteram crenças vigentes de forma automática.
5. `get_due_reviews`: lista documentos com revisão espaçada vencida ou crítica (slipping). Use no início de sessão de estudo.
6. `record_review_event`: registra resultado de revisão (SM-2) atualizando agendamento no frontmatter e criando `cognitive_event` tipo `review` commitado no Git.

---

## Comandos CLI

```bash
persona-memory doctor                    # Diagnóstico de integridade do ambiente
persona-memory validate                  # Validação de conformidade OKF v0.2 + Persona
persona-memory search "WebAssembly"      # Busca na memória com orçamento de contexto
persona-memory index                     # Regeneração determinística da seção gerenciada do index.md
persona-memory serve                     # Inicialização do servidor MCP via stdio
persona-memory init                      # Inicializa novo vault OKF

# Spaced Repetition (v0.2)
persona-memory review due [--date]       # Lista revisões vencidas (mastery bar, overdue label)
persona-memory review stats              # Heatmap mastery por tipo/tag/projeto + estatísticas
persona-memory review answer <path> <again|hard|good|easy> [--summary] [--details]  # Registra revisão SM-2
```

---

## 🧠 Nova Feature: Spaced Repetition (v0.2)

O persona-memory agora suporta **repetição espaçada** (inspirado no algoritmo SM-2 do Anki) para rastrear e melhorar a retenção de conhecimento ao longo do tempo.

### Como Funciona
- Documentos de conhecimento (`belief`, `heuristic`, `competency`, `project`, `evidence`) podem ter um bloco `persona.review` no frontmatter
- O algoritmo SM-2 calcula automaticamente:
  - Próxima data de revisão baseado no resultado da revisão anterior
  - Fator de facilidade (ease factor) que aumenta com acertos e diminui com erros
  - Nível de domínio (mastery) em escala de 0-5
- Histórico de revisões é mantido no próprio documento (máximo 10 entradas)

### Fluxo de Uso com Agente
1. Agente chama `get_due_reviews` ou executa `persona-memory review due` para identificar documentos para revisão
2. Apresenta o documento ao usuário e coleta o resultado (`again`, `hard`, `good`, `easy`)
3. Agente chama `record_review_event` ou executa `persona-memory review answer` para:
   - Atualizar o frontmatter do documento com novo estado de revisão
   - Criar um `cognitive_event` do tipo `review` em `/events/` contendo `mastery_before` e `mastery_after`
   - Commitar automaticamente no Git com mensagem estruturada

### Benefícios
- **Retenção de longo prazo**: revisões espaçadas combatem a curva do esquecimento
- **Autocontido**: tudo fica no frontmatter do documento, visível no Obsidian
- **Auditável**: cada revisão gera um evento cognitivo commitado no Git
- **Customizável**: parâmetros do algoritmo são transparentes e ajustáveis
- **Safe para concorrência**: lock de arquivo impede race conditions entre processos

### Exemplo de Frontmatter após Revisões
```yaml
persona:
  state: current
  review:
    mastery: 4
    ease_factor: 2.6
    interval_days: 14
    next_review: "2026-10-10"
    review_count: 3
    last_review: "2026-09-26T15:30:00Z"
    review_history:
      - at: "2026-09-20T10:00:00Z"
        outcome: "good"
        mastery_before: 2
        mastery_after: 3
      - at: "2026-09-22T10:00:00Z"
        outcome: "hard"
        mastery_before: 3
        mastery_after: 3
      - at: "2026-09-26T15:30:00Z"
        outcome: "good"
        mastery_before: 3
        mastery_after: 4
```