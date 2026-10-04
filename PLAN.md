# PLAN.md
# Persona Memory v0.3: Arquitetura Cognitiva Unificada e Integração com Hindsight

> **Documento:** `persona-memory/PLAN.md` (Source of Truth Canônico)  
> **Status:** Consolidado pós-grill-me + Validado por probe vivo (Fase 0) + Alinhado à ontologia cognitiva + Pronto para Execução (Slice 1)  
> **Versão:** 0.3.4  
> **Autor:** Claude Code + Cauã Chagas  
> **Fundamentação Integrada:** `docs/architecture/cognitive-ontology.md` (ontologia cognitiva e princípios epistêmicos §§1–45), `docs/hindsight-integration.md`, `docs/mcp-and-cli-reference.md`, `docs/schemas-and-contracts.md`, `docs/okf-profile.md`  
> **Probe:** Hindsight API `0.10.2` local em `:8888` — ver §8 (contrato real congelado em 2026-10-03)

---

## 0. Precedência Normativa

Este plano pode ser **mais específico e mais detalhado** que a ontologia cognitiva (schemas, contratos de API, políticas versionadas, roteirização, métricas). Ele **não pode violar a base conceitual, os axiomas, as separações e as regras de governança** de `docs/architecture/cognitive-ontology.md`.

Precedência em caso de conflito:

```text
Base conceitual (axiomas, separações, axioma epistêmico, governança) → cognitive-ontology.md vence.
Detalhe de implementação (schemas, endpoints, políticas v0.x, roteirização) → PLAN.md vence.
```

**Divergências deliberadas — onde o PLAN é mais estrito que a ontologia (nenhuma reduz a exigência):**

| # | Onda ontologia | Onda PLAN | Por que não é infração |
| :--- | :--- | :--- | :--- |
| D1 | §28 lista `update_knowledge_state` | Ferramenta **banida**; toda mutação via `updates/ksu-*.md` | Reforça §15 e §38.1: atualização explícita, nunca efeito colateral oculto |
| D2 | §28 lista `start_socratic_probe` (monolítica) | `get_socratic_probe_contract` (código) + `formulate_socratic_probe` (LLM) | Materializa §13: quem decide o que sondar é o código; quem redige é o LLM |
| D3 | §27.3 `provisional_bloom.confidence: 0.74` (numérico) | `confidence: low \| medium \| high` (metadado semântico) | §16: nenhuma nota numérica arbitrária como sinal de estado |
| D4 | §27.3 usa a dimensão `contextual_use` | `contextual_variation` (nomenclatura única) | Mesma dimensão conceitual, naming consistente |
| D5 | §27.1 tem `distinct_session_count` como campo da observação | `derived_session_count` + `provenance.session_derivation` | Probe real: a API não emite o campo (§8.3.1). Piso nunca satisfaz gate (§7.1) |

**Pontos onde a ontologia está desatualizada e o PLAN prevalece** (por contrato real congelado no probe, §8.3):

| # | Onda ontologia | Onda PLAN |
| :--- | :--- | :--- |
| S1 | §26 estrutura do vault sem `opportunities/` | `opportunities/` top-level (§4.3) |
| S2 | §28 lista `start_socratic_probe` como ferramenta única | Substituída por D2 |

**Declaração adicionada à ontologia (alinhamento, não divergência):** §21.1 (Review Eligibility Gate) — SM-2 só revisa capabilities `consolidated`; `emerging`/`developing` são acompanhadas por cobertura, não por SM-2. Declaração explícita do que §21/§35/§45 já implicavam; o PLAN prevalece no detalhe (§5.4).

Nenhuma outra alteração na ontologia é necessária: o restante do PLAN especifica uma base que a ontologia não contradiz.

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

- **LLM (Agente via MCP):** Interpreta o contexto imediato da evidência, gera desafios socráticos sob demanda, propõe capabilities e conduz entrevistas. **O LLM nunca grava diretamente o Knowledge State, nunca escolhe `next_review` e nunca calcula SM-2 por inferência.**
  - **Isolamento do histórico (§3.5 e §13 da ontologia — regra inviolável):** o LLM **nunca recebe o Knowledge State histórico**. Não recebe `covered_dimensions`, `gaps`, `sm2`, nem histórico de `updates/`, `assessments/` ou `reviews/`, nem listas de capacidades candidatas escolhidas por similaridade sobre o estado acumulado. Recebe apenas: a evidência atual, o contexto mínimo para entendê-la, a **definição** das capabilities candidatas recuperadas deterministicamente pelo código (com `required_dimensions`) e as dimensões aplicáveis. **Quem compara com o histórico é o código** — o LLM não pode ser usado para "confirmar" o que já existe.
  - **Perfil não entra no assessment (§13 da ontologia):** metas e prioridades do `learning-profile.md` governam roteamento, oportunidades e políticas (lado do código), nunca a interpretação da demonstração. Separação: `Learning Profile → Opportunity/routing ("vale a pena investigar?")`; `Evidence → Assessment ("o que esta demonstração demonstra?")`. O objetivo do usuário pode decidir *se* vale investigar, nunca *o que* a evidência demonstra.
- **Código (Determinístico no `persona-memory`):** Compara históricos, valida integridade de esquemas Zod, aplica políticas de cobertura e transição de estado, recupera candidatos de capability, decide o agendamento de revisões, calcula intervalos SM-2 e garante atomicidade e rastreabilidade Git.
- **Humano (Soberano):** Define metas, preferências e disposições no `learning-profile.md`, aprova/rejeita mudanças semânticas relevantes (capabilities estruturais, novas dimensões, metas e prioridades), marca áreas como `sufficient_for_now` e resolve ambiguidades e conflitos.

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
        ROUTE{"Assessment Candidate (código)"}
        COV_POLICY{"Coverage & KSU Policy (§5.2)"}
        SM2_ENGINE["SM-2 + Agendamento (§5.3, §5.4)"]
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

    EVI --> ROUTE
    ROUTE -->|assessment candidate (§8.1)| ASS
    ROUTE -->|coverage insuficiente ou sinal relevante (§8.2)| OPP
    PROF --> OPP
    PROF -.->|Prioridades e metas| COV_POLICY
    PROF -.->|Preferências de revisão| SM2_ENGINE

    OPP -->|Agente avalia via MCP| ASS
    ASS -->|capability match + proposal se ausente| COV_POLICY
    CAP --> COV_POLICY
    COV_POLICY -->|Emite mutação explícita| KSU
    KSU -->|Materializa estado| KNOW

    STUDY -->|get_due_reviews| KNOW
    STUDY -->|get_socratic_probe_contract → formulate| ASS
    STUDY -->|submit_review_outcome| SM2_ENGINE
    SM2_ENGINE -->|Grava resultado| REV
    SM2_ENGINE -->|Atualiza next_review (§5.4)| KNOW
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
- **`content_hash` (Opção B):** `sha256(normalize(statement))[0:16]` com `normalize = lowercase → strip punctuation → remove stopwords (pt/en)`. Usado **exclusivamente** para deduplicação semântica cross-ID e detecção de duplicatas na triagem.
- **Outros hashes têm nome próprio:** capability registra `definition_hash` (§4.5) e review registra `review_hash` (§4.8), cada um com a fórmula declarada no próprio schema. Nenhum registro reusa `content_hash` para uma fórmula diferente — hash com semântica ambícida quebra a dedup (§23 da ontologia).
- **Datas:** ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Enums em snake_case:** Consistência com validação Zod.

