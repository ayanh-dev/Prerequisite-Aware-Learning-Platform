# PathWise

PathWise helps learners master course concepts in prerequisite order. This repository currently contains the Next.js foundation, the PostgreSQL/Prisma data model, an idempotent C fundamentals seed, and tested graph and mastery rules. Authentication, database-backed pages, and instructor/learner workflows are the next implementation stages.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `DIRECT_URL` from your Supabase project's database settings. Use a pooled connection for `DATABASE_URL` and a direct connection for `DIRECT_URL`.
3. Generate the Prisma client: `npm run db:generate`.
4. Create/update database tables: `npm run db:push`.
5. Load the sample course: `npm run db:seed`.
6. Start the app: `npm run dev`.

The seed creates instructor and learner demo records without passwords. Login is not implemented yet. It adds 14 C programming concepts, text lessons, quiz questions, and prerequisite links; it does not delete student history.

## Validate

- `npm test` runs the graph, mastery, unlocking, and learning-path tests.
- `npm run lint` checks the code.
- `npx tsc --noEmit` checks TypeScript.
- `npm run build` builds the Next.js application.

## Implementation stages

1. Data model, sample curriculum, and prerequisite/mastery algorithms.
2. Course and concept management with cycle-safe curriculum updates.
3. Learner enrollment, quiz attempts, mastery unlocking, and learning paths.
4. Interactive graph, curriculum history, and learner notifications.
5. Responsive role-based dashboards and deployment setup.
