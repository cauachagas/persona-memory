# PLAN.md
# Persona Memory v0.3: Arquitetura Cognitiva Unificada e Integração com Hindsight

> **Documento:** `persona-memory/PLAN.md` (Source of Truth Canônico)  
> **Status:** Consolidado pós-grill-me + Validado por probe vivo (Fase 0) + Pronto para Execução (Slice 1)  
> **Versão:** 0.3.2  
> **Autor:** Claude Code + Cauã Chagas  
> **Fundamentação Integrada:** `docs/architecture/cognitive-ontology.md` (ontologia cognitiva e princípios epistêmicos §§1–19), `docs/hindsight-integration.md`, `docs/mcp-and-cli-reference.md`, `docs/schemas-and-contracts.md`, `docs/okf-profile.md`
> **Probe:** Hindsight API `0.10.2` local em `:8888` — ver §8 (contrato real congelado em 2026-10-03)

---

## 1. Visão Epistêmica e Princípios Fundamentais

O `persona-memory` é o sistema de governança cognitiva do desenvolvedor. Ele não é um mero banco de dados de notas nem um cache de contexto para LLMs: é o **registro auditável da trajetória de aprendizagem e competência técnica** do usuário.

### 1.1 Axioma Epistêmico Central

```text
Experience ≠ Observation ≠ Evidence ≠ Assessment ≠ Knowledge State ≠ Identity
```

| Nível | Definição | Autoridade | Onde Reside |
| :--- | :--- | :--- | :--- |
| **Experience (Experiência)** | Fluxo bruto de interação (sessões, comandos, código, ferramentas, erros). | Runtime do Agente | Transcrição / IDE |
| **Observation (Observação)** | Síntese de padrões empíricos e heurísticas recorrentes extraídas pelo Hindsight. | Hindsight (`learner-episodic`) | `staging/observations/` |
| **Evidence (Evidência)** | Demonstração empírica qualificada, com proveniência completa e rastreabilidade. | Motor de Triagem / Humano | `evidence/` |
| **Assessment (Avaliação)** | Interpretação da demonstração cognitiva em dimensões específicas em uma dada evidência. | LLM do Agente via MCP | `assessments/` |
| **Knowledge State (Estado)** | Projeção materializada do domínio atual, derivada 100% de histórico e políticas determinísticas. | Código Determinístico | `knowledge/` & `updates/` |
| **Identity (Identidade)** | O sistema **não rotula** a pessoa de forma estática ("usuário júnior" ou "especialista em X"). | Soberania Humana | `profile/` |

### 1.2 Separação Estrita de Responsabilidades

```text
LLM observa a evidência; código observa o histórico; humano governa a intenção.
```

- **LLM (Agente via MCP):** Interpreta o contexto imediato da evidência, gera desafios socráticos sob demanda, propõe capabilities e conduz entrevistas. **O LLM nunca grava diretamente o Knowledge State e nunca calcula SM-2 por inferência.**
- **Código (Determinístico no `persona-memory`):** Compara históricos, valida integridade de esquemas Zod, aplica políticas de cobertura e transição de estado, calcula intervalos SM-2 e garante atomicidade e rastreabilidade Git.
- **Humano (Soberano):** Define metas no `learning-profile.md`, aprova/rejeita novas capabilities estruturais e resolve ambiguidades e conflitos.

---

## 2. Arquitetura de Runtimes e Integração Hindsight

A integração adota o modelo **Cliente-Servidor Desacoplado com Ciclo Fechado Bidirecional**.

> **Contrato congelado (Fase 0, API `0.10.2`):** `fetch` nativo, sem `@vectorize-io/hindsight-client` no `persona-memory`.
> Pull: `GET /v1/default/banks/{bank}/memories/list?type=observation&time_field=updated_at&start_date=<ISO>&limit=&offset=` → `{items[], total, limit, offset}` (sem `/list` retorna `405`).
> Retain: `POST /v1/default/banks/{bank}/memories` body `{"items":[{content, document_id}]}`.
> Bank: `PUT /v1/default/banks/{bank}` com `enable_observations`. Detalhes e shape real em §8.
> Mapeamento: **1 vault = 1 bank** (`HINDSIGHT_BANK_ID`, default `learner-episodic`; `HINDSIGHT_API_URL`, default `http://localhost:8888`).

### 2.1 Configuração, Variáveis de Ambiente e Hooks

| Variável | Descrição | Padrão |
| :--- | :--- | :--- |
| `HINDSIGHT_API_URL` | URL base do servidor Hindsight | `http://localhost:8888` |
| `HINDSIGHT_API_TOKEN` | Token secreto de autenticação da API (quando habilitado) | `""` |
| `HINDSIGHT_BANK_ID` | Identificador do banco de aprendizagem | `learner-episodic` |
| `PERSONA_MEMORY_VAULT` | Caminho absoluto do cofre Markdown | `~/.persona-memory` |
| `PERSONA_MEMORY_PRODUCER` | Identificador do agente produtor de mutações | `persona-memory/0.3` |

> **Precedência:** CLI flag > env var > default.

#### Hooks de Encerramento dos Agentes
- **Antigravity (`~/.gemini/config/hooks.json`):**
  ```json
  { "hooks": { "Stop": [{ "name": "persona-memory-sync", "command": "persona-memory sync --quiet" }] } }
  ```
- **Claude Code (`~/.claude/settings.json`):**
  ```json
  { "hooks": { "SessionEnd": [{ "name": "persona-memory-sync", "command": "persona-memory sync --quiet" }] } }
  ```

### 2.2 `observations_mission` (Briefing Canônico de Consolidação)

O parâmetro `observations_mission` substitui as regras genéricas do Hindsight ao criar/atualizar o bank `learner-episodic`, instruindo o consolidador a focar exclusivamente em competência cognitiva e heurísticas técnicas:

