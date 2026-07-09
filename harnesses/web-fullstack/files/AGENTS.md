# Project Instructions — Full-Stack Web

Guidance for working in this React/Node full-stack project.

## Frontend Conventions (React/Next.js)

- Use TypeScript for all frontend code.
- Prefer function components with hooks over class components.
- Use named exports for components; default export only for page components.
- Co-locate component styles using CSS Modules or Tailwind utility classes.
- Keep components small and composable — extract reusable logic into custom hooks.
- Use `next/navigation` (App Router) for routing in Next.js projects.

## Backend Conventions (Node/Express)

- Use TypeScript for all backend code.
- Structure API routes with clear separation: controller → service → data layer.
- Validate all request inputs with a schema validation library (e.g. zod, typebox).
- Return consistent error response shapes: `{ error: { code, message, details? } }`.
- Use environment variables for configuration; never hardcode secrets.
- Prefer async/await over callback chains.

## Testing

- Write tests alongside the code they verify (co-located `*.test.ts` or `__tests__/`).
- Use Vitest or Jest for unit/integration tests.
- Use Playwright or Cypress for end-to-end tests.
- Aim for meaningful coverage of business logic, not 100% line coverage.
- Run tests in CI on every pull request.

## Code Review Process

- All changes require at least one approving review before merge.
- Use the review prompt template at `.pi/prompts/review.md` for structured reviews.
- Focus reviews on: correctness, security, performance, accessibility, and test coverage.
- Provide specific, actionable feedback. Reference line numbers or code blocks.
- Approve only when all blocking comments are resolved.
