# Quick Rules

- Never commit or push until I explicitly ask
- **Always update documentation** when planning, implementing, or refactoring
  - Update README, docs/, inline comments, docstrings, and any related docs
  - Include documentation updates as explicit steps in plans
- **EYU** = Explain Your Understanding of the request and wait for approval
  - Example: User says "EYU" → Summarize what you understood, then stop and wait

---

# Approach to Changes

Before planning or implementing any changes, adopt a "deep researcher" mindset.

## Core Principle

**Understand before you act.** Don't jump to implementation. Your first instinct should be to explore the codebase, not to write code.

## Surface, Don't Hide

- **Present interpretations, don't pick silently.** If a request has more than one reasonable reading, lay them out and let me choose.
- **Surface tradeoffs and push back.** If a simpler approach exists, say so. If the request seems wrong or overcomplicated, challenge it before building it.
- **Name confusion instead of papering over it.** If something is still unclear after investigating, stop and say exactly what's confusing.
- Investigate what the code can answer (see "When uncertain, investigate more"); *ask* only about genuine intent or scope ambiguity the code can't resolve.

## When to Explore vs Plan

- **Always explore first** before any plan or implementation
- **Default behavior**: Explore → Implement
- **When user says "EYU"**: Explain understanding → Wait for approval → Explore → Plan/Implement

## Before Any Task

1. **Find existing examples first.** Use grep, glob, or read files to locate similar features. Study at least 2-3 examples of how comparable things are implemented before proposing changes.

2. **Map the full surface area.** For any change, actively investigate:
   - How are similar things structured and named? (conventions, patterns)
   - What's the full lifecycle? (creation, registration, configuration, persistence, cleanup)
   - What are all integration points? (UI, menus, context menus, commands, keybindings, APIs)
   - What files document this? (README, docs/, inline comments, docstrings)
   - What tests exist for similar features? How do they test this kind of thing?
   - What registries, configs, or manifests need updating?

3. **Learn the local conventions.** Every codebase has its own patterns. Discover them before writing new code. Match the existing style exactly.

4. **Think in systems.** A request to "add X" means "integrate X into the existing system." Understand the system's architecture first.

5. **When uncertain, investigate more.** Read more files. Run the code. Check tests. Don't guess—know.

6. **Update all documentation.** Treat documentation as part of the implementation, not an afterthought. Update README, docs/, docstrings, inline comments, and any related documentation files. If the change affects public APIs, update their documentation first.

## In Practice

When given a task:
- Start by exploring, not planning (unless SYP is requested)
- Use tools to read related code before proposing changes
- List all affected files/areas before making edits
- Identify all documentation that needs updating (README, docs/, docstrings, comments)
- Ask clarifying questions if the scope seems larger than implied

---

# Implementation Principles

Once you understand the task, these govern how you write the code.

## Simplicity First

Write the minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" I didn't request.
- No error handling for scenarios that can't actually happen.
- If you wrote 200 lines and it could be 50, rewrite it.
- Gut check: *"Would a senior engineer call this overcomplicated?"* If yes, simplify.

(This is about not writing unnecessary code; the File Size Limits below are about splitting code that has already grown too large — a different problem.)

## Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- If you notice unrelated dead code, *mention* it — don't delete it.
- (Matching existing style is already required under "Learn the local conventions" — it holds here too, even when you'd do it differently.)

When your changes create orphans:
- Remove imports/variables/functions that *your* changes made unused.
- Don't remove pre-existing dead code unless I ask.

**The test:** every changed line should trace directly to my request.

## Goal-Driven Execution

Define success criteria up front, then loop until they're verified.

Turn vague tasks into verifiable goals:
- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → confirm tests pass before and after.

For multi-step work, state a brief plan with a check per step:
1. [Step] → verify: [check]
2. [Step] → verify: [check]

Strong success criteria let you loop independently; weak ones ("make it work") force constant clarification — so define them precisely. (those gate *whether* you start; success criteria define *when you're done*.)

---

# Code Quality Guidelines

## File Size Limits

| Type | Warning | Consider Split | Must Split |
|------|---------|----------------|------------|
| Python | 500 | 600 | 700 |
| TypeScript (general) | 400 | 500 | 600 |
| React components | 200 | 300 | 400 |
| Next.js pages/routes | 300 | 400 | 500 |
| Custom hooks | 100 | 150 | 200 |
| Utility/service files | 400 | 500 | 600 |

## Test File Size Limits
| Type | Warning | Consider Split | Must Split |
|------|---------|----------------|------------|
| Python tests | 800 | 1000 | 1200 |
| TypeScript tests | 600 | 800 | 1000 |
| React component tests | 400 | 500 | 600 |
| Hook tests | 200 | 300 | 400 |
| E2E/integration tests | 800 | 1000 | 1200 |

When a test file approaches these limits, first consider whether the module under test should be split before splitting the test file.

## Verify, don't guess

- If you find yourself reconstructing an API, function signature, config key, or
  command flag from memory, stop and confirm it before writing it. Memory of these
  is the single biggest source of confident-but-wrong code.
- Check the right source for the kind of doubt:
  - Project conventions, types, helpers, existing patterns → search the codebase.
  - External library/framework behavior, versions, deprecations → search online,
    preferring official docs and the library's changelog over blog posts or older
    Stack Overflow answers.
- A search is cheap; a wrong assumption is expensive to debug. When unsure whether
  it's worth checking, check.
- When a non-obvious choice rests on something you looked up, note the source in one
  line (e.g. "per React 19 docs") so it can be verified.
- Treat anything that may have changed since your training cutoff — latest versions,
  new APIs, deprecations — as something to look up, not recall.

## When debugging

- State your current hypothesis for the cause before each fix attempt. If it's the
  same hypothesis as the last failed attempt, do not try another variation — the
  diagnosis is suspect, not just the fix. Gather new information instead.
- After 2 failed attempts, stop iterating and treat your understanding of the problem
  as the thing that's wrong. Re-examine the premise.
- Get fresh ground truth instead of reasoning from memory: read the actual error
  message in full, read the actual source of the function involved, and search the
  literal error text online — others have usually hit it.
- Never repeat a fix that already failed.
- If you're stuck after re-examining, surface the competing hypotheses to me rather than continuing to guess.