### 4.1 Staging Observation (`staging/observations/stg-<hindsight_id>.md`)
> **Nome do arquivo é a chave natural:** `stg-<hindsight_observation_id>.md` (UUID retornado pela API). Idempotência significa **nunca duplicar**, nunca "ignorar": se o arquivo já existe e `hindsight_updated_at` é idêntico, o sync não escreve nem re-tria; se já existe e `hindsight_updated_at` **mudou**, o sync reescreve apenas os campos voláteis da origem (`hindsight_state`, `hindsight_tags`, `hindsight_entities`, `proof_count`, `hindsight_updated_at`), preservando `id`, `statement`, `first_synced_at` e o histórico de triagem, e **re-tria** sob `triage-v0.1`. O cofre jamais diverge silenciosamente da origem (§41 da ontologia: mudanças auditáveis e reversíveis, nunca sobrescritas em silêncio).
> **A API não emite `source_sessions` nem `citations`.** Sessões são derivadas resolvendo cada `source_memory_ids[]` via `GET /memories/{id}` e coletando `document_id` distintos; se alguma memória não pode ser resolvida, `derived_session_count` cai para o **piso** (`source_memory_ids.length`) e `provenance.session_derivation` passa a `floor`.
> **Guarda epistêmica:** `floor` é um **piso**, não uma contagem. Como a triagem (§5.1) usa `derived_session_count >= 2` como prova de recorrência entre sessões distintas, **auto_promoção exige `provenance.session_derivation == "exact"`**. Duas memórias da mesma sessão não podem virar "2 sessões distintas" e satisfazer o gate (`Recurrence is not mastery`, §45).
>
> **Re-observação de evidência já promovida (§41 da ontologia):** quando `hindsight_updated_at` muda em uma observation cuja versão anterior já foi `auto_promote`: (1) a nova versão é re-triada sob `triage-v0.1`; (2) `auto_promote` → a evidência anterior vai a `status: superseded` com `superseded_by` apontando a nova evidência (mesmo padrão de assessments, §4.4); (3) `conflict` → `staging/conflicts/` ganha `evi_refs` (§4.11) apontando a evidência promovida; (4) `pending_further_evidence` → a evidência permanece `current` e o staging carrega a nova triagem; (5) `rejected` por humano → a evidência vai a `status: invalidated`.
>
> **População de `flags` (§5.1):** `confidence_pipeline` vem de heuristic determinística no sync; os três flags semânticos default `false` e só um humano os ativa em v0.1 (`persona-memory staging flag <id> <flag>`) — nenhum LLM os define.

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
  session_derivation: "exact" # exact | floor — floor NÃO satisfaz o gate de recorrência (§5.1)
  derivation: "document_ids distintos via GET /memories/{id} (sess-01, sess-02)"
  source_memory_ids:
    - "c3a4e3c4-497c-4b45-af4d-c2b8c76dc7e5"
    - "51cbe767-aa21-47a3-8f04-4c83d0a590f1"
hindsight_state: "valid" # state nativo da observation
hindsight_tags: [] # tags nativas (podem vir vazias)
hindsight_entities: "" # string nativa (parser defensivo: string -> [], array -> usa)
observed_at: "2026-10-03T16:39:35.619713+00:00" # mentioned_at da API
hindsight_updated_at: "2026-10-03T16:40:14.075065+00:00" # updated_at da API (watermark do sync + detecção de re-observação)
first_synced_at: "2026-10-03T16:41:00.000Z" # quando esta observação entrou pela primeira vez (preservado em re-observação)
synced_at: "2026-10-03T16:41:00.000Z" # última sincronização que tocou este arquivo
triage:
  decision: "pending_further_evidence" # pending_further_evidence | auto_promote | human_review | conflict | rejected
  policy_version: "triage-v0.1"
  decided_at: null
  reasons: []
promotion_mode: "auto" # auto | human | socratic
audit_status: "not_sampled" # not_sampled | sampled_pass | sampled_fail
flags:
  confidence_pipeline: "normal" # normal | low — heuristic determinística no sync (§5.1)
  possible_belief_change: false # v0.1: so humanos ativam (persona-memory staging flag)
  possible_goal_change: false # v0.1: so humanos ativam
  structural_capability_impact: false # v0.1: so humanos ativam
---

# Observação Importada do Hindsight
Síntese textual (`text`) da observation consolidada pelo Hindsight.
```

### 4.2 Evidence Record (`evidence/evi-<id>.md`)
> **Contexto como atributo (§18 da ontologia):** O contexto pertence exclusivamente à demonstração empírica na evidência (`contexts[]`), nunca gerando uma Learning Unit separada por variação contextual. A síntese conceitual vive na Learning Unit; os múltiplos contextos vivem nas evidências e capabilities.
>
> **Taxonomia dos 8 Tipos de Evidência (§3.3 da ontologia):** Toda evidência qualifica a natureza da demonstração: `behavioral` (comportamento de código), `conceptual` (definição de modelos/domínio), `procedural` (fluxo de deploy/build), `linguistic` (comunicação técnica), `explanation` (justificativa de trade-offs), `application` (uso aplicado de APIs/padrões), `error_correction` (correção autônoma de falha), `comparison` (avaliação comparativa de alternativas).

```yaml
---
id: "evi-2026-10-03-001"
source_staging_id: "stg-5bd16909-efec-482d-8822-0204107c0f90"
content_hash: "a1b2c3d4e5f67890" # herdado do staging (ou recalculado do statement)
concept_candidate: "dependency-injection"
evidence_type: "application" # behavioral | conceptual | procedural | linguistic | explanation | application | error_correction | comparison (§3.3)
statement: "Implementação deliberada de desacoplamento por construtor com foco em testabilidade."
contexts: # atributo da demonstração (§18); lista de módulos, repositórios ou cenários
  - "order-service"
  - "unit-tests"
qualification:
  proof_count: 2 # herdado da observation
  derived_session_count: 2 # herdado do staging (derivado, ver §4.1)
  session_derivation: "exact" # herdado do staging; "floor" nunca é promovido automaticamente (§5.1)
  has_explicit_conflict: false
  complete_provenance: true
promotion_mode: "auto"
audit_status: "not_sampled"
status: "current" # current | superseded | invalidated — ciclo de vida da re-observação (§4.1)
superseded_by: null # aponta a evidência sucessora quando status: superseded
invalidated_reason: null # string informada pelo usuário quando status: invalidated (§38.5)
verified_at: "2026-10-03T12:35:00.000Z"
tags:
  - "architecture"
  - "testing"
---

# Evidência Empírica
O desenvolvedor desacoplou dependências de infraestrutura em 2 sessões distintas.
```

### 4.3 Learning Opportunity (`opportunities/opp-<id>.md`, top-level — NÃO em `staging/`)
> **10 Sinais Canônicos de Oportunidade (§3.4 da ontologia):** O sistema mantém 10 sinais canônicos. Cada sinal pode ter origem determinística ou semântica. O código é responsável por aplicar a política sobre os sinais.
>
> **Origem dos sinais:**
> - **Determinísticos (código):** `recurrence`, `behavior_shift`, `evidence_conflict`
> - **Semânticos (LLM interpreta):** `generalization_potential`, `apparent_gap`, `inferred_need`, `partial_demonstration`
> - **Híbridos (código + perfil):** `novelty`, `difficulty`, `goal_relevance`
>
> Nenhum sinal isolado decide o fluxo inteiro.
>
> **Entradas da detecção (§6 da ontologia):** a decisão **deve combinar** `Evidence` + `Learning Profile` + `contexto da sessão` + `histórico de oportunidades/evidências`. O campo `detected_from` registra quais entradas foram efetivamente usadas, para que o motivo da oportunidade seja auditável.
>
> **Identidade e upsert:** a chave de identidade é `learning_unit_candidate`. Uma opportunity é **atualizada**, nunca duplicada: novas evidências do mesmo `learning_unit_candidate` somam sinais e acumulam `evidence_refs` na mesma opportunity. Sem isso, uma evidência por opportunity vira ruído — que é exatamente o experimento do Slice 2 (§31 da ontologia: oportunidades relevantes vs. ruído).

```yaml
---
id: "opp-2026-10-03-001"
evidence_refs: # acumula; nunca duplica a opportunity (§6 da ontologia)
  - "[[evidence/evi-2026-10-03-001]]"
