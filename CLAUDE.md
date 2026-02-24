# Hellenic Bot

## Rules

- All documentation files (docs/, CLAUDE.md, etc.) must be written in English.

## Design Principles

- **Confirm scope first.** Do not assume components, entities, or features are needed based on docs or similar products. Ask what is in scope for the current iteration before building.
- **Nothing speculative.** Do not add fields, parameters, abstractions, or config "just in case". Everything must have a concrete use case right now.
- **Derived data = no separate state.** If a value can be computed from existing data, say so immediately instead of adding redundant state. Do not silently implement something you know is unnecessary.
- **Ask about actual requirements, not patterns.** Do not copy solutions from well-known products or frameworks. Ask how this specific system should work before designing or implementing.
- **Generic naming.** Names should not hardcode domain-specific assumptions that may change (e.g. language, platform, provider). Keep identifiers abstract and reusable.
- **Clarify multiplicity and format early.** For any data field, ask upfront whether it needs to support multiple values, languages, formats, or variants.
- **Format for readability from the start.** Align markdown tables, use consistent indentation, structure output for easy scanning. Do not leave formatting as a follow-up task.