```text
Sintetize padrões de comportamento técnico, escolhas arquiteturais recorrentes, 
dificuldades enfrentadas, erros conceituais e heurísticas práticas aplicadas pelo desenvolvedor. 
Para cada padrão observado, registre citações exatas das falas ou trechos de código do usuário, 
o número de ocorrências empíricas (proof_count) e os identificadores de sessão distintos onde 
o comportamento se manifestou. Ignore convenções pontuais de repositórios específicos (como scripts 
de build ou variáveis de ambiente) e foque no raciocínio e competência demonstrada pelo usuário.
```

### 2.3 Fluxo de Interação e Ciclo Fechado

```mermaid
flowchart TD
    subgraph SESSAO ["Ambiente de Desenvolvimento / Agente"]
        DEV["Desenvolvedor / Coding Agent (Agy / Claude Code)"]
        HOOK["SessionEnd / Stop Hook"]
        STUDY["Skill /study (Sessão Socrática)"]
    end

    subgraph HINDSIGHT ["Hindsight Server (:8888)"]
        HBANK["Bank: learner-episodic"]
        HMISSION["observations_mission (Padrões Cognitivos)"]
        HCONSOLIDATE["Consolidation Engine"]
        HBANK --> HCONSOLIDATE
    end

    subgraph PERSONA ["Persona Memory Engine (TypeScript)"]
        SYNC["Sync Idempotente (.sync_cursor.json)"]
        TRIAGE{"Triage Determinístico (Policy v0.1)"}
        COV_POLICY{"Coverage & KSU Policy"}
        SM2_ENGINE["SM-2 Determinístico"]
        MCP_SRV["MCP Server (Stdio)"]
        CLI["CLI Tool"]
    end

    subgraph VAULT ["Cofre Markdown (~/.persona-memory)"]
        STG["staging/observations/"]
        EVI["evidence/"]
        OPP["opportunities/"]
        CAP["capabilities/"]
        ASS["assessments/"]
        KSU["updates/"]
        KNOW["knowledge/"]
        REV["reviews/"]
        PROF["profile/learning-profile.md"]
    end

    DEV -->|1. Retain bruto de código/sessão| HBANK
    HOOK -->|2. Disparo no encerramento| SYNC
    CLI -->|Sincronização manual| SYNC
    MCP_SRV -->|sync_hindsight_observations| SYNC

    SYNC -->|3. Pull observations since watermark| HBANK
    SYNC -->|4. Salva stg-*.md| STG
    STG --> TRIAGE

    TRIAGE -->|auto_promote| EVI
    TRIAGE -->|conflict / human_review| STG

    EVI --> OPP
    PROF --> OPP

    OPP -->|Agente avalia via MCP| ASS
    ASS --> COV_POLICY
    CAP --> COV_POLICY
    COV_POLICY -->|Emite mutação explícita| KSU
    KSU -->|Materializa estado| KNOW

    STUDY -->|get_due_reviews| KNOW
    STUDY -->|start_socratic_probe| ASS
    STUDY -->|submit_review_outcome| SM2_ENGINE
    SM2_ENGINE -->|Grava resultado| REV
    SM2_ENGINE -->|Atualiza next_review| KNOW
    SM2_ENGINE -->|5. Retain marco cognitivo (Ciclo Fechado)| HBANK
```

---

## 3. Topologia Física do Cofre (`~/.persona-memory`, Obsidian OKF)

Transição direta da estrutura v0.2 para a ontologia v0.3 (**Clean Break**).

> **Compatibilidade OKF (Open Knowledge Format):** todo Markdown gerado pelo `persona-memory`
> permanece um documento OKF válido e navegável no Obsidian (§3.1). Nenhum schema v0.3 quebra essa regra.

```text
~/.persona-memory/
├── .sync_cursor.json          # Watermark de sincronização com o Hindsight
├── .git/                      # Versionamento atômico local
├── index.md                   # Índice gerado/gerenciado
├── log.md                     # Registro de mutações
│
├── profile/
│   └── learning-profile.md    # Metas, prioridades e disposições governadas pelo usuário
│
├── staging/
│   ├── observations/          # Observações brutas do Hindsight (stg-*.md)
│   ├── proposals/             # Propostas de novas capabilities
│   ├── conflicts/             # Conflitos que exigem arbitragem humana
│   └── audits/                # Registros de amostragem e calibração de triagem
│
├── evidence/                  # Evidências empíricas auditadas (evi-*.md)
├── opportunities/             # Oportunidades de aprendizagem identificadas (opp-*.md)
├── capabilities/              # Capabilities canônicas ativas (cap-*.md)
├── assessments/               # Avaliações cognitivas dimensionais (assess-*.md)
├── updates/                   # Mutações explícitas e auditáveis de estado (ksu-*.md)
├── knowledge/                 # Knowledge States materializados por Learning Unit (*.md)
└── reviews/                   # Registros imutáveis de revisões socráticas SM-2 (rev-*.md)
```

### 3.1 Compatibilidade OKF (Open Knowledge Format)

Todo Markdown gerado pelo `persona-memory` é um documento OKF válido, navegável e editável no Obsidian:

1. **Frontmatter YAML + corpo Markdown** — sem HTML, sem binário; renderiza no painel Properties do Obsidian e sobrevive a reescrita via `matter.stringify`.
2. **Referências como wikilinks** `[[path/doc]]` — nunca IDs nus; grafo navegável no Obsidian.
3. **`id` estável + heading `# Título` humano** — `id` é a chave de máquina (mapeia para o `title` OKF junto ao heading); corpo sempre legível sem tooling.
4. **Namespace `persona:` reutilizado** (`docs/okf-profile.md`) — `persona.state`, `persona.event_kind` onde aplicável; estados v0.3 (`emerging/developing/consolidated`, `pending/active/...`) vivem nos campos de domínio, nunca quebram as regras 1–3.
5. **`persona-memory validate`** verifica parseabilidade OKF (warning, não error, para vaults legados).

---

## 4. Schemas e Contratos de Dados (Zod & Frontmatter)