learning_unit_candidate: "dependency-injection"
detected_from: # entradas combinadas na detecção (§6 da ontologia)
  evidence: true
  learning_profile: true
  session_context: true
  opportunity_history: false
signals:
  novelty: false # técnica, biblioteca ou conceito novo não visto anteriormente
  difficulty: false # esforço prolongado, erros repetidos ou alta complexidade observada
  recurrence: true # padrão recorrente demonstrado através de múltiplos contextos
  goal_relevance: true # alinhamento explícito com metas ativas no Learning Profile
  inferred_need: false # pré-requisito técnico inferido a partir da direção do projeto
  generalization_potential: false # oportunidade de generalizar um padrão pontual para outros módulos
  apparent_gap: false # lacuna identificada entre teoria e aplicação prática
  partial_demonstration: false # uso correto com assistência ou demonstração incompleta
  behavior_shift: false # mudança significativa na abordagem habitual de resolução
  evidence_conflict: false # contradição empírica entre diferentes demonstrações
status: "pending_assessment" # pending_assessment | deferred | rejected | actioned
deferral_reason: null # string informada pelo usuário caso status: deferred (§38.5)
rejection_reason: null # string informada pelo usuário caso status: rejected (§38.5)
created_at: "2026-10-03T12:40:00.000Z"
updated_at: "2026-10-03T12:40:00.000Z"
rationale: "Recorrência alta associada à meta ativa de Clean Architecture no perfil."
---
```

### 4.4 Cognitive Assessment (`assessments/assess-<id>.md`)
> **Gate de progressão baseado em critérios observáveis (§5.2):** o assessment é sempre produzido quando há demonstração — evidência `explanation`/`comparison` pode validamente demonstrar compreensão (Bloom understand/analyze). O que `behavioral`/`application` prévia exige é a **consolidação** da capability (Growth Policy), não a validade do assessment. O campo `provisional_bloom.confidence` é metadado semântico ("low" | "medium" | "high"), **não gate determinístico**.
>
> **O assessment é obrigatório antes de qualquer mutação de estado (§8.1, §15 e §38.1 da ontologia).** O *capability match* é parte da saída do assessment — não existe um passo de "semantic analysis" separado que possa gerar KSU sem assessment, porque o estado nunca muda como efeito colateral de uma inferência sobre a evidência.
>
> **Isolamento (§3.5 e §13 da ontologia):** o assessment é produzido a partir da evidência atual + definição da capability candidata + dimensões aplicáveis. O LLM **não** recebe `covered_dimensions`, `gaps`, histórico de `updates`/`assessments`/`reviews`, `sm2` acumulado **nem metas/prioridades do `learning-profile.md`** — o perfil governa roteamento e policies (código), nunca a interpretação da demonstração. Quem decide a mudança de cobertura é o código (§5.2).
>
> **Reversibilidade (§41 da ontologia):** assessments são imutáveis. Uma reinterpretação marca o registro anterior como `superseded` apontando para o novo — nunca sobrescreve nem apaga.

```yaml
---
id: "assess-2026-10-03-001"
evidence_ref: "[[evidence/evi-2026-10-03-001]]"
capability_ref: "[[capabilities/cap-di-constructor]]"
capability_match: # §8.1 da ontologia: o match pertence ao assessment, não a um passo separado
  matched: true
  match_basis: "Demonstração explícita de desacoplamento por construtor, alinhada à definição da capability."
  new_capability_proposal: null # §10.2 + §38.3: o LLM propõe, o humano confirma (§4.12)
demonstrated_dimensions:
  - dimension: "correctness"
    status: "demonstrated"
  - dimension: "autonomy"
    status: "demonstrated"
  - dimension: "contextual_variation"
    status: "demonstrated"
provisional_bloom:
  level: "apply" # remember | understand | apply | analyze | evaluate | create
  confidence: "high" # metadado semântico: low | medium | high (não gate)
  basis: "Uso espontâneo em código próprio sem necessidade de correção pelo agente."
assistance_required: false
agent_notes:
  - "Demonstrou autonomia completa."
status: "current" # current | superseded — §41: interpretações anteriores nunca são sobrescritas em silêncio
superseded_by: null
assessed_at: "2026-10-03T12:45:00.000Z"
---
```

### 4.5 Capability Definition (`capabilities/cap-<id>.md`)
> **Teste Canônico de Granularidade (§9 da ontologia):**
> *"Se não conseguimos imaginar uma evidência observável direta capaz de demonstrar a capability, provavelmente ela está abstrata demais."* Propostas de capabilities sem ancoragem operacional observável devem ser rejeitadas ou decompostas antes de consolidação canônica.
>
> **Duas origens (§10 da ontologia):** `evidence_discovery` (§10.2, a partir de usage observável) e `profile` (§10.1, declarada na entrevista). Origem `profile` **não exige `source_evidence`** e sempre entra como `proposal` (§4.12) antes de virar canônica (§38.3).

```yaml
---
id: "cap-di-constructor"
definition_hash: "a1b2c3d4e5f67890" # sha256(description + required_dimensions)[0:16] — detecção de drift na definição
learning_unit: "dependency-injection"
title: "Injeção de Dependências por Construtor"
description: "Capacidade de desacoplar classes e serviços recebendo dependências via construtor e interfaces."
required_dimensions:
  - "correctness"
  - "autonomy"
  - "contextual_variation"
growth_policy:
  min_contexts: 2  # default v0.1 = 2 (implementation choice, not ontological)
  required_evidence_types:
    - "behavioral"
    - "application"
origin:
  type: "evidence_discovery" # profile (§10.1, vindo da entrevista) | evidence_discovery (§10.2)
  source_evidence: "[[evidence/evi-2026-10-03-001]]" # null quando type: profile
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

> Cadeia do exemplo (§4.7): `ksu-2026-10-03-001` (emerging → developing, com evidência `application`) e `ksu-2026-10-03-002` (developing → consolidated, após evidência `behavioral` completar `required_evidence_types`, §5.2).

### 4.7 Knowledge State Materializado (`knowledge/<learning-unit>.md`)
> **§16 da ontologia:** o estado é representado por capabilities, dimensões cobertas, ausentes, autonomia, evidências, avaliações e histórico de updates. Não há nota numérica de maturity e **não há maturity canônica em nível de Learning Unit** — `status` abaixo é um agregado de leitura derivado, nunca fonte de verdade. Quem decide transição é a Capability Growth Policy (§5.2), **por capability**.
>
> **Determinismo do rebuild (§41 da ontologia):** `last_updated` é o `created_at` do **último KSU aplicado**, nunca wall-clock de materialização. É isso que torna `knowledge rebuild` byte-idêntico (critério de aceite do Slice 5).
>
> **Review Eligibility Gate (§5.4, §21.1 da ontologia):** bloco `sm2:` e lista `reviews:` só existem quando a capability está `consolidated`. Em `emerging`/`developing`, `sm2: null` e `reviews: []` — SM-2 não serve para consolidar (Growth mede formação, §5.2; SM-2 mede revalidação temporal).

