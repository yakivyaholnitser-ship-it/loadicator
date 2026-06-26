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
