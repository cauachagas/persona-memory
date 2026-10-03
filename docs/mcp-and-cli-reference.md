# Referência de Ferramentas MCP e Comandos CLI: Persona Memory v0.3

> **Documento:** `docs/mcp-and-cli-reference.md`  
> **Versão:** 0.3.1  
> **Status:** Consolidado com PLAN_CLAUDE.md

---

## 1. Ferramentas do Servidor MCP (`persona-memory`)

O servidor MCP expõe as ferramentas abaixo para qualquer agente de codificação conectado (Antigravity/`agy`, Claude Code, OpenCode, Hermes).

### 1.1 `sync_hindsight_observations`
- **Descrição:** Consulta o servidor Hindsight na porta 8888, lê observações geradas no banco `learner-episodic` desde o último watermark (`.sync_cursor.json`) e salva os arquivos em `staging/observations/stg-*.md`.
- **Inputs:**
  ```json
  {
    "bank_id": "learner-episodic", // opcional, default: learner-episodic
    "limit": 50                    // opcional, default: 50
  }
  ```
- **Retorno:**
  ```json
  {
    "synced_count": 5,
    "last_observation_id": "5bd16909-efec-482d-8822-0204107c0f90",
    "staged_files": ["staging/observations/stg-5bd16909-efec-482d-8822-0204107c0f90.md", "..."]
  }
  ```

---

### 1.2 `get_staging_queue`
- **Descrição:** Lista as observações em `staging/` aguardando triagem, informando contadores de prova, sessões distintas e estado atual.
- **Inputs:**
  ```json
  {
    "status": "pending", // opcional: pending | conflict | all (default: pending)
    "limit": 20
  }
  ```
- **Retorno:**
  ```json
  {
    "items": [
      {
        "id": "stg-5bd16909-efec-482d-8822-0204107c0f90",
        "statement": "Prefere injetar dependências...",
        "proof_count": 2,
        "derived_session_count": 2,
        "triage_decision": "pending",
        "content_hash": "a1b2c3d4e5f67890"
      }
    ],
    "total": 1
  }
  ```

---

### 1.3 `triage_staging`
- **Descrição:** Executa a política determinística de triagem (Triage Policy v0.1) sobre a fila de observações ou força uma decisão de aceitação/rejeição manual.
- **Inputs:**
  ```json
  {
    "staging_id": "stg-5bd16909-efec-482d-8822-0204107c0f90",
    "manual_decision": "promote", // opcional: auto | promote | reject | conflict
    "target_concept": "dependency-injection" // opcional
  }
  ```

---

### 1.4 `get_persona_context`
- **Descrição:** Fornece ao agente um briefing compacto da persona técnica do usuário para injeção no prompt de sistema (metas ativas, capacidades consolidadas, áreas em desenvolvimento e avisos passivos de revisões vencidas).
- **Inputs:**
  ```json
  {
    "max_chars": 4000
  }
  ```
- **Retorno:**
  ```json
  {
    "active_goals": ["system-design", "english-fluency"],
    "consolidated_capabilities": [],
    "developing_capabilities": ["cap-di-constructor"],
    "due_reviews": ["dependency-injection"],
    "profile_summary": "Foco em arquitetura distribuída testável..."
  }
  ```

---

### 1.5 `get_learning_opportunities`
- **Descrição:** Retorna oportunidades de aprendizagem detectadas pelo cruzamento de evidências recentes com o perfil do usuário.
- **Inputs:**
  ```json
  {
    "status": "pending_assessment"
  }
  ```
- **Retorno:**
  ```json
  {
    "opportunities": [
      {
        "id": "opp-2026-10-03-001",
        "evidence_ref": "[[evidence/evi-2026-10-03-001]]",
        "learning_unit_candidate": "dependency-injection",
        "signals": {"novelty": false, "difficulty": false, "goal_relevance": true, "recurrence": true},
        "status": "pending_assessment",
        "rationale": "Recorrência alta associada à meta ativa..."
      }
    ]
  }
  ```

---

### 1.6 `get_capability`
- **Descrição:** Lê a definição, dimensões requeridas e histórico de demonstrações de uma capability específica.
- **Inputs:**
  ```json
  {
    "capability_id": "cap-di-constructor"
  }
  ```

---

### 1.7 `get_knowledge_state`
- **Descrição:** Retorna o estado atual materializado de uma Learning Unit, incluindo capabilities associadas, evidências que sustentam o estado e agendamento SM-2.
- **Inputs:**
  ```json
  {
    "learning_unit": "dependency-injection"
  }
  ```

---