```yaml
---
learning_unit: "dependency-injection"
title: "Injeção de Dependências"
domain: "software-architecture"
status: "active" # [Derivado] learning | active | consolidated — agregado de leitura, NÃO fonte canônica (§16)
capabilities:
  - id: "cap-di-constructor"
    definition_hash: "a1b2c3d4e5f67890"
    status: "consolidated" # emerging | developing | consolidated — gate §5.4: só consolidated tem ciclo SM-2
    covered_dimensions:
      - "correctness"
      - "autonomy"
      - "contextual_variation"
    gaps: []
    # frontmatter = estado canônico (fonte de verdade)
    # body = projeção humana/legível derivada do estado (não autoritativa)
    # sem bloom sintetizado no estado v0.1; Bloom vive só na demonstração (assessment §4.4).
    # Reintroduzir como synthesized_bloom_hint quando houver regra determinística de síntese.
evidences:
  - "[[evidence/evi-2026-10-03-001]]" # application
  - "[[evidence/evi-2026-10-03-002]]" # behavioral — completa required_evidence_types (§5.2)
assessments:
  - "[[assessments/assess-2026-10-03-001]]"
  - "[[assessments/assess-2026-10-03-002]]"
updates:
  - "[[updates/ksu-2026-10-03-001]]" # emerging → developing
  - "[[updates/ksu-2026-10-03-002]]" # developing → consolidated
reviews:
  - "[[reviews/rev-2026-10-03-di-01]]"
sm2: # só existe porque a capability está consolidated (§5.4); em emerging/developing: null
  repetition: 2
  interval_days: 6
  easiness_factor: 2.5
  last_reviewed: "2026-10-03"
  next_review: "2026-10-09"
last_updated: "2026-10-03T12:55:00.000Z" # = created_at do último KSU aplicado (ksu-2026-10-03-002), nunca wall-clock
---

# Injeção de Dependências

## [Derivado] Síntese do Conhecimento Demonstrado
O desenvolvedor aplica com segurança o desacoplamento via construtor para facilitar testes unitários com mocks.

## [Derivado / Sugestão] Próximo Marco Cognitivo
Explorar o nível **Analisar**: avaliar prós e contras entre injeção manual (pure DI) versus containers IoC.

> **Nota:** Fronteira com Learning Opportunity: marcos pedagógicos sugeridos podem gerar opportunities; Knowledge State apenas reflete estado demonstrado.
```

### 4.8 Review Outcome (`reviews/rev-<id>.md`)
> **Ponte Categórica e Numérica (§22 da ontologia):** O LLM avalia cada dimensão testada de forma **categórica** (`demonstrated | partial | not_demonstrated`). O motor determinístico mapeia essas saídas para valores numéricos (`demonstrated = 5`, `partial = 3`, `not_demonstrated = 1`) e calcula a nota q **sem alucinações**.
>
> **Fonte única da nota:** `dimensional_outcomes` é a **única** entrada da nota. Não existe rubrica numérica paralela — se houvesse duas fontes, a decisão da policy deixaria de ser reproduzível a partir dos inputs (§21). O mapeamento dimensão → peso é fixo e versionado em §5.3.
>
> **Policy versionada (§21 da ontologia):** `review_policy_version` é obrigatório. Sem ele, a decisão de agendamento não é reproduzível.
>
> **O Review Outcome é registro separado da avaliação e do agendamento (§22 da ontologia).** Ele não altera o Knowledge State sem passar por KSU.

```yaml
---
id: "rev-2026-10-03-di-01"
learning_unit: "dependency-injection"
tested_capabilities:
  - "cap-di-constructor"
review_hash: "a1b2c3d4e5f67890" # sha256(dimensional_outcomes + tested_bloom_level + tested_capabilities)[0:16]
timestamp: "2026-10-03T13:00:00.000Z"
tested_bloom_level: "apply" # nível testado NA DEMONSTRAÇÃO, nunca um claim global (§4 da ontologia)
dimensional_outcomes: # única fonte da nota (§22 da ontologia)
  correctness: "demonstrated" # demonstrated | partial | not_demonstrated
  autonomy: "demonstrated"
  contextual_variation: "partial"
calculated_grade_q: 5 # §5.3: A=5, U=5, D=3 → round(0.5*5 + 0.3*5 + 0.2*3) = round(4.6) = 5
review_policy_version: "review-v0.1" # §21: policy determinística e versionada; decisão reproduzível a partir dos inputs
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
version: "0.3.4"
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
  probe_frequency: "moderate" # intensidade/frequência de sessões socráticas (§20) — NÃO controla revisão
  review_enabled: true # default v0.1 (§5.4): quer que competencies consolidadas continuem sendo verificadas?
  initial_interval_days: 1 # default v0.1 (§5.4): primeira revisão = created_at do KSU consolidador + este valor
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

> **Destino de observações com conflito explícito** (§5.1 e §19 da ontologia). `id`: `conflict-YYYY-MM-DD-NNN`.

```yaml
---
id: "conflict-2026-10-03-001"
staging_refs:
  - "stg-5bd16909-efec-482d-8822-0204107c0f90"
  - "stg-7f3a2b1c-9d4e-4f1a-8b2c-1e3d4f5a6b7c"
evi_refs: # evidências já promovidas envolvidas na contradição (re-observação, §4.1)
  - "[[evidence/evi-2026-10-03-001]]"
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

> **Fila de propostas de novas capabilities ou dimensões para confirmação humana** (§6 Slice 4 e §12 da ontologia). `id`: `proposal-YYYY-MM-DD-NNN`.
> **Rejeição como Feedback (§38.5 da ontologia):** Quando o usuário rejeita uma proposta informando um motivo (`rejection_reason`), a justificativa fica registrada permanentemente e o consolidador semântico é deterministamente bloqueado de re-propor a mesma capability ou dimensão a menos que surjam novas evidências empíricas distintas.

```yaml
---
id: "proposal-2026-10-03-001"
type: "capability" # capability | dimension
origin: "evidence_discovery" # evidence_discovery (§10.2) | profile (§10.1, proposta pela entrevista)
evidence_ref: "[[evidence/evi-2026-10-03-001]]" # obrigatório se origin: evidence_discovery; null se origin: profile
learning_unit_candidate: "dependency-injection"
target_capability_id: "cap-di-constructor" # obrigatório se type: dimension
proposed_capability: # presente se type: capability
  id: "cap-di-constructor"
  title: "Injeção de Dependências por Construtor"
  description: "Capacidade de desacoplar classes e serviços recebendo dependências via construtor e interfaces."
  required_dimensions:
    - "correctness"
    - "autonomy"
    - "contextual_variation"
proposed_dimension: null # ex: { name: "container_interop", description: "Interoperabilidade com containers IoC" } se type: dimension
status: "pending_human_confirmation" # pending_human_confirmation | accepted | rejected | merged
rejection_reason: null # string informada pelo usuário caso status: rejected (§38.5)
created_at: "2026-10-03T12:55:00.000Z"
confirmed_at: null
---

# Proposta Estrutural
Proposta gerada a partir da evidência empírica aguardando confirmação do usuário (via CLI ou entrevista).
```

### 4.13 Audit Record (`staging/audits/audit-<id>.md`)

> **Amostragem para calibração da triagem determinística** (§7.3 da ontologia e §4.1). `id`: `audit-YYYY-MM-DD-NNN`.

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
>
> **Guarda Epistêmica (§7 e §45 da ontologia):** `proof_count` mede estritamente recorrência comportamental observada, nunca domínio cognitivo (`Behavior ≠ cognition`). A triagem apenas promove recorrência em evidência empírica formal (`evidence/`), cabendo ao assessment posterior (§4.4) avaliar compreensão real.
>
> **Curadoria Manual e Auditoria (§29 da ontologia):** Observações em staging podem ser rejeitadas diretamente com motivo (`persona-memory staging reject <id> --reason "<motivo>"`) ou amostradas para validação de precisão (`persona-memory staging audit <id>`, gerando `staging/audits/audit-<id>.md`, §4.13).
>
> **Human review é a política de segurança, não o fallback:** todos os casos listados em §7.2 da ontologia — ambiguidade semântica relevante, provenance incompleta, possível mudança de crença, possível mudança de objetivo, nova capability com impacto estrutural, baixa confiança do pipeline e itens que não cabem nas policies atuais — vão explicitamente para `human_review`. **Nenhum sinal semântico decide sozinho**: eles entram como flags, e a decisão continua sendo do código (§3.4).
>
> **Rejeição é exclusivamente humana em v0.1:** a policy determinística **nunca** emite `rejected`. Descarte automático com base em heurística é o oposto de `Automation should be measured, sampled and reversible` (§45).

