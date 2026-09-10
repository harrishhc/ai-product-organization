# Methodology Genesis

This directory is the HH-owned methodology baseline.

## Initial genetic sources

- Product Manager Skills: deanpeters/Product-Manager-Skills @ 1b5a524ebb95e9497fa3f25002d8b8ec528d4444
- Product Manager Prompts: deanpeters/product-manager-prompts @ c3b91dba8f7782fac72c7aa340b98d6554b1f3ec

These snapshots are the initial seed only. HH's repository is the runtime
source of truth after import. External repositories are not runtime
dependencies and are not consulted during ordinary product work.

The import intentionally excludes upstream repository/application tooling
such as , , , release packaging, and CI machinery.
The prompt ecosystem is namespaced under  to preserve
both source ecosystems without overwriting files with the same names.
