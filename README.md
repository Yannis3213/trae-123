# trae-123

This repository is prepared to host generated full-stack web application projects from one project JSON file. Projects are separated by Git branches, with one branch per generated project.

## Source Project Sets

The local project definitions analyzed for the initial repository setup are:

- `/Users/kuzhiluoya/Desktop/new-chat/tasks/projects_part2_generated_1000.json`
- `/Users/kuzhiluoya/Desktop/new-chat/tasks/projects_part3_generated_1000.json`

Both files contain 1000 generated project tasks. Each task includes fields such as `id`, `projectName`, `branchName`, `taskType`, `businessDomain`, `changeScope`, `portGroup`, `commitMessage`, `prompt`, and `title`.

## Repository Strategy

- Keep `main` for repository-level documentation and shared rules.
- Create each project on its own branch, using the `branchName` value from the selected JSON item when possible.
- Keep each project to at most 5 commits.
- Commit project source code, configuration, examples, and documentation.
- Do not commit generated dependencies, build output, local databases, logs, uploads, exports, caches, or secrets.

## Generated Project Profile

The analyzed project prompts are full-stack web applications. The recurring technologies and artifacts include:

- Frontend: React, Vue, Angular, Svelte, Next, Nuxt, Vite, Rsbuild.
- Backend: Python with Starlette, FastAPI, Flask, or Django; Node.js with Express or Nest; Go services.
- Storage: SQLite local project files appear across all analyzed projects.
- Runtime artifacts: attachments, uploads, exports, reports, logs, backups, and local demo data.

The `.gitignore` in this repository is intentionally broad enough to cover the likely generated artifacts from those stacks while keeping normal source files trackable.

## Branch Workflow

1. Choose one project entry from the selected JSON file.
2. Create or switch to the branch named by that entry.
3. Generate or implement the project on that branch.
4. Run the smallest meaningful validation first, then expand validation only when needed.
5. Keep the project history concise and stay within the 5-commit limit.

Example:

```bash
git switch -c feat-y1-mobile-backfill-check-community-health-month-end-followup-record
# implement project
git add .
git commit -m "feat: implement mobile-backfill-check-community-health-month-end-followup-record system"
```