```text
SE proof_count >= 3
  E derived_session_count >= 2
  E provenance.session_derivation == "exact"   # piso não prova recorrência entre sessões distintas
  E provenance.complete == true
  E has_explicit_conflict == false
  E is_duplicate == false
ENTÃO:
  decision = auto_promote
  destino = evidence/evi-<id>.md
SENÃO SE has_explicit_conflict == true:
  decision = conflict
  destino = staging/conflicts/conflict-<id>.md
SENÃO SE proof_count < 3
  OU derived_session_count < 2
  OU provenance.session_derivation == "floor":     # pode ser resolvido em re-observação futura (§4.1)
  decision = pending_further_evidence (permanece em staging)
SENÃO SE provenance.complete == false
  OU flags.confidence_pipeline == "low"
  OU flags.possible_belief_change == true
  OU flags.possible_goal_change == true
  OU flags.structural_capability_impact == true
  OU nao_cabe_nas_policies_atuais:
  decision = human_review          # §7.2 da ontologia, caso por caso
SENÃO:
  decision = human_review
```

### 5.2 Política de Crescimento de Capability (Capability Growth Policy v0.1)

> **Fonte dos campos:** `evidence_type` vive em `evidence/` (§4.2), **nunca** no assessment. A policy lê o assessment (interpretação) e o histórico de evidências (fatos) — e é por isso que só o código pode aplicá-la (§13 da ontologia).

```text
# Pergunta 1: a demonstração é cognitivamente suficiente para ser interpretada?
SE assessment.demonstrated_dimensions NÃO cobre required_dimensions mínimas
  OU assessment.assistance_required == true
ENTÃO assessment_insufficient
     # falta informação cognitiva na própria demonstração
     # resposta: Socratic Probe (§20) — intervenção para obter informação faltante

# Pergunta 2: a cobertura acumulada satisfaz a Growth Policy?
SENÃO SE evidence_type IN {explanation, comparison}
  E NÃO existe evidence behavioral/application qualificante prévia
ENTÃO growth_insufficient
     # assessment VÁLIDO (pode demonstrar understand/analyze), mas a cobertura
     # de tipos de evidência não satisfaz o critério de consolidação
     # resposta: permanecer emerging/developing e aguardar evidência natural;
     # probe NÃO é obrigatório — só se houver questão cognitiva acionável (§20)

SENÃO SE todas required_dimensions demonstradas
  E distinct(contexts_cobertos) >= capability.growth_policy.min_contexts (default v0.1 = 2)
  E evidence_types_cobrem capability.growth_policy.required_evidence_types (default v0.1: behavioral | application)
ENTÃO consolidated
SENÃO SE autonomy E correctness → developing
SENÃO → emerging
```
**Nota:** `min_contexts` pode ser 1 para capabilities onde contexto único complexo basta.

> **Cobertura de tipos (disambiguação):** `evidence_types_cobrem` significa que a **união** dos `evidence_type` de todas as evidências qualificantes da capability contém **todos** os tipos de `required_evidence_types`. Evidência `application` sozinha não satisfaz o default `behavioral | application` — a capability fica `developing` até haver também evidência `behavioral`.

> **Contagem de contextos (determinística, §18 da ontologia):** `contexts_cobertos` é o conjunto **distinto** de `contexts[]` das evidências promovidas ligadas à capability cujo `evidence_type` está em `required_evidence_types` e cujo assessment está `current` (não `superseded`, §4.4). Um contexto conta **uma vez**, independentemente de quantas dimensões a evidência demonstra nele — contexto é atributo da demonstração, não entidade (§18).
>
> **Nenhum dos dois é estado terminal:** `assessment_insufficient` = a demonstração cognitiva é insuficiente — resposta é **sondagem** (§20), não descarte; é o único caminho que abre Socratic Probe fora de conflito e de `review_due`. `growth_insufficient` = o assessment é válido, mas a cobertura acumulada ainda não satisfaz a Growth Policy — resposta é **permanecer e aguardar** evidência natural; **não** dispara probe por si só (probe é intervenção para informação faltante, não mecanismo para forçar avanço de capability).

### 5.3 Política de Revisão SM-2 (Review Policy v0.1)

> **Ponte Dimensional-Rubrica (§22 da ontologia):** Quando a avaliação fornece `dimensional_outcomes` categóricos (`demonstrated`, `partial`, `not_demonstrated`), o motor determinístico deriva os valores numéricos e a nota q. **Fonte única:** `dimensional_outcomes`. Não existe rubrica numérica paralela — duas fontes tornariam a decisão irreproduzível (§21).
>
> **Mapeamento categórico → numérico (fixo e versionado):** `demonstrated = 5`, `partial = 3`, `not_demonstrated = 1`.
>
> **Mapeamento dimensão → peso da rubrica (fixo, escolhido pelo código, nunca pelo LLM):**
> `A (technical_accuracy) ← correctness`, `U (autonomy) ← autonomy`, `D (depth) ← contextual_variation`.

Rubrica socrática **derivada** pelo motor determinístico (nunca fornecida pelo LLM):
`q = round(0.5 * A + 0.3 * U + 0.2 * D)`

**Cálculo determinístico do SM-2:**
1. Se `q < 3` (Lapso): `repetition = 0`, `interval = 1 dia`, `EF' = max(1.3, EF - 0.2)`.
2. Se `q >= 3` (Sucesso):
   `EF' = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))`
   `I_1 = 1, I_2 = 6, I_n = round(I_{n-1} * EF') (n >= 3)`
3. **Ciclo Fechado:** `POST /v1/default/banks/{bank}/memories` com `{"items":[{content: "[COGNITIVE MILESTONE...]", context: "persona-memory-sm2-review", metadata: {source, review_id, learning_unit, grade_q}}]}` (ver §8). Sem outbox v0.1: se o `retain` falhar, grava `hindsight_retained: false` e segue (fail-open, retry no próximo sync) — nunca rollback de `rev-*.md`.

### 5.4 Política de Agendamento de Review (Review Scheduling Policy v0.1)

> **Review Eligibility Gate (§21.1 da ontologia):** SM-2 **não** serve para consolidar uma Capability — Growth (§5.2) mede formação; SM-2 mede necessidade de revalidação temporal.
>
> ```text
> SE capability.status != consolidated
> ENTÃO não criar Review Schedule, não inicializar SM-2.
>
> emerging/developing
>   → continuam acompanhadas por Evidence + Assessment + Coverage
>   → podem receber Opportunities e Socratic Probes
>   → não possuem ciclo SM-2
>
> consolidated
>   → elegível a Review
>   → Review Outcome alimenta SM-2 (§5.3)
> ```

> **Quem decide:** o **código**, a partir de `knowledge/*.md`, `capabilities/` e `learning-profile.md`. O LLM **não escolhe `next_review`** (§3.5 e §38.2 da ontologia).
>
> **Sem esta policy, SM-2 não tem porta de entrada:** `next_review` só é reescrito depois de uma revisão, então a fila nasceria vazia e o gatilho 6 do §20 (`review_due`) nunca dispararia.

```text
SE capability.status == "consolidated"
  E existe meta ativa em learning-profile.goals cujo domain cobre o learning_unit
  E NÃO existe disposition "sufficient_for_now" para o learning_unit
  E preferences.review_enabled == true
ENTÃO entrar na fila de revisão
SENÃO não entrar na fila      # §17: lacuna sem interesse = nenhuma ação, nenhuma obrigação de estudo
```

**Agendamento inicial** (primeira entrada na fila, ainda sem revisão):
```text
repetition = 0
interval_days = 0
easiness_factor = 2.5
next_review = created_at (do KSU que consolidou) + preferences.initial_interval_days (default v0.1 = 1)
```

