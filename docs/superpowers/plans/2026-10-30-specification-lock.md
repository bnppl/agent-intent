# Accepted specification lock migration

User authorised replacing the staged-source model with individual specification
acceptance and requested removal of the old integration from framework and tests.

- Replace the retired annotation/staged-review contract with examples for the
  ordinary-folder report, individual lock acceptance and verification.
- Keep existing lineage and presentation acceptance tests, including stale-source,
  stale-report, independent acceptance, inherited semantics and escaping checks.
- Extract filesystem/configuration/parsing utilities; remove old snapshot,
  annotation, signing, hook-installation and staged-review code and its tests.
- Serve the report at both / and /lineage. Use --root for an explicit project.
- Store accepted definitions in agent-intent.lock.json; keep latest results local.
  Read the existing acceptance store until a human acceptance creates the lock.
- Verify fresh report source, pending specifications and failing test outcomes.
- Retain legacy configuration boundary fields in this checkout so its existing
  staged migration review remains operable; the new runtime ignores those fields.
- Update current documentation and dependency metadata; rebuild both runtimes.
- Leave the installed local enforcement and approval records untouched.

Red evidence: five new lock workflow tests fail because the current CLI requires
an initialised source-control workspace. No candidate product code changed yet.

Validation completed:

- `npm ci --cache /private/tmp/intent-dd-npm-cache`: clean install, no vulnerabilities.
- `npm run build`: both generated runtimes rebuilt.
- `npm test`: type checking and bundle checks pass; 11 acceptance scenarios,
  90 steps and 40 unit tests pass.
- `npm run test:lineage`: 40 tests pass, latest report regenerated.
- Independent review found a suite teardown failure omitted from verification.
  Added a failing teardown fixture, recorded the overall run outcome separately
  from individual tests, then confirmed verification rejects that failed run.
  Reviewer reproduced the fix with no remaining material findings.
- Browser home page shows the report and scenario expansion reveals BDD test
  descriptions. Screenshot: /private/tmp/intent-dd-lock-report.png.
- No actual project specifications were autoaccepted and no lock was generated
  for the project. Acceptance mutations ran only in disposable fixtures.
- Active framework and test sources contain no source-control integration.
- The prior trusted staged-review UI remains available on port 8766 for the
  existing human review requirement. Installed enforcement remains untouched.

The retired step/driver files had pre-existing formatting edits. Complete copies
were preserved at /private/tmp/intent-dd-before-lock-intent-steps.ts and
/private/tmp/intent-dd-before-lock-repository-driver.ts before their requested
retirement. Unrelated editor configuration files were left unstaged.