### Convenções Globais
- **Frontmatter YAML + corpo Markdown:** OKF válido, navegável no Obsidian.
- **Referências como wikilinks:** `[[path/doc]]` — nunca IDs nus.
- **`id` estável + heading `# Título` humano:** `id` é a chave de máquina.
- **`content_hash` (Opção B):** `sha256(normalize(statement))[0:16]` com `normalize = lowercase → strip punctuation → remove stopwords (pt/en)`. Usado para deduplicação semântica cross-ID e detecção de duplicatas na triagem.
- **Datas:** ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Enums em snake_case:** Consistência com validação Zod.

### 4.1 Staging Observation (`staging/observations/stg-<hindsight_id>.md`)
> **Nome do arquivo é a chave natural:** `stg-<hindsight_observation_id>.md` (UUID retornado pela API). Idempotência = pular se o arquivo já existe.
> **A API não emite `source_sessions` nem `citations`.** Sessões são derivadas resolvendo cada `source_memory_ids[]` via `GET /memories/{id}` e coletando `document_id` distintos; se indisponível, piso = `source_memory_ids.length`. A derivação fica registrada em `provenance.derivation`.

```yaml
---
id: "stg-5bd16909-efec-482d-8822-0204107c0f90"
source: "hindsight"
bank_id: "learner-episodic"
hindsight_observation_id: "5bd16909-efec-482d-8822-0204107c0f90"
content_hash: "a1b2c3d4e5f67890" # sha256(normalize(statement))[0:16] — dedup semântico
statement: "Prefere injetar dependências como repositório e serviço via interface/parâmetro de construtor para isolar a camada de domínio e permitir mock em testes."
proof_count: 2 # campo nativo da API
source_memory_ids:
  - "c3a4e3c4-497c-4b45-af4d-c2b8c76dc7e5"
  - "51cbe767-aa21-47a3-8f04-4c83d0a590f1"
derived_session_count: 2 # derivado de document_id distintos das memórias-fonte; ver provenance.derivation
provenance:
  complete: true
  derivation: "document_ids distintos via GET /memories/{id} (sess-01, sess-02)"
  source_memory_ids:
    - "c3a4e3c4-497c-4b45-af4d-c2b8c76dc7e5"
    - "51cbe767-aa21-47a3-8f04-4c83d0a590f1"
hindsight_state: "valid" # state nativo da observation
hindsight_tags: [] # tags nativas (podem vir vazias)
hindsight_entities: "" # string nativa (parser defensivo: string -> [], array -> usa)
observed_at: "2026-10-03T16:39:35.619713+00:00" # mentioned_at da API
hindsight_updated_at: "2026-10-03T16:40:14.075065+00:00" # updated_at da API (watermark do sync)
synced_at: "2026-10-03T16:41:00.000Z"
triage:
  decision: "pending" # pending | auto_promote | human_review | conflict | rejected
  policy_version: "triage-v0.1"
  decided_at: null
  reasons: []
promotion_mode: "auto" # auto | human | socratic
audit_status: "not_sampled" # not_sampled | sampled_pass | sampled_fail
---

# Observação Importada do Hindsight
Síntese textual (`text`) da observation consolidada pelo Hindsight.
```

### 4.2 Evidence Record (`evidence/evi-<id>.md`)
```yaml
---
id: "evi-2026-10-03-001"
source_staging_id: "stg-5bd16909-efec-482d-8822-0204107c0f90"
content_hash: "a1b2c3d4e5f67890" # herdado do staging (ou recalculado do statement)
concept_candidate: "dependency-injection"
statement: "Implementação deliberada de desacoplamento por construtor com foco em testabilidade."
qualification:
  proof_count: 2 # herdado da observation
  derived_session_count: 2 # herdado do staging (derivado, ver §4.1)
  has_explicit_conflict: false
  complete_provenance: true
promotion_mode: "auto"
audit_status: "not_sampled"
verified_at: "2026-10-03T12:35:00.000Z"
tags:
  - "architecture"
  - "testing"
---

# Evidência Empírica
O desenvolvedor desacoplou dependências de infraestrutura em 2 sessões distintas.
```

### 4.3 Learning Opportunity (`opportunities/opp-<id>.md`, top-level — NÃO em `staging/`)
```yaml
---
id: "opp-2026-10-03-001"
evidence_ref: "[[evidence/evi-2026-10-03-001]]"
learning_unit_candidate: "dependency-injection"
signals:
  novelty: false
  difficulty: false
  goal_relevance: true
  recurrence: true
status: "pending_assessment" # pending_assessment | deferred | rejected | actioned
created_at: "2026-10-03T12:40:00.000Z"
rationale: "Recorrência alta associada à meta ativa de Clean Architecture no perfil."
---
```

### 4.4 Cognitive Assessment (`assessments/assess-<id>.md`)
```yaml
---
id: "assess-2026-10-03-001"
evidence_ref: "[[evidence/evi-2026-10-03-001]]"
capability_ref: "[[capabilities/cap-di-constructor]]"
demonstrated_dimensions:
  - dimension: "correctness"
    status: "demonstrated"
  - dimension: "autonomy"
    status: "demonstrated"
  - dimension: "contextual_variation"
    status: "demonstrated"
provisional_bloom:
  level: "apply" # remember | understand | apply | analyze | evaluate | create
  confidence: 0.85
  basis: "Uso espontâneo em código próprio sem necessidade de correção pelo agente."
assistance_required: false
agent_notes:
  - "Demonstrou autonomia completa."
assessed_at: "2026-10-03T12:45:00.000Z"
---
```

### 4.5 Capability Definition (`capabilities/cap-<id>.md`)
```yaml
---
id: "cap-di-constructor"
content_hash: "a1b2c3d4e5f67890" # hash de description + required_dimensions
learning_unit: "dependency-injection"
title: "Injeção de Dependências por Construtor"
description: "Capacidade de desacoplar classes e serviços recebendo dependências via construtor e interfaces."
required_dimensions:
  - "correctness"
  - "autonomy"
  - "contextual_variation"
origin:
  type: "evidence_discovery" # profile | evidence_discovery
  source_evidence: "[[evidence/evi-2026-10-03-001]]"
status: "active" # active | deprecated | merged
created_at: "2026-10-03T12:46:00.000Z"
---
```