> **Depois da primeira revisão, `next_review` vem exclusivamente da §5.3.** Nenhum campo temporal nasce de inferência do LLM. Três alavancas de soberania humana sobre manutenção e intervenção (§17): `dispositions: sufficient_for_now` (desliga revisão por learning unit), `preferences.review_enabled` (desliga revisão globalmente) e `preferences.probe_frequency` (controla **apenas** a intensidade de sessões socráticas — `off` desliga probes, **nunca** revisões). `review_enabled: true` + `probe_frequency: off` é estado válido: "retenho a competência, mas não quero provocações socráticas".

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
- [ ] Cursor `.sync_cursor.json` idempotente (§4.10, §8.3 item 4): chave natural `stg-<hindsight_id>.md` + watermark `updated_at`. Executar `persona-memory sync` 3× seguidas não cria arquivos duplicados; se `hindsight_updated_at` mudou, reescreve só os campos voláteis da origem e re-tria (§4.1, §41 da ontologia — o cofre não diverge em silêncio da origem). Ver Q3
- [ ] Resolução de sessões distintas via `GET /v1/default/banks/{bank}/memories/{memory_id}` com cache local LRU para derivar `derived_session_count` e preencher `provenance.derivation` + `provenance.session_derivation` (`exact` | `floor`)
- [ ] Parser defensivo para `entities` (string `""` → `[]`, array → usa, null/undefined → `[]`)
- [ ] Triage determinística (policy §5.1): `auto_promote` / `pending_further_evidence` / `human_review` / `conflict`. **`rejected` é decisão exclusivamente humana** — a policy nunca descarta sozinha
- [ ] CLI `sync`, `staging list`, `staging triage`, `staging reject`, `staging audit`, `validate`
- [ ] MCP `sync_hindsight_observations`, `get_staging_queue`, `triage_staging`, `validate_vault`
- [ ] Teste de idempotência (sync 3×) + fixtures de triage; métricas do slice: `observations_imported, staging_created, auto_promoted, human_review, rejected, conflicts, duplicates, promotion_precision`
- [ ] Fora de escopo neste slice: assessment, SM-2

### Vertical Slice 2: Evidence → Learning Opportunity
> O sistema encontra oportunidades sem transformar tudo em obrigação?
- [ ] **Detecção de Learning Opportunity (§6 da ontologia):** a decisão **combina** `Evidence` + `Learning Profile` + `contexto da sessão` + `histórico de oportunidades/evidências`, e registra quais entradas foram usadas em `detected_from` (§4.3)
- [ ] **Upsert por `learning_unit_candidate`** (§4.3): novas evidências do mesmo candidato somam sinais e acumulam `evidence_refs` na mesma opportunity — sem isso o slice mede ruído, não relevância (§31 da ontologia)
- [ ] Schema de opportunity com suporte aos 10 sinais canônicos da ontologia (`novelty, difficulty, recurrence, goal_relevance, inferred_need, generalization_potential, apparent_gap, partial_demonstration, behavior_shift, evidence_conflict`, §4.3) + campos de feedback `deferral_reason` e `rejection_reason` (§38.5) — sinais são evidência para a decisão, não prioridade universal
- [ ] Validação dos 8 tipos de evidência (`evidence_type: behavioral | conceptual | procedural | linguistic | explanation | application | error_correction | comparison`, §4.2)
- [ ] Detecção comparando evidências contra o Learning Profile (`profile/learning-profile.md`, §4.9); se o arquivo não existir, inicializar template padrão sem metas (`goal_relevance: false`)
- [ ] **Recuperação determinística de candidatos (§13 da ontologia):** o código recupera capabilities candidatas por similaridade textual sobre `capabilities/` e entrega ao LLM apenas **definição + `required_dimensions`** — nunca `covered_dimensions`, `gaps` ou histórico. É essa separação que impede o LLM de "confirmar" o que já existe
- [ ] **Roteamento não é artefato novo:** o fork "coverage suficiente → KSU" (§8.1) vs "coverage insuficiente → Opportunity + sondagem" (§8.2) é decidido pela **Capability Growth Policy (§5.2) depois do assessment**. Não existe `evidence_analysis/` no cofre — a ontologia não define essa entidade, e um passo separado permitiria KSU sem assessment, violando §15 e §38.1
- [ ] CLI `opportunity list`, `opportunity defer`, `opportunity reject` + MCP `get_learning_opportunities`
- [ ] Métricas do slice: `opportunities_detected, opportunities_actioned, opportunities_deferred, opportunities_rejected` (§39 da ontologia)

### Vertical Slice 3: Opportunity → Cognitive Assessment
> A sondagem acrescenta informação que a evidence não tinha?
- [ ] Schema de assessment + provisional Bloom (`level, confidence: "low"|"medium"|"high", basis`, §4.4) — **confidence é metadado semântico, não gate**; gate de progressão usa critérios observáveis (§5.2)
- [ ] MCP `submit_cognitive_assessment` (LLM submete interpretação dimensional + `capability_match`; código valida deterministamente — Q6)
- [ ] **MCP `get_assessment_candidate` (código determinístico — enforcing estrutural do §13):** entrega ao LLM a evidência atual, o `learning_unit_candidate`, as **definições** das capabilities candidatas (id, description, `required_dimensions`) e as dimensões aplicáveis. **Nunca** entrega `covered_dimensions`, `gaps`, `sm2`, histórico de `updates`/`assessments`/`reviews` **nem metas/prioridades do profile** — o perfil governa roteamento (código), nunca a interpretação da demonstração
- [ ] **MCP `get_socratic_probe_contract` (código determinístico):** define contrato do desafio — `evidence_ref`, `learning_unit`, `capability`, `target_dimension` (uma, a dimensão em teste), `target_bloom_level`, `context_summary` (derivado só da evidência atual + definição da capability), `response_schema`. **Não expõe `missing_dimensions` nem coverage acumulada** — expor a lacuna histórica contaminaria a pergunta com o histórico que o §13 proíbe
- [ ] **MCP `formulate_socratic_probe` (LLM):** recebe contrato, redige pergunta natural
- [ ] Casos de teste da ontologia cognitiva (`docs/architecture/cognitive-ontology.md` §32) adaptados ao contexto de desenvolvimento:
  - *Caso A (Técnica nova/isolada):* Ex: uso pontual de nova API; sondagem verifica compreensão real de trade-offs.
  - *Caso B (Construção contextual):* Ex: injeção de dependências aplicada em múltiplos módulos; rastreia variação de contexto.
  - *Caso C (Erro corrigido):* Ex: código corrigido após sugestão do agente; distingue uso dependente de auxílio vs. autonomia genuína (`autonomy: false`).
- [ ] Métricas do slice: `assessments_run, socratic_probes, probes_avoided_due_to_sufficient_evidence, assessment_insufficient`

### Vertical Slice 4: Capability Consolidation & Dimension Proposals
> Merge vs. criação: qual a frequência?
- [ ] Schema de capability + proposal (`staging/proposals/`, §4.5 e §4.12) com suporte a propostas estruturais de capability e de dimensão (`type: capability | dimension`, §12 da ontologia)
- [ ] Aplicação do Teste Canônico de Granularidade (§9 da ontologia): propostas de capabilities abstratas sem evidência observável direta são rejeitadas ou decompostas
- [ ] Consolidação semântica com as quatro saídas da ontologia (§11): `attach` a capability existente, `merge` de duplicatas de granularidade, `create-proposal` (capability ou dimensão) ou `ambiguous` — `ambiguous` cai em `pending_human_confirmation` (§4.12)
- [ ] Confirmação humana obrigatória para capabilities canônicas estruturais e dimensões (governança §38.3 da ontologia)
- [ ] CLI `capability list` + gestão de propostas: `persona-memory proposal list`, `proposal approve <id>`, `proposal reject <id> --reason "<motivo>"` (com regra anti-reincidência §38.5)
- [ ] MCP `get_capability`
- [ ] Métricas do slice: `capabilities_created, merged, rejected, capability_proposals, attached, human_confirmed, capability_growth_events`

