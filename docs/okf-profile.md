# Perfil Persona Memory sobre OKF v0.2

- **OKF v0.2:** Especificação canônica da base (type, title, description, tags, sources, generated, verified, status).
- **Persona Memory Profile:** Extensões semânticas no namespace `persona:`:
  - `persona.state`:
    - Beliefs / Heuristics: `current`, `superseded`
    - Competencies: `active-frontier`, `consolidated`, `archived`
    - Projects: `active`, `completed`
    - Events: `draft`, `reviewed`, `accepted`, `rejected`
  - `persona.event_kind`: `belief_change`, `learning`, `milestone`, `evidence`, `observation`