### 4.6 Knowledge State Update (`updates/ksu-<timestamp>.md`)
```yaml
---
id: "ksu-2026-10-03-001"
learning_unit: "dependency-injection"
capability_ref: "[[capabilities/cap-di-constructor]]"
trigger:
  evidence: "[[evidence/evi-2026-10-03-001]]"
  assessment: "[[assessments/assess-2026-10-03-001]]"
policy: "capability-growth-v0.1"
previous_state: "emerging"
new_state: "developing"
change:
  added_dimensions:
    - "contextual_variation"
rationale:
  - "Demonstração espontânea e correta em múltiplos contextos observados."
created_at: "2026-10-03T12:50:00.000Z"
---
```

### 4.7 Knowledge State Materializado (`knowledge/<learning-unit>.md`)
```yaml
---
learning_unit: "dependency-injection"
title: "Injeção de Dependências"
domain: "software-architecture"
status: "active" # learning | active | consolidated | lapsed
capabilities:
  - id: "cap-di-constructor"
    content_hash: "a1b2c3d4e5f67890"
    status: "developing" # emerging | developing | consolidated
    covered_dimensions:
      - "correctness"
      - "autonomy"
      - "contextual_variation"
    gaps: []
    # ponytail: sem bloom sintetizado no estado v0.1; Bloom vive só na demonstração (assessment §4.4).
    # Reintroduzir como synthesized_bloom_hint quando houver regra determinística de síntese.
evidences:
  - "[[evidence/evi-2026-10-03-001]]"
assessments:
  - "[[assessments/assess-2026-10-03-001]]"
updates:
  - "[[updates/ksu-2026-10-03-001]]"
reviews:
  - "[[reviews/rev-2026-10-03-di-01]]"
sm2:
  repetition: 2
  interval_days: 6
  easiness_factor: 2.5
  last_reviewed: "2026-10-03"
  next_review: "2026-10-09"
last_updated: "2026-10-03T12:50:00.000Z"
---

# Injeção de Dependências

## Síntese do Conhecimento Demonstrado
O desenvolvedor aplica com segurança o desacoplamento via construtor para facilitar testes unitários com mocks.

## Próximo Marco Cognitivo
Explorar o nível **Analisar**: avaliar prós e contras entre injeção manual (pure DI) versus containers IoC.
```

### 4.8 Review Outcome (`reviews/rev-<id>.md`)
```yaml
---
id: "rev-2026-10-03-di-01"
learning_unit: "dependency-injection"
tested_capability: "cap-di-constructor"
content_hash: "a1b2c3d4e5f67890" # hash do challenge_prompt + user_response_summary
timestamp: "2026-10-03T13:00:00.000Z"
tested_bloom_level: "apply"
rubric_scores:
  technical_accuracy: 5 # 1-5
  autonomy: 5          # 1-5
  depth: 4             # 1-5
calculated_grade_q: 5  # round(0.5*5 + 0.3*5 + 0.2*4) = 5
sm2_schedule:
  previous_interval: 1
  next_interval: 6
  easiness_factor: 2.6
  next_due_date: "2026-10-09"
assessment_ref: "[[assessments/assess-2026-10-03-002]]"
hindsight_retained: true
---

# Sessão Socrática: Injeção de Dependências
Desafio apresentado, transcrição da resposta e avaliação contextual.
```

### 4.9 Learning Profile (`profile/learning-profile.md`)

> **Governança soberana do usuário.** Editável no Obsidian ou via `persona-memory profile interview`.

```yaml
---
version: "0.3.0"
last_updated: "2026-10-03T12:00:00.000Z"
goals:
  - id: "system-design"
    domain: "architecture"
    objective: "Projetar sistemas distribuídos desacoplados e testáveis."
    priority: "high"
  - id: "english-fluency"
    domain: "language"
    objective: "Manter comunicação técnica fluida e natural em discussões assíncronas."
    priority: "high"
preferences:
  learning_style: "practical"
  probe_frequency: "moderate"
dispositions:
  - topic: "build-tooling-scripts"
    status: "sufficient_for_now"
---

# Learning Profile
Documento editável diretamente pelo desenvolvedor no Obsidian ou através do comando `/study interview`.
```

### 4.10 Cursor de Sincronização (`.sync_cursor.json`)

> **Raiz do cofre** (`~/.persona-memory/.sync_cursor.json`). Atualização atômica pós-batch de ingestão.

```json
{
  "version": 1,
  "bank_id": "learner-episodic",
  "last_synced_at": "2026-10-03T13:00:00.000Z",
  "last_observation_id": "5bd16909-efec-482d-8822-0204107c0f90",
  "synced_observations_count": 42
}
```

### 4.11 Conflict Record (`staging/conflicts/conflict-<id>.md`)

> **Destino de observações com conflito explícito** (§5.1). `id`: `conflict-YYYY-MM-DD-NNN`.

```yaml
---
id: "conflict-2026-10-03-001"
staging_refs:
  - "stg-5bd16909-efec-482d-8822-0204107c0f90"
  - "stg-7f3a2b1c-9d4e-4f1a-8b2c-1e3d4f5a6b7c"
with:
  - "cap-di-constructor"
context:
  - "test-code"
  - "production-code"
status: "pending_resolution" # pending_resolution | resolved_as_exception | resolved_as_context_change | resolved_as_evolution | resolved_as_error
resolution: null
resolved_at: null
created_at: "2026-10-03T12:55:00.000Z"
---

# Conflito de Observações
Descrição da contradição comportamental observada entre diferentes contextos de código.
```

### 4.12 Proposal Record (`staging/proposals/proposal-<id>.md`)

> **Fila de propostas de novas capabilities para confirmação humana** (§6 Slice 4). `id`: `proposal-YYYY-MM-DD-NNN`.

