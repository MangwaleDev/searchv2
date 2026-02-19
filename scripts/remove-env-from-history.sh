#!/bin/bash
###############################################################################
# Remove .env.production from git history (secrets in commit 5c73f4f).
# Run from repo root. Then: git push origin test-live --force-with-lease
###############################################################################
set -e
cd "$(git rev-parse --show-toplevel)"

# Ensure .env.production is ignored
if ! grep -q '^\.env\.production$' .gitignore 2>/dev/null; then
  echo ".env.production" >> .gitignore
  git add .gitignore
  git commit -m "chore: ignore .env.production" || true
fi

# Remove .env.production from all commits from 5c73f4f onward
echo "Rewriting history to remove .env.production from commits..."
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.production' \
  --prune-empty 5c73f4f^..HEAD

echo "Done. Push with: git push origin test-live --force-with-lease"
echo "Keep .env.production only on the server; never commit it again."
