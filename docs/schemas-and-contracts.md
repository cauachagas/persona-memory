# Contratos de Dados e Schemas: Persona Memory v0.3

> **Documento:** `docs/schemas-and-contracts.md`  
> **Versão:** 0.3.1  
> **Status:** Consolidado com PLAN_CLAUDE.md + content_hash (Opção B)  
> **Fonte da verdade:** `PLAN_CLAUDE.md` §4, §5, §8

---

## Convenções Globais

- **Frontmatter YAML + corpo Markdown** — OKF válido, navegável no Obsidian.
- **Referências como wikilinks** `[[path/doc]]` — nunca IDs nus.
- **`id` estável + heading `# Título` humano** — `id` é chave de máquina.
- **`content_hash` (Opção B):** `sha256(normalize(statement))[0:16]` — `normalize = lowercase → strip punctuation → remove stopwords (pt/en)`. Usado para dedup semântico cross-ID.
- **Datas:** ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Enums em snake_case** — consistência com Zod.

---

## 1. Staging Observation (`staging/observations/stg-<hindsight_observation_id>.md`)

> **Nome do arquivo = chave natural:** `stg-<hindsight_observation_id>.md` (UUID da API). Idempotência = pular se arquivo existe.
> **A API NÃO emite `source_sessions` nem `citations`.** Sessões derivadas: para cada `source_memory_ids[]`, `GET /memories/{id}` → coletar `document_id` distintos; fallback piso = `source_memory_ids.length`. Derivação registrada em `provenance.derivation`.
> **`entities` é string (vazia), não array** — parser defensivo: string → `[]`, array → usa.
> **`document_id` da observation é `null`** — nunca usar como sessão.

```yaml
---
id: "stg-5bd16909-efec-482d-8822-0204107c0f90"
source: "hindsight"
bank_id: "learner-episodic"
hindsight_observation_id: "5bd16909-efec-482d-8822-0204107c0f90"
content_hash: "a1b2c3d4e5f67890" # sha256(normalize(statement))[0:16] — dedup semântico
statement: "Prefere injetar dependências como repositório e serviço via interface/parâmetro de construtor para isolar a camada de domínio e permitir mock em testes."
proof_count: 2
source_memory_ids:
  - "c3a4e3c4-497c-4b45-af4d-c2b8c76dc7e5"
  - "51cbe767-aa21-47a3-8f04-4c83d0a590f1"
derived_session_count: 2
provenance:
  complete: true
  derivation: "document_ids distintos via GET /memories/{id} (sess-01, sess-02)"
  source_memory_ids:
    - "c3a4e3c4-497c-4b45-af4d-c2b8c76dc7e5"
    - "51cbe767-aa21-47a3-8f04-4c83d0a590f1"
hindsight_state: "valid"
hindsight_tags: []
hindsight_entities: ""
observed_at: "2026-10-03T16:39:35.619713+00:00"
hindsight_updated_at: "2026-10-03T16:40:14.075065+00:00"
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

### Campos Obrigatórios vs Opcionais

| Campo | Obrigatório | Notas |
|-------|-------------|-------|
| `id`, `source`, `bank_id`, `hindsight_observation_id`, `content_hash`, `statement`, `proof_count`, `source_memory_ids`, `derived_session_count`, `provenance`, `hindsight_state`, `hindsight_tags`, `hindsight_entities`, `observed_at`, `hindsight_updated_at`, `synced_at`, `triage`, `promotion_mode`, `audit_status` | Sim | — |
| `provenance.derivation` | Sim | String legível da derivação |
| `triage.reasons` | Não | Array de strings quando `decision ≠ pending` |

---

## 2. Evidence Record (`evidence/evi-<id>.md`)

> **`id` formato:** `evi-YYYY-MM-DD-NNN` (ex: `evi-2026-10-03-001`). Único por dia + sequência.

```yaml
---
id: "evi-2026-10-03-001"
source_staging_id: "stg-5bd16909-efec-482d-8822-0204107c0f90"
content_hash: "a1b2c3d4e5f67890" # herdado do staging (ou recalculado do statement)
concept_candidate: "dependency-injection"
statement: "Implementação deliberada de desacoplamento por construtor com foco em testabilidade."
qualification:
  proof_count: 2
  derived_session_count: 2
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