```yaml
---
id: "proposal-2026-10-03-001"
evidence_ref: "[[evidence/evi-2026-10-03-001]]"
learning_unit_candidate: "dependency-injection"
proposed_capability:
  id: "cap-di-constructor"
  title: "Injeção de Dependências por Construtor"
  description: "Capacidade de desacoplar classes e serviços recebendo dependências via construtor e interfaces."
  required_dimensions:
    - "correctness"
    - "autonomy"
    - "contextual_variation"
status: "pending_human_confirmation" # pending_human_confirmation | accepted | rejected | merged
created_at: "2026-10-03T12:55:00.000Z"
confirmed_at: null
---

# Proposta de Nova Capability
Proposta gerada a partir da evidência empírica aguardando confirmação do usuário.
```

### 4.13 Audit Record (`staging/audits/audit-<id>.md`)

> **Amostragem para calibração da triagem determinística** (§3 e §4.1). `id`: `audit-YYYY-MM-DD-NNN`.

```yaml
---
id: "audit-2026-10-03-001"
sampled_staging_ids:
  - "stg-5bd16909-efec-482d-8822-0204107c0f90"
  - "stg-7f3a2b1c-9d4e-4f1a-8b2c-1e3d4f5a6b7c"
sampled_by: "human"
outcome: "sampled_pass" # sampled_pass | sampled_fail
notes: "Triagem correta: proof_count >= 3 e derived_session_count >= 2."
created_at: "2026-10-03T14:00:00.000Z"
---

# Registro de Auditoria de Triagem
Notas sobre a validação amostral da precisão da auto-promoção.
```

---

## 5. Políticas Determinísticas do Sistema

### 5.1 Política de Triagem (Triage Policy v0.1)

> `distinct_session_count` = `derived_session_count` do staging (§4.1).

```text
SE proof_count >= 3
  E derived_session_count >= 2
  E provenance.complete == true
  E has_explicit_conflict == false
  E is_duplicate == false
ENTÃO:
  decision = auto_promote
  destino = evidence/evi-<id>.md
SENÃO SE has_explicit_conflict == true:
  decision = conflict
  destino = staging/conflicts/conflict-<id>.md
SENÃO SE proof_count < 3 OU derived_session_count < 2:
  decision = pending_further_evidence (permanece em staging)
SENÃO:
  decision = human_review
```

### 5.2 Política de Crescimento de Capability (Capability Growth Policy v0.1)

```text
SE todas as required_dimensions possuem demonstração confirmada
  E distinct_contexts >= 2
ENTÃO:
  status = "consolidated"
SENÃO SE autonomy == true E correctness == true:
  status = "developing"
SENÃO:
  status = "emerging"
```

### 5.3 Política de Revisão SM-2 (Review Policy v0.1)

Rubrica socrática fornecida pelo LLM (A, U, D entre 1 e 5):
`q = round(0.5 * A + 0.3 * U + 0.2 * D)`

**Cálculo determinístico do SM-2:**
1. Se `q < 3` (Lapso): `repetition = 0`, `interval = 1 dia`, `EF' = max(1.3, EF - 0.2)`.
2. Se `q >= 3` (Sucesso):
   `EF' = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))`
   `I_1 = 1, I_2 = 6, I_n = round(I_{n-1} * EF') (n >= 3)`
3. **Ciclo Fechado:** `POST /v1/default/banks/{bank}/memories` com `{"items":[{content: "[COGNITIVE MILESTONE...]", context: "persona-memory-sm2-review", metadata: {source, review_id, learning_unit, grade_q}}]}` (ver §8). Sem outbox v0.1: se o `retain` falhar, grava `hindsight_retained: false` e segue (fail-open, retry no próximo sync) — nunca rollback de `rev-*.md`.

---

## 6. Roteiro Faseado de Implementação (Vertical Slices)

> **Dois trilhos, uma direção.** A ontologia cognitiva (`docs/architecture/cognitive-ontology.md` §43) define a ordem **ontológica** (conceitualmente correta:
> ontologia e histórico antes do sistema de revisão). Os **Vertical Slices** abaixo definem os incrementos
> tecnicamente entregáveis (cada slice é um ciclo funcional ponta a ponta). Este plano integra ambos:
> cada slice entrega valor funcional **respeitando** a ordem ontológica — nenhum slice constrói
> revisão antes de existir histórico auditável.
>
> **Ordem ontológica de construção** (fonte: `docs/architecture/cognitive-ontology.md` §43, referência — não é cronograma):
> `schemas → provenance/idempotência → sync → staging → triage → evidence → opportunity →
> assessment → capability+proposal → consolidation → coverage → KSU → knowledge →
> probe → review outcome → review policy/SM-2 → entrevista inicial → entrevista periódica →
> auditoria/métricas`.
> Os slices 1–7 abaixo empacotam essa ordem em incrementos testáveis; dentro de cada slice,
> implementar de cima para baixo na ordem ontológica.

### Vertical Slice 1: Observation → Evidence (Foco Imediato)
> Quanto das observations do Hindsight vira evidence útil sob triage?
- [ ] Client HTTP Hindsight (`fetch` nativo, endpoints §8) + init do bank `learner-episodic` com `enable_observations` e `observations_mission` canônica (§2.2)
- [ ] Schemas Zod staging observation + evidence (§4.1–4.2) com `content_hash` determinístico
- [ ] Cursor `.sync_cursor.json` idempotente (§4.10, §8.3 item 4): chave natural `stg-<hindsight_id>.md` + watermark `updated_at`. Executar `persona-memory sync` 3× seguidas não cria arquivos duplicados nem re-dispara triagem (ver Q3)
- [ ] Resolução de sessões distintas via `GET /v1/default/banks/{bank}/memories/{memory_id}` com cache local LRU para derivar `derived_session_count` e preencher `provenance.derivation`
- [ ] Parser defensivo para `entities` (string `""` → `[]`, array → usa, null/undefined → `[]`)
- [ ] Triage determinística (policy §5.1): `auto_promote` / `pending_further_evidence` / `human_review` / `conflict`
- [ ] CLI `sync`, `staging list`, `staging triage`, `validate`
- [ ] MCP `sync_hindsight_observations`, `get_staging_queue`, `triage_staging`, `validate_vault`
- [ ] Teste de idempotência (sync 3×) + fixtures de triage; métricas do slice: `observations_imported, staging_created, auto_promoted, human_review, rejected, conflicts, duplicates`
- [ ] Fora de escopo neste slice: assessment, SM-2