### Vertical Slice 5: Evidence Coverage → Knowledge State Update
> A policy evita sondagens desnecessárias sem atualizar cedo demais?
- [ ] Avaliador de cobertura de dimensões + **growth policy capability-specific** (§5.2: usa `capability.growth_policy.min_contexts` e `required_evidence_types`, default v0.1 = 2 contexts, behavioral|application evidence) — sem gating de confidence numérico
- [ ] Gerador de KSU (§4.6) + materialização do knowledge (`knowledge/*.md`, §4.7); ferramenta `update_knowledge_state` direta segue banida — toda mutação passa por `ksu-*.md` (Q6)
- [ ] CLI `knowledge show <learning-unit>` e `knowledge rebuild` (replay ordenado evidence → assessment → KSU com reconstrução byte-idêntica — `last_updated` = `created_at` do último KSU aplicado, nunca wall-clock; assessments com `status: superseded` são ignorados no replay, nunca apagados — §41 da ontologia). Critério de aceite, Q11
- [ ] MCP `get_knowledge_state`
- [ ] Métricas do slice: `ksus_emitted, consolidated, developing, emerging, assessment_insufficient, growth_insufficient` (§5.2: `growth_insufficient` = assessment válido, cobertura insuficiente — sem probe obrigatório)

### Vertical Slice 6: Manutenção Temporal SM-2 e Ciclo Fechado
> Revisões mantêm retenção sem virar obrigação?
- [ ] Motor SM-2 determinístico com avaliações dimensionais **categóricas** (`demonstrated | partial | not_demonstrated`, §22) como única fonte da nota; A/U/D e q são **derivados** pelo mapeamento fixo da §5.3, nunca informados pelo LLM
- [ ] **Review Eligibility Gate + Política de agendamento (§5.4):** só capabilities `consolidated` entram na fila de revisão; `emerging`/`developing` não possuem ciclo SM-2 (são acompanhadas por cobertura). O código decide o que entra na fila e quando, a partir de `knowledge/*.md` + `learning-profile.md`. Capability sem meta ativa, com disposition `sufficient_for_now`, ou com `review_enabled: false` **nunca** é agendada (§17 — lacuna sem interesse não vira obrigação). `probe_frequency: off` desliga apenas sessões socráticas, **nunca** revisões. Agendamento inicial: `repetition = 0`, `EF = 2.5`, `next_review = created_at (KSU) + preferences.initial_interval_days`
- [ ] CLI `review due`, `review run <learning-unit>`
- [ ] MCP `get_due_reviews` e `submit_review_outcome` (grava `reviews/rev-*.md`, atualiza `next_review` no knowledge)
- [ ] MCP `get_persona_context` (briefing passivo de contexto: metas ativas, capacidades e avisos discretos de revisões vencidas sem quebrar flow)
- [ ] Retain do marco cognitivo de volta no Hindsight com `context: "persona-memory-sm2-review"` (fail-open: falha grava `hindsight_retained: false` e retenta no próximo sync, nunca rollback — §8.3 item 6)
- [ ] Skill `/study` para sessões socráticas sob demanda (sem interromper flow — Q10)
- [ ] Métricas do slice: `reviews_due, reviews_completed, review_successes, review_failures`

### Vertical Slice 7: Learning Profile e Entrevista Periódica
> O perfil governa sem vazar para identidade?
- [ ] Schema de `profile/learning-profile.md` (§4.9: metas com prioridade, preferências de estilo/frequência, `review_enabled`, `initial_interval_days`, disposições `sufficient_for_now`)
- [ ] Roteiro canônico de entrevista inicial (§36 da ontologia):
  1. *Metas imediatas:* "No que você está trabalhando ou quer dominar nas próximas semanas?"
  2. *Áreas ativas vs. background:* "Quais temas você quer acompanhar ativamente vs. apenas resolver conforme aparecem?"
  3. *Tópicos suficientes:* "Há áreas onde seu nível atual é 'suficiente por enquanto' e você não quer sugestões?"
  4. *Estilo de feedback:* "Prefere desafios práticos rápidos, discussões conceituais ou apenas tracking silencioso?"
  5. *Intensidade:* "Com que frequência você tolera provocações socráticas no seu fluxo?"
  6. *Conexões externas:* "Há projetos ou contextos específicos que você quer usar como âncora de aprendizado?"
- [ ] Regra anti-repetição (§37 da ontologia): Perguntas já respondidas ou inferidas com alta confiança nunca são repetidas; a entrevista foca estritamente em calibrar divergências ou novidades.
- [ ] Gatilhos de recalibração periódica (§37 da ontologia) disparados por padrões do Hindsight (não por agenda fixa):
  - *Exemplo A (Aumento de atividade):* "Notamos aumento de atividade em PostgreSQL nas últimas duas semanas. Deseja tornar essa uma área de aprendizado ativo, secundária, ou manter apenas como tracking silencioso?"
  - *Exemplo B (Proposta de dimensão com evidências acumuladas, §12):* "Você demonstrou injeção de dependências em múltiplos contextos com autonomia. Faz sentido adicionar a dimensão 'container_interop' para avaliar integração com containers IoC?"
- [ ] **Capabilities de origem `profile` (§10.1 da ontologia):** metas declaradas na entrevista produzem `proposal` (`type: capability`, `origin: profile`, `evidence_ref: null`) submetidas a confirmação humana antes de virarem canônicas (§38.3) — o caminho que faltava para `origin.type: "profile"` existir
- [ ] CLI `profile show`, `profile interview` + MCP `run_profile_interview` (calibra metas, interesses e avalia propostas de dimensão e capability pendentes)
- [ ] Critério de aceite: metas ativas cobrem as oportunidades sem nenhum rótulo de identidade no perfil (§1.1)
- [ ] Métricas do slice: `interviews_run, goals_updated, dispositions_added, dimension_proposals_accepted, dimension_proposals_rejected`

### 6.1 Separações que cada slice deve preservar (fonte: `docs/architecture/cognitive-ontology.md` §§17–19)

- **Conhecimento ≠ interesse ≠ ação** (§17): `knowledge/` diz o que as evidências demonstram;
  `profile/` diz o que importa; `opportunities/` diz o que vale investigar; review policy diz quando
  rever. Lacuna sem interesse = nenhuma ação, nenhuma obrigação de estudo.
- **Contexto é atributo, não entidade** (§18): evidência num contexto não prova domínio geral,
  mas não criar uma Learning Unit por combinação contextual. Síntese na Learning Unit,
  contextos como lista nas evidências/capabilities (`contexts: []`, §4.2).
- **LLM não lê o histórico (§13):** nenhuma ferramenta MCP entrega `covered_dimensions`, `gaps`, `sm2` ou histórico de `updates`/`assessments`/`reviews` ao LLM. A recuperação de capabilities candidatas é feita pelo **código** e entrega só definições; a comparação com o acumulado é sempre do código (§5.2). O agent pode *ler* `knowledge/` no briefing diário (Q9), mas esse conteúdo nunca alimenta uma interpretação.
- **Conflitos explícitos** (§19): `staging/conflicts/conflict-<id>.md` (§4.11) com `with[]`, `context[]`,
  `status: pending_resolution`; resoluções fechadas: `resolved_as_exception | resolved_as_context_change |
  resolved_as_evolution | resolved_as_error`.
  **Critério Conflito → Probe (§19 da ontologia):** Um conflito NÃO abre probe socrático automaticamente.
  A política só abre probe se houver uma questão cognitiva acionável relevante às metas ativas do `Learning Profile`
  (ex.: "o usuário compreende a diferença estrutural entre as duas abordagens conflitantes ou houve lapso?").
  Se for apenas divergência situacional ou preferência de biblioteca em projetos distintos, classifica-se diretamente como
  `resolved_as_context_change` ou `resolved_as_exception` e encerra-se sem interrupção socrática.

