# PathWise

PathWise helps learners master course concepts in prerequisite order. It runs on a local SQLite database and includes learner/instructor authentication, role-scoped course APIs, prerequisite-aware lesson and quiz workflows, curriculum history, and notifications.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`. The default `DATABASE_URL="file:./dev.db"` stores the SQLite database at `prisma/dev.db`.
3. Generate the Prisma client and create the local database:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. Create an instructor account locally, or set a password for one of the seeded profiles:

   ```bash
   npm run db:create-instructor
   # or
   npm run db:set-password
   ```

   Both commands prompt for passwords without echoing them. Public registration creates learner accounts only.
5. Start PathWise with `npm run dev`, then open `http://localhost:3000/login` or create a learner account at `/register`.

Authentication uses scrypt password hashes and random opaque session tokens. Only SHA-256 token hashes are stored in SQLite; browser sessions use HttpOnly, SameSite cookies. Sessions expire after seven days. No hosted identity provider, Supabase, or cloud database is used.

The seed creates the 14-concept C Programming Fundamentals course, lessons, quizzes, questions, prerequisite links, demo learner enrollment, lesson completion, and sample passing attempts. The seed is idempotent and preserves existing quiz-attempt and lesson-completion history.

The Prisma schema exposes `Prerequisite` and `LessonCompletion` while mapping them to the existing `ConceptPrerequisite` and `LessonProgress` SQLite tables, so existing prerequisite links and completion rows are retained. `ConceptMastery` is available for the per-learner current mastery projection; quiz attempts remain the historical source of truth.

## Local API

All routes read and write the local SQLite database:

- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Courses: `GET/POST /api/courses`, `GET/PATCH/DELETE /api/courses/:courseId`, `POST /api/courses/:courseId/enroll`
- Concepts and prerequisites: `/api/courses/:courseId/concepts`, `/api/concepts/:conceptId`, `/api/concepts/:conceptId/prerequisites`, and `/api/concepts/:conceptId/split`
- Lessons: `/api/concepts/:conceptId/lessons`, `/api/lessons/:lessonId`, and `/api/lessons/:lessonId/complete`
- Assessments: `/api/concepts/:conceptId/quizzes`, `/api/quizzes/:quizId`, `/api/quizzes/:quizId/questions`, `/api/questions/:questionId`, and `/api/quizzes/:quizId/attempts`
- Learner data: `/api/courses/:courseId/progress`, `/api/courses/:courseId/learning-path`, `/api/courses/:courseId/history`, and `/api/notifications`

Instructor routes are restricted to the instructor who owns a course. Learner routes require an enrollment. Quiz scores are computed from stored answer keys on the server; clients submit option indexes only. Locked concepts return their missing prerequisites and do not expose lesson content or answer keys. Curriculum edits are recorded as revisioned changes, notify enrolled learners, and archive rather than hard-delete course content so attempts and completions remain available.

To split a concept, submit at least two replacement concepts. Assign every active lesson and quiz to exactly one replacement using `lessonIds` and `quizIds`; old quiz attempts and lesson completion rows remain intact, while curriculum dependencies and learning paths are updated transactionally.

The existing dashboard remains data-backed. Full lesson-player, quiz-taking, and curriculum-editor screens are still separate frontend work; the corresponding backend workflows are exposed through the API.

## Validate

- `npm test` runs password, graph, mastery, unlocking, and learning-path tests.
- `npm run lint` checks the code.
- `npx tsc --noEmit` checks TypeScript.
- `npm run build` builds the Next.js application.

## Implementation stages

1. Local SQLite schema, sample curriculum, and graph algorithms.
2. Password-based local authentication and secure role provisioning.
3. Role-scoped course, concept, lesson, quiz, progress, and notification APIs.
4. Cycle-safe curriculum edits, preserved history, notifications, and learning paths.
5. Full lesson-player, assessment, enrollment, and curriculum-editor UI.