### Vertical Slice 2: Evidence → Learning Opportunity
> O sistema encontra oportunidades sem transformar tudo em obrigação?
- [ ] Schema de opportunity com sinais (`novelty, difficulty, goal_relevance, recurrence`, §4.3) — sinais são evidência para a decisão, não prioridade universal
- [ ] Detecção comparando evidências contra o Learning Profile (`profile/learning-profile.md`, §4.9); se o arquivo não existir, inicializar template padrão sem metas (`goal_relevance: false`)
- [ ] CLI `opportunity list`, `opportunity defer` + MCP `get_learning_opportunities`
- [ ] Métricas do slice: `opportunities_detected, actioned, deferred, rejected`

### Vertical Slice 3: Opportunity → Cognitive Assessment
> A sondagem acrescenta informação que a evidence não tinha?
- [ ] Schema de assessment + provisional Bloom (`level, confidence, basis`, §4.4)
- [ ] MCP `submit_cognitive_assessment` (LLM submete interpretação dimensional; código valida deterministamente — Q6)
- [ ] Gerador determinístico de Socratic Probes + MCP `start_socratic_probe` (geração de desafio contextual e rubrica sob demanda para evidência insuficiente, revisão SM-2 ou resolução de conflitos)
- [ ] Casos de teste da ontologia cognitiva (`docs/architecture/cognitive-ontology.md` §32) adaptados ao contexto de desenvolvimento:
  - *Caso A (Técnica nova/isolada):* Ex: uso pontual de nova API; sondagem verifica compreensão real de trade-offs.
  - *Caso B (Construção contextual):* Ex: injeção de dependências aplicada em múltiplos módulos; rastreia variação de contexto.
  - *Caso C (Erro corrigido):* Ex: código corrigido após sugestão do agente; distingue uso dependente de auxílio vs. autonomia genuína (`autonomy: false`).
- [ ] Métricas do slice: `assessments_run, socratic_probes, probes_avoided_due_to_sufficient_evidence, assessment_insufficient`

### Vertical Slice 4: Capability Consolidation
> Merge vs. criação: qual a frequência?
- [ ] Schema de capability + proposal (`staging/proposals/`, §4.5 e §4.12)
- [ ] Consolidação semântica com três saídas: attach a capability existente, merge de duplicatas de granularidade, ou nova proposal
- [ ] Confirmação humana obrigatória para capabilities canônicas estruturais (governança §38.3 do GPT-2)
- [ ] CLI `capability list` + gestão de propostas: `persona-memory proposal list`, `proposal approve <id>`, `proposal reject <id>`
- [ ] MCP `get_capability`
- [ ] Métricas do slice: `capabilities_created, merged, rejected, growth_events`

### Vertical Slice 5: Evidence Coverage → Knowledge State Update
> A policy evita sondagens desnecessárias sem atualizar cedo demais?
- [ ] Avaliador de cobertura de dimensões + growth policy (§5.2: `consolidated` / `developing` / `emerging`)
- [ ] Gerador de KSU (§4.6) + materialização do knowledge (`knowledge/*.md`, §4.7); ferramenta `update_knowledge_state` direta segue banida — toda mutação passa por `ksu-*.md` (Q6)
- [ ] CLI `knowledge show <learning-unit>` e `knowledge rebuild` (replay ordenado evidence → assessment → KSU com reconstrução byte-idêntica — critério de aceite, Q10)
- [ ] MCP `get_knowledge_state`

### Vertical Slice 6: Manutenção Temporal SM-2 e Ciclo Fechado
> Revisões mantêm retenção sem virar obrigação?
- [ ] Motor SM-2 determinístico + cálculo de q = round(0.5 * A + 0.3 * U + 0.2 * D) (§5.3); LLM fornece só a rubrica A, U, D
- [ ] CLI `review due`, `review run <learning-unit>`
- [ ] MCP `get_due_reviews` e `submit_review_outcome` (grava `reviews/rev-*.md`, atualiza `next_review` no knowledge)
- [ ] MCP `get_persona_context` (briefing passivo de contexto: metas ativas, capacidades e avisos discretos de revisões vencidas sem quebrar flow)
- [ ] Retain do marco cognitivo de volta no Hindsight com `context: "persona-memory-sm2-review"` (fail-open: falha grava `hindsight_retained: false` e retenta no próximo sync, nunca rollback — §8.3 item 6)
- [ ] Skill `/study` para sessões socráticas sob demanda (sem interromper flow — Q9)
- [ ] Métricas do slice: `reviews_due, completed, successes, failures`

### Vertical Slice 7: Learning Profile e Entrevista Periódica
> O perfil governa sem vazar para identidade?
- [ ] Schema de `profile/learning-profile.md` (§4.9: metas com prioridade, preferências de estilo/frequência, disposições `sufficient_for_now`)
- [ ] CLI `profile show`, `profile interview` + MCP `run_profile_interview` (calibra metas e interesses)
- [ ] Entrevista periódica de recalibração disparada por padrões novos do Hindsight (não por agenda fixa)
- [ ] Critério de aceite: metas ativas cobrem as oportunidades sem nenhum rótulo de identidade no perfil (§1.1)

### 6.1 Separações que cada slice deve preservar (fonte: `docs/architecture/cognitive-ontology.md` §§17–19)

- **Conhecimento ≠ interesse ≠ ação** (§17): `knowledge/` diz o que as evidências demonstram;
  `profile/` diz o que importa; `opportunities/` diz o que vale investigar; review policy diz quando
  rever. Lacuna sem interesse = nenhuma ação, nenhuma obrigação de estudo.