### 6.2 Matriz Consolidada de Ferramentas MCP e Comandos CLI

| Componente | Tipo | Entregue no Slice | Função Principal |
| :--- | :--- | :--- | :--- |
| `sync_hindsight_observations` | MCP | Slice 1 | Ingestão incremental paginada do Hindsight |
| `get_staging_queue` | MCP | Slice 1 | Listagem de observações aguardando triagem |
| `triage_staging` | MCP | Slice 1 | Execução determinística ou manual de triagem |
| `validate_vault` / `validate` | MCP & CLI | Slice 1 | Validação estrutural OKF, Zod e integridade |
| `persona-memory sync` | CLI | Slice 1 | Sincronização manual via terminal ou hook |
| `persona-memory staging list/triage` | CLI | Slice 1 | Gestão da fila de observações via terminal |
| `persona-memory staging reject` | CLI | Slice 1 | Rejeição manual de observação com justificativa |
| `persona-memory staging audit` | CLI | Slice 1 | Registro de auditoria amostral gerando `audit-*.md` |
| `get_learning_opportunities` | MCP | Slice 2 | Oportunidades detectadas cruzando perfil |
| `persona-memory opportunity list/defer/reject` | CLI | Slice 2 | Consulta, adiamento e rejeição de oportunidades |
| `get_assessment_candidate` | MCP | Slice 3 | Payload mínimo de interpretação, sem histórico (§13 da ontologia) |
| `get_socratic_probe_contract` | MCP | Slice 3 | Contrato determinístico do desafio socrático |
| `formulate_socratic_probe` | MCP | Slice 3 | Formulação da pergunta socrática (LLM) |
| `submit_cognitive_assessment` | MCP | Slice 3 | Submissão de análise dimensional pelo agente |
| `get_capability` | MCP | Slice 4 | Consulta a definições de capabilities ativas |
| `persona-memory capability list` | CLI | Slice 4 | Listagem de capabilities conhecidas |
| `persona-memory proposal list/approve/reject` | CLI | Slice 4 | Governança humana sobre capabilities e dimensões |
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

Abaixo estão os 11 questionamentos mais duros sobre a arquitetura e as respostas que garantem a solidez do sistema.

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
**R:** O LLM do agente não tem permissão de escrita arbitrária no cofre. A única operação MCP que permite ao agente submeter uma interpretação cognitiva é `submit_cognitive_assessment`. Nenhuma ferramenta MCP permite ao LLM mutar diretamente Knowledge State. Outras ferramentas MCP (ex: `get_assessment_candidate`, `get_socratic_probe_contract`, `formulate_socratic_probe`, `run_profile_interview`) servem para coordenação, não para mutação de estado. O código TypeScript valida o schema, aplica a `Capability Growth Policy` e, se e somente se as dimensões forem satisfeitas, gera um arquivo imutável `updates/ksu-*.md` e materializa o `knowledge/*.md`. **Uma ferramenta `update_knowledge_state` direta é explicitamente banida** (proposta preliminar descartada): toda mutação passa por KSU.

### Q7: Por que o LLM não pode simplesmente ler `knowledge/*.md` para decidir o que a evidência confirma?
**R:** Porque essa é exatamente a separação do §13 da ontologia. Se o LLM visse o estado acumulado, ele tenderia a ler a evidência através da conclusão que já existe — confirmando em vez de observing. Por isso o isolamento é **estrutural**, não uma instrução no prompt: `get_assessment_candidate` e `get_socratic_probe_contract` são montados pelo código e simplesmente não contêm histórico, e `missing_dimensions` foi removido do contrato de probe pelo mesmo motivo. O agente pode ler `knowledge/` no briefing diário (Q9), mas leitura de briefing é contexto de conversa, nunca insumo de interpretação.

### Q8: O que é o "Ciclo Fechado" e por que ele é crucial?
**R:** Sem o retain de volta para o Hindsight, o Hindsight continuaria inferindo que o desenvolvedor possui dificuldades ou dúvidas sobre tópicos que já foram consolidados e testados no `persona-memory`. Quando o `submit_review_outcome` roda com sucesso (q >= 3), ele grava um retain no banco `learner-episodic`. O retain registra no Hindsight que ocorreu uma revisão cognitiva e qual foi o resultado. Isso fornece novo contexto para futuras observações e consolida o ciclo fechado.

### Q9: Como lidar com o acúmulo de arquivos Markdown com o passar dos anos?
**R:** A estrutura particionada (`staging/`, `evidence/`, `assessments/`, `updates/`, `reviews/`) permite que arquivos históricos funcionem como um log append-only. A leitura diária dos agentes acessa exclusivamente a pasta `knowledge/` (que são as projeções materializadas) e `profile/`, mantendo o consumo de I/O e tokens minúsculo mesmo em cofres com dezenas de milhares de evidências. **Essa leitura é de briefing, não insumo de interpretação:** nada do que é lido em `knowledge/` alimenta um assessment (§13, Q7).

### Q10: Por que sessões socráticas ocorrem sob demanda via `/study` em vez de interromper o desenvolvedor durante o código?
**R:** Interrupções durante tarefas complexas quebram o estado de flow. O agente apenas injeta avisos discretos no briefing (`"2 revisões vencidas: dependency-injection, postgres-indexes"`). O desenvolvedor decide quando deseja iniciar a sessão socrática invocando `/study`.

### Q11: Como o sistema é auditável e reversível se uma avaliação de LLM for equivocada?
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

### 9.1 Métricas Unificadas do Sistema (§39 da ontologia)

| Métrica | Slice | Descrição |
| :--- | :--- | :--- |
| `promotion_precision` | Slice 1 | Taxa de precisão da triagem automática verificada via auditorias amostrais (`staging/audits/`, §4.13) |
| `attached` | Slice 4 | Evidências vinculadas diretamente a capabilities existentes sem criação de novas entidades |
| `capability_proposals` | Slice 4 | Propostas estruturais de novas capabilities ou dimensões submetidas para governança humana (§4.12) |
| `human_confirmed` | Slice 4 & 7 | Propostas de capabilities ou dimensões formalmente aceitas pelo desenvolvedor |
| `capabilities_created` | Slice 4 | Novas capabilities canônicas materializadas no cofre após confirmação |
| `review_successes` | Slice 6 | Sessões socráticas SM-2 concluídas com nota q >= 3 (manutenção/aumento do intervalo) |
| `review_failures` | Slice 6 | Sessões socráticas SM-2 concluídas com nota q < 3 (reset do intervalo / lapso) |

### 9.2 Rastreabilidade, Reversibilidade e Fora do MVP

**Cadeia de rastreabilidade** (toda transição aponta para baixo; ver Q11):
`knowledge/ → updates/ksu-*.md → assessments/ → evidence/ → staging/ → Hindsight observation → experiência`.
**Operações reversíveis** (nunca sobrescrever silenciosamente — §41 da ontologia): `evidence invalidated`,
`capability deprecated/merged`, `assessment superseded` (marcado `status: superseded` + `superseded_by`, nunca apagado),
`knowledge rebuilt` (replay ordenado, byte-idêntico, ignorando registros superseded),
`staging re-observed` (re-sync reescreve só campos voláteis quando `hindsight_updated_at` muda — §4.1; evidência filha segue o ciclo de vida de §4.1: `superseded` / `invalidated` / `evi_refs` no conflict).

**Fora do MVP v0.3:** classificadores especializados, métricas sofisticadas de maturity,
inferência de retenção sem evidência direta, árvores complexas de contextos, entrevista
totalmente automática sem confirmação humana, flashcards como entidade central, mapas de
conhecimento como entidade de domínio, ensemble de LLMs por decisão. Classificadores podem
vir depois como componentes auxiliares — sem substituir policies determinísticas.
