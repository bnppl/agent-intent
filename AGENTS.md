# Intent DD contributor workflow

Read `.agents/skills/intent-dd/SKILL.md` before changing product behaviour or executable specifications. This is the repository's agent skill, not a separately installed personal ChatGPT skill.

Develop this tool from its own `features/intent_workflow.feature`. The initial executable contract is a proposal for human review in the implementation PR. Thereafter, use the installed pre-commit hook and local human review workflow for protected changes. Never self-approve or bypass the hook.

Run the acceptance suite and regression checks documented in README.md. Preserve complete glue/support coverage in `.intentdd.json`.