- **Contexto é atributo, não entidade** (§18): evidência num contexto não prova domínio geral,
  mas não criar uma Learning Unit por combinação contextual. Síntese na Learning Unit,
  contextos como lista nas evidências/capabilities.
- **Conflitos explícitos** (§19): `staging/conflicts/conflict-<id>.md` (§4.11) com `with[]`, `context[]`,
  `status: pending_resolution`; resoluções fechadas: `resolved_as_exception | resolved_as_context_change |
  resolved_as_evolution | resolved_as_error`. Nem todo conflito gera probe — só se houver questão
  cognitiva que valha investigar.

### 6.2 Matriz Consolidada de Ferramentas MCP e Comandos CLI

| Componente | Tipo | Entregue no Slice | Função Principal |
| :--- | :--- | :--- | :--- |
| `sync_hindsight_observations` | MCP | Slice 1 | Ingestão incremental paginada do Hindsight |
| `get_staging_queue` | MCP | Slice 1 | Listagem de observações aguardando triagem |
| `triage_staging` | MCP | Slice 1 | Execução determinística ou manual de triagem |
| `validate_vault` / `validate` | MCP & CLI | Slice 1 | Validação estrutural OKF, Zod e integridade |
| `persona-memory sync` | CLI | Slice 1 | Sincronização manual via terminal ou hook |
| `persona-memory staging list/triage` | CLI | Slice 1 | Gestão da fila de observações via terminal |
| `get_learning_opportunities` | MCP | Slice 2 | Oportunidades detectadas cruzando perfil |
| `persona-memory opportunity list/defer` | CLI | Slice 2 | Consulta e adiamento de oportunidades |
| `start_socratic_probe` | MCP | Slice 3 | Geração determinística de desafio e rubrica |
| `submit_cognitive_assessment` | MCP | Slice 3 | Submissão de análise dimensional pelo agente |
| `get_capability` | MCP | Slice 4 | Consulta a definições de capabilities ativas |
| `persona-memory capability list` | CLI | Slice 4 | Listagem de capabilities conhecidas |
| `persona-memory proposal list/approve` | CLI | Slice 4 | Governança humana sobre novas capabilities |
| `get_knowledge_state` | MCP | Slice 5 | Leitura do estado materializado da Learning Unit |
| `persona-memory knowledge show/rebuild`| CLI | Slice 5 | Inspeção e reconstrução determinística do cofre |
| `get_persona_context` | MCP | Slice 6 | Briefing de contexto e avisos passivos ao LLM |
| `get_due_reviews` | MCP | Slice 6 | Consulta de revisões SM-2 vencidas |
| `submit_review_outcome` | MCP | Slice 6 | Conclusão de revisão, cálculo SM-2 e ciclo fechado |
| `persona-memory review due/run` | CLI | Slice 6 | Execução manual de revisões no terminal |
| `run_profile_interview` | MCP | Slice 7 | Entrevista guiada conduzida pelo agente |
| `persona-memory profile show/interview` | CLI | Slice 7 | Consulta e calibração de metas pelo usuário |

---

## 7. Grill-Me: Questionamentos Críticos & Respostas Arquiteturais

Abaixo estão os 10 questionamentos mais duros sobre a arquitetura e as respostas que garantem a solidez do sistema.

### Q1: Por que não usar o próprio Hindsight para governar o Knowledge State e o SM-2?
**R:** O Hindsight é um motor probabilístico de memória baseado em grafos, vetores e LLM reflexivo. Ele é excelente para **extrair padrões e sintetizar observações do fluxo bruto**, mas não é uma autoridade epistemológica determinística. Conhecimento requer regras explícitas, auditáveis, versionadas em Git e reconstruíveis a frio sem alucinação de LLM.

### Q2: Por que rejeitar `bloom_level` ou `mastery` como propriedades de uma Learning Unit inteira?
**R:** Dizer que "o usuário tem Bloom Apply em PostgreSQL" é epistemicamente falso. O usuário pode ter *Bloom Analyze* em planos de execução `EXPLAIN` e *Bloom Remember* em `logical replication slots`. Bloom pertence à **demonstração contextual de uma capability**, nunca a um conceito genérico.

### Q3: O que impede o Hindsight de reinjetar a mesma observação centenas de vezes no cofre?
**R:** Três barreiras de contenção: (1) O arquivo de cursor `.sync_cursor.json` mantém a watermark temporal e o último observation ID importado; (2) O nome do arquivo em staging é estritamente `stg-<hindsight_id>.md`; (3) O `sync` verifica a existência do ID antes de qualquer escrita, garantindo que `sync(); sync(); sync()` seja 100% idempotente.

### Q4: O que acontece se o servidor Hindsight cair durante uma sessão do usuário?
**R:** O `persona-memory` opera localmente em modo desacoplado ("offline-first"). Consultas de contexto, revisões SM-2 e leituras do cofre continuam funcionando 100% via arquivos Markdown locais. O `sync` apenas falhará com erro transparente e tentará novamente no próximo hook ou comando CLI.

### Q5: Por que usar `fetch` nativo no TypeScript em vez de instalar dependências pesadas?
**R:** Seguindo a regra do **Ponytail / Ladder of Simplicity**: o Node 18+ possui `fetch` nativo. Fazer chamadas REST paginadas para o Hindsight exige apenas ~30 linhas de código limpo, eliminando dependências desnecessárias, problemas de versão de pacotes e complexidade em build time.

### Q6: Como o sistema garante que o LLM não altere o estado de conhecimento sem justificativa?
**R:** O LLM do agente não tem permissão de escrita arbitrária no cofre. A única ferramenta MCP disponível para ele é `submit_cognitive_assessment`, onde ele envia apenas a interpretação dimensional. O código TypeScript valida o schema, aplica a `Capability Growth Policy` e, se e somente se as dimensões forem satisfeitas, gera um arquivo imutável `updates/ksu-*.md` e materializa o `knowledge/*.md`. **Uma ferramenta `update_knowledge_state` direta é explicitamente banida** (proposta preliminar descartada): toda mutação passa por KSU.

