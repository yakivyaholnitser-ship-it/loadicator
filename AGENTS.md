# Loadicator Agent Guidance

## Purpose

Build an AI-assisted dry bulk pre-fixture cargo uptake tool for chartering and
operations teams. It is not a class-approved onboard loadicator. Stability,
trim, shear force, bending moment, and final loading conditions must eventually
be verified with approved vessel software and by responsible shipboard staff.

## Working Agreement

- Read `README.md`, `src/ai/charteringInstructions.js`,
  `src/domain/cargoUptake.js`, and relevant tests before changing calculation
  behavior.
- Keep arithmetic deterministic and testable. AI may extract structured inputs
  and explain results, but must not replace the calculation engine.
- Preserve source values, units, assumptions, missing fields, and warnings.
- Do not commit questionnaires, fixture data, API keys, licence files, or other
  confidential local material.
- Keep changes focused and run `npm test` before reporting completion.
- On Windows PowerShell, use `npm.cmd test` and `npm.cmd run dev` when execution
  policy blocks `npm.ps1`.

## Commands

```text
npm test
npm run dev
```

The local app runs at `http://localhost:5173`.

## Core Business Rules

- PMX DWT range: 72,000-85,000 mt.
- KMX DWT range: 82,000-85,000 mt.
- Baseline HFO: 1,000 mt; diesel oil: 250 mt.
- Constants: use questionnaire value; otherwise 350 mt.
- Unpumpable ballast: use questionnaire value; otherwise 200 mt. Normalize the
  stated quantity to metric tonnes even when the source labels it cubic metres.
- Fresh water on board: 200 mt for baseline tasks unless explicitly overridden.
- Tank capacities are maximum capacities, not current ROB.
- Brackish water is density 1.001-1.024 inclusive. Seawater reference is 1.025.
- Apply density corrections using FWA and TPC. Unusual densities outside
  1.000-1.025 must still be calculated and clearly flagged for confirmation.
- Stowage factor accepts `cuft/mt` and `cbm/mt`; use the exact conversion
  `1 ft3 = 0.028316846592 m3`.
- Never invent missing vessel particulars or cargo stowage factor.

## Repository Map

- `src/domain/`: deterministic calculations.
- `src/ai/`: OpenAI extraction adapter and chartering instructions.
- `src/server.js`: local APIs and static server.
- `public/`: browser interface.
- `test/`: deterministic behavior tests.
- `local-data/`, `private-data/`, `.env.local`, and `.tools/`: local-only and
  ignored by Git.
