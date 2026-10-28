# Releasing

Versions are published to npm from a maintainer's machine.

1. Bump the version: `npm version <x.y.z> --no-git-tag-version` (updates `package-lock.json` too).
2. Commit, tag the commit with the bare version (for example `0.1.2`, no `v`), and push both.
3. `npm publish`. `prepublishOnly` runs lint, tests and build first, and stops the publish if
   any of them fails.

Do not use `npm run release` or `n8n-node release`: n8n's flow expects a GitHub Actions publish,
which this repository does not use.

Versions published this way carry no npm provenance statement. n8n requires one for a node to
be verified, so verification would need a publish workflow added back.