### Q7: O que é o "Ciclo Fechado" e por que ele é crucial?
**R:** Sem o retain de volta para o Hindsight, o Hindsight continuaria inferindo que o desenvolvedor possui dificuldades ou dúvidas sobre tópicos que já foram consolidados e testados no `persona-memory`. Quando o `submit_review_outcome` roda com sucesso (q >= 3), ele grava um retain no banco `learner-episodic`, ensinando o Hindsight que aquele padrão agora é um marco consolidado.

### Q8: Como lidar com o acúmulo de arquivos Markdown com o passar dos anos?
**R:** A estrutura particionada (`staging/`, `evidence/`, `assessments/`, `updates/`, `reviews/`) permite que arquivos históricos funcionem como um log append-only. A leitura diária dos agentes acessa exclusivamente a pasta `knowledge/` (que são as projeções materializadas) e `profile/`, mantendo o consumo de I/O e tokens minúsculo mesmo em cofres com dezenas de milhares de evidências.

### Q9: Por que sessões socráticas ocorrem sob demanda via `/study` em vez de interromper o desenvolvedor durante o código?
**R:** Interrupções durante tarefas complexas quebram o estado de flow. O agente apenas injeta avisos discretos no briefing (`"2 revisões vencidas: dependency-injection, postgres-indexes"`). O desenvolvedor decide quando deseja iniciar a sessão socrática invocando `/study`.

### Q10: Como o sistema é auditável e reversível se uma avaliação de LLM for equivocada?
**R:** Toda transição de estado aponta explicitamente para `evidence_ref`, `assessment_ref` e `policy_version`. Se uma evidência for invalidada ou uma capability excluída, o comando `persona-memory knowledge rebuild` pode reprocessar toda a cadeia de eventos desde o início e reconstruir o Knowledge State exato.

---

## 8. Contrato Real Hindsight (Fase 0 — validado vivo em 2026-10-03, API `0.10.2`)

Probe executado contra servidor local em `:8888` (bank `learner-episodic`, 2 retains `sess-01`/`sess-02` → 1 observation consolidada). Sem este contrato, o Slice 1 seria chute.

### 8.1 Endpoints

| Operação | Método + path | Body / query |
| :--- | :--- | :--- |
| Criar/atualizar bank | `PUT /v1/default/banks/{bank_id}` | `{"enable_observations": true, "observations_mission": "..." (ver §2.2)}` |
| Retain | `POST /v1/default/banks/{bank_id}/memories` | `{"items":[{content, document_id, context?, metadata?, tags?}]}` → `{success, items_count, usage{}}` |
| **Pull observations** | `GET /v1/default/banks/{bank_id}/memories/list?type=observation&time_field=updated_at&start_date=<ISO>&limit=&offset=` | → `{items[], total, limit, offset}`. **Sem `/list` retorna `405`.** |
| Resolver memória-fonte | `GET /v1/default/banks/{bank_id}/memories/{memory_id}` | → memória com `document_id` (sessão) |
| Versão/features | `GET /version` | `{api_version, features{observations, ...}}` |

### 8.2 Shape real de 1 observation

```json
{
  "id": "5bd16909-efec-482d-8822-0204107c0f90",
  "text": "Prefere injetar dependências como repositório e serviço via interface/parâmetro de construtor...",
  "fact_type": "observation",
  "document_id": null,
  "mentioned_at": "2026-10-03T16:39:35.619713+00:00",
  "entities": "",
  "proof_count": 2,
  "tags": [],
  "metadata": {},
  "state": "valid",
  "updated_at": "2026-10-03T16:40:14.075065+00:00",
  "source_memory_ids": ["c3a4e3c4-...", "51cbe767-..."]
}
```

### 8.3 Divergências vs. plano original (decisões congeladas)

1. **Sem `distinct_session_count`, `source_sessions`, `citations`.** Sessões derivadas: para cada `source_memory_ids[]`, `GET /memories/{id}` → coletar `document_id` distintos; fallback piso = `source_memory_ids.length`. Registrado em `provenance.derivation` (§4.1).
2. **`document_id` da observation é `null`** — nunca usar como sessão.
3. **`entities` é string (vazia), não array** — parser defensivo: string → `[]`, array → usa.
4. **Cursor** `.sync_cursor.json` (raiz do cofre) no formato de `docs/hindsight-integration.md` (`version, bank_id, last_synced_at, last_observation_id, synced_observations_count`); watermark = `updated_at` da última observation do batch, atualização atômica pós-batch. Sem migração de vault legado neste ciclo (decisão MVP).
5. **`opportunities/` top-level**, não em `staging/` (§4.3).
6. **Milestone do ciclo fechado** via `POST .../memories` com `context: "persona-memory-sm2-review"` + `metadata{source, review_id, learning_unit, grade_q}` (§5.3: fail-open com `hindsight_retained: false` + retry no próximo sync).

---

## 9. Auditoria, Reversibilidade e Fora do MVP (fonte: `docs/architecture/cognitive-ontology.md` §§39–42)

**Cadeia de rastreabilidade** (toda transição aponta para baixo; ver Q10):
`knowledge/ → updates/ksu-*.md → assessments/ → evidence/ → staging/ → Hindsight observation → experiência`.
**Operações reversíveis** (nunca sobrescrever silenciosamente): `evidence invalidated`,
`capability deprecated/merged`, `assessment superseded`, `knowledge rebuilt` (replay ordenado).

**Fora do MVP v0.3:** classificadores especializados, métricas sofisticadas de maturity,
inferência de retenção sem evidência direta, árvores complexas de contextos, entrevista
totalmente automática sem confirmação humana, flashcards como entidade central, mapas de
conhecimento como entidade de domínio, ensemble de LLMs por decisão. Classificadores podem
vir depois como componentes auxiliares — sem substituir policies determinísticas.