---

## 3. Learning Opportunity (`opportunities/opp-<id>.md`)

> **Top-level `opportunities/`** — NÃO em `staging/` (§4.3 PLAN_CLAUDE.md).
> **`id` formato:** `opp-YYYY-MM-DD-NNN`.

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

---

## 4. Cognitive Assessment (`assessments/assess-<id>.md`)

> **`id` formato:** `assess-YYYY-MM-DD-NNN`.

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

### Dimensões Canônicas (v0.1)

`correctness`, `autonomy`, `contextual_variation`, `transfer`, `metacognition`. Extensível via policy version.

---

## 5. Capability Definition (`capabilities/cap-<id>.md`)

> **`id` formato:** `cap-<slug>` (ex: `cap-di-constructor`). Slug = kebab-case do título.

```yaml
---
id: "cap-di-constructor"
content_hash: "a1b2c3d4e5f67890" # hash do description + required_dimensions — dedup semântico
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

# Capability: Injeção de Dependências por Construtor
Esta capability avalia se o desenvolvedor aplica o padrão de forma limpa sem recorrer a acoplamentos globais estáticos desnecessários.
```

---

## 6. Knowledge State Update (`updates/ksu-<timestamp>.md`)

> **`id` formato:** `ksu-YYYY-MM-DD-NNN` (timestamp ordenável). Imutável — nunca editar após criar.

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

---

## 7. Knowledge State Materializado (`knowledge/<learning-unit>.md`)

> **`learning-unit` = slug kebab-case** (ex: `dependency-injection`). Um arquivo por Learning Unit.
> **Sem `provisional_bloom` sintetizado no estado v0.1** — Bloom vive só na demonstração (assessment §4). Reintroduzir como `synthesized_bloom_hint` quando houver regra determinística de síntese.

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

### Status da Learning Unit

| Status | Significado |
|--------|-------------|
| `learning` | Primeira evidência, dimensões incompletas |
| `active` | Em desenvolvimento, revisões agendadas |
| `consolidated` | Todas capabilities `consolidated`, sem reviews vencidos |
| `lapsed` | Review vencido > 2× intervalo sem ação |

---

## 8. Review Outcome (`reviews/rev-<id>.md`)

> **`id` formato:** `rev-YYYY-MM-DD-<lu-slug>-NN` (ex: `rev-2026-10-03-di-01`). Imutável.

```yaml
---
id: "rev-2026-10-03-di-01"
learning_unit: "dependency-injection"
tested_capability: "cap-di-constructor"
content_hash: "a1b2c3d4e5f67890" # hash do challenge_prompt + user_response_summary
timestamp: "2026-10-03T13:00:00.000Z"
tested_bloom_level: "apply"
rubric_scores:
  technical_accuracy: 5
  autonomy: 5
  depth: 4
calculated_grade_q: 5
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

---

## 9. Learning Profile (`profile/learning-profile.md`)

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

---

## 10. Cursor de Sincronização (`.sync_cursor.json`)

> **Raiz do cofre** (`~/.persona-memory/.sync_cursor.json`). Atualização atômica pós-batch.

```json
{
  "version": 1,
  "bank_id": "learner-episodic",
  "last_synced_at": "2026-10-03T13:00:00.000Z",
  "last_observation_id": "5bd16909-efec-482d-8822-0204107c0f90",
  "synced_observations_count": 42
}
```

---

## 11. Conflict Record (`staging/conflicts/conflict-<id>.md`)

> **`id` formato:** `conflict-YYYY-MM-DD-NNN`.

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
```

---

## 12. Proposal Record (`staging/proposals/proposal-<id>.md`)

> **`id` formato:** `proposal-YYYY-MM-DD-NNN`.

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
```

---

## 13. Audit Record (`staging/audits/audit-<id>.md`)

> **Amostragem de calibração de triagem.** `id`: `audit-YYYY-MM-DD-NNN`.

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
```