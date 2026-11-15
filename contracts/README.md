# Shared contracts

Versioned, language-neutral schemas belong here. Backend, Kotlin, Swift, Go and TypeScript clients will consume the same contracts rather than sharing platform code.

`schemas/capability-report.schema.json` is a draft agent capability-report contract. `fixtures/agent-disabled.json` is synthetic setup data, not a monitoring observation. These files do not introduce an implemented backend endpoint. Phase 1 will establish API schemas, code generation/versioning and runtime schema validation.

Run `npm run check:scaffolds` at the repository root for structural and fixture consistency checks. It is not a complete JSON Schema validator or a replacement for native builds.