### 1.8 `start_socratic_probe`
- **Descrição:** Inicia uma sondagem socrática gerando o desafio e a rubrica necessária para testar uma capability vencida ou investigar uma evidência ambígua.
- **Inputs:**
  ```json
  {
    "learning_unit": "dependency-injection",
    "capability_id": "cap-di-constructor",
    "trigger_reason": "review_due" // review_due | insufficient_evidence | conflict_resolution
  }
  ```
- **Retorno:**
  ```json
  {
    "probe_id": "probe-2026-10-03-01",
    "challenge_prompt": "Qual é a desvantagem primária de usar um Service Locator estático em relação à injeção explícita de dependências pelo construtor?",
    "target_bloom_level": "apply",
    "rubric": {
      "technical_accuracy": "Correção técnica da resposta (1-5)",
      "autonomy": "Independência do raciocínio (1-5)",
      "depth": "Profundidade e contextualização (1-5)"
    }
  }
  ```

---

### 1.9 `submit_cognitive_assessment`
- **Descrição:** O agente submete sua análise avaliativa sobre uma evidência em contexto. O código valida deterministamente as dimensões, calcula a cobertura e gera uma proposta de mutação de estado quando aplicável.
- **Inputs:**
  ```json
  {
    "evidence_id": "evi-2026-10-03-001",
    "capability_id": "cap-di-constructor",
    "demonstrated_dimensions": [
      { "dimension": "correctness", "status": "demonstrated" },
      { "dimension": "autonomy", "status": "demonstrated" }
    ],
    "provisional_bloom": {
      "level": "apply",
      "confidence": 0.85,
      "basis": "Produção espontânea em código próprio sem correção"
    },
    "assistance_required": false
  }
  ```

---

### 1.10 `get_due_reviews`
- **Descrição:** Retorna as Learning Units com revisão SM-2 vencida (`next_review <= hoje`), ordenadas por atraso e prioridade do perfil.
- **Inputs:**
  ```json
  {
    "target_date": "2026-10-03", // opcional, default hoje
    "limit": 10
  }
  ```
- **Retorno:**
  ```json
  {
    "due_reviews": [
      {
        "learning_unit": "dependency-injection",
        "capability_id": "cap-di-constructor",
        "next_review": "2026-10-03",
        "days_overdue": 0,
        "priority": "high"
      }
    ]
  }
  ```

---

### 1.11 `submit_review_outcome`
- **Descrição:** Recebe as notas da rubrica atribuídas pelo agente após a resposta do usuário, calcula deterministamente o SM-2 (nota q, novo EF e intervalo I_n), atualiza o Knowledge State, registra o arquivo em `reviews/` e faz o `retain` no Hindsight para fechar o ciclo.
- **Inputs:**
  ```json
  {
    "learning_unit": "dependency-injection",
    "capability_id": "cap-di-constructor",
    "tested_bloom_level": "apply",
    "rubric_scores": {
      "technical_accuracy": 5,
      "autonomy": 5,
      "depth": 4
    },
    "user_response_summary": "Explicou claramente que o Service Locator esconde dependências e complica testes concorrentes."
  }
  ```

---

### 1.12 `run_profile_interview`
- **Descrição:** Conduz o fluxo estruturado de entrevista (inicial ou periódica) para calibrar metas, interesses e disposições no `profile/learning-profile.md`.

---

### 1.13 `validate_vault`
- **Descrição:** Valida parseabilidade OKF, wikilinks íntegros, schemas Zod e integridade do `.sync_cursor.json`.
- **Inputs:**
  ```json
  {
    "fix": false // se true, tenta auto-corrigir problemas triviais
  }
  ```
- **Retorno:** `{ "valid": true, "errors": [], "warnings": [] }`

---

## 2. Comandos do CLI (`persona-memory`)

O executável de linha de comando (`persona-memory`) oferece interface completa para terminal e scripts de automação.

```bash
# Sincronização com o Hindsight
persona-memory sync [--quiet] [--bank learner-episodic]

# Gestão de Staging
persona-memory staging list [--pending | --conflict | --all]
persona-memory staging triage [--auto] [<id>]
persona-memory staging triage <id> --decision promote --concept <nome>
persona-memory staging triage <id> --decision reject [--reason <texto>]
persona-memory staging audit <id>

# Evidências e Oportunidades
persona-memory evidence list
persona-memory opportunity list
persona-memory opportunity defer <id>

# Conhecimento e Capabilities
persona-memory capability list
persona-memory knowledge show <learning-unit>
persona-memory knowledge rebuild

# Revisões Espaçadas e SM-2
persona-memory review due
persona-memory review run <learning-unit>

# Perfil e Validação de Cofre
persona-memory profile show
persona-memory profile interview
persona-memory validate
```