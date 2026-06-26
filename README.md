# Loadicator

Workspace for an AI-assisted dry bulk cargo uptake tool for chartering teams.

This first version is intentionally small:

- deterministic cargo uptake calculation engine;
- local Baltic Questionnaire inbox for PDF, Word, and Excel files;
- local Node.js server;
- browser UI for quick scenario checks;
- room to add vessel/cargo databases and AI parsing later.

## Run

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Test

```bash
npm test
```

## Team Setup

The shared source code belongs in a private GitHub repository. Each developer
works from their own clone on macOS or Windows and proposes changes through a
short-lived branch and pull request.

1. Install Git, Node.js 22, and VS Code.
2. Clone the private repository and open its folder in VS Code.
3. Run `npm install`, `npm test`, and `npm run dev`.
4. Create a branch such as `feature/vessel-import` for each change.
5. Push the branch, review the pull request together, and merge it into `main`.

Do not commit licensed loadicator installations, licence keys, fixture data, or
confidential vessel documents. Put local working material in `local-data/` or
`private-data/`; both directories are ignored by Git. Sanitized vessel examples
may later be added under a dedicated test-fixtures directory.

Questionnaires uploaded in the browser are stored in
`local-data/questionnaires/`. Upload currently stages files for review; automatic
field extraction will be added against representative questionnaires.
Reviewed results can be stored locally in `local-data/questionnaire-analysis/`
and displayed in the temporary Questionnaire Analysis panel.

Unpumpable or non-pumpable ballast is a mandatory extraction target. Under the
team's chartering convention, its questionnaire quantity is always normalized
to metric tonnes, even when the source labels it as cubic metres. Deduct that
quantity directly from cargo uptake without a water-density conversion.

## Panamax Standard Inputs

For baseline PMX/KMX work, use these editable assumptions:

- PMX deadweight range: 72,000-85,000 mt;
- KMX deadweight range: 82,000-85,000 mt;
- heavy fuel oil: 1,000 mt;
- diesel oil: 250 mt;
- constants fallback: 350 mt when not supplied or found in the questionnaire;
- unpumpable ballast fallback: 200 mt when not found in the questionnaire;
- fresh water on board: 200 mt.

The browser stores the last edited standard set locally and can apply it to the
current cargo scenario. HFO and diesel oil are combined as bunker deductions.

Cargo stowage factor accepts either cubic feet per metric tonne or cubic metres
per metric tonne. The calculation engine normalizes it using the exact relation
`1 ft3 = 0.028316846592 m3` before applying the cubic-capacity limit.

## Chartering Task Desk

The browser includes an MVP task conversation where a chartering or operations
user can submit a request in ordinary text. Tasks are sent to the local backend
and stored under `local-data/chartering-tasks/`, outside Git. The current stage
queues each task for structured review; a future server-side AI adapter can
produce the response while the deterministic engine remains responsible for
the calculation. Until that adapter is connected, the UI explicitly labels
submitted tasks as queued for manual review rather than background processing.

For Windows-only loadicator integration, keep a small adapter program on the
Windows machine. It should read an export produced by the licensed software
(CSV, Excel, PDF, or another supported format), remove confidential fields when
necessary, and send normalized vessel inputs to this application's API. This
keeps the calculation engine portable while the licensed software remains on
the machine where it is authorized to run.

## Product Direction

The app should help chartering users estimate cargo intake before fixture. It is
not a class-approved onboard loadicator. Stability, trim, hull strength, and
vessel-specific limits must eventually come from approved vessel documents and
be clearly surfaced as assumptions.
