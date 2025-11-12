# Build & Release Guide

This guide covers the commands and workflow for building and releasing new versions of `@alchemy/utilities`.

## 📋 Prerequisites

1. **Node.js** 16+ installed
2. **npm** configured with authentication (see `.npmrc`)
3. **Git** access to the repository
4. All changes committed to your branch

---

## 🔨 Building the Project

### Clean Build

Build the project and output to `dist/` directory:

```bash
npm run build
```

This command will:

- Clean the `dist/` directory (via `prebuild` script)
- Compile TypeScript to JavaScript
- Generate type definitions (`.d.ts` files)

### Verify Build

After building, verify the output:

```bash
ls -la dist/
```

You should see:

- `index.js` - Main entry point
- `index.d.ts` - TypeScript definitions
- Other compiled files

### Run Tests Before Building

Always run tests before building:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov
```

---

## 🚀 Release Workflow

### Overview

This project uses `standard-version` for automated versioning and changelog generation. Releases are automated via GitHub Actions and can only be triggered from CI/CD pipelines.

### Release Process

#### Step 1: Prepare Your Changes

```bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

#### Step 2: Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new feature"        # for features
git commit -m "fix: fix bug"                 # for bug fixes
git commit -m "chore: update dependencies"   # for maintenance
```

#### Step 3: Push to GitHub

```bash
git push origin main
```

#### Step 4: Create Release via GitHub Actions

The release process is automated and runs in GitHub Actions. The release script will:

1. Bump the version based on commit messages
2. Generate/update `CHANGELOG.md`
3. Create a git tag
4. Push the tag to GitHub
5. Publish to npm

**Note:** Releases can only be triggered from GitHub Actions (checks for `GITHUB_ACTIONS` environment variable).

---

## 📦 Version Bumping

### Understanding Semantic Versioning

Versions follow the format: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward-compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes (backward-compatible)

### Commit Message Format

`standard-version` automatically determines the version bump based on commit messages:

| Commit Type        | Version Bump | Example Commit Message                |
| ------------------ | ------------ | ------------------------------------- |
| `feat:`            | **MINOR**    | `feat: add new helper method`         |
| `fix:`             | **PATCH**    | `fix: resolve Redis connection issue` |
| `perf:`            | **PATCH**    | `perf: improve cache performance`     |
| `docs:`            | **PATCH**    | `docs: update README`                 |
| `chore:`           | **PATCH**    | `chore: update dependencies`          |
| `refactor:`        | **PATCH**    | `refactor: simplify code structure`   |
| `test:`            | **PATCH**    | `test: add unit tests`                |
| `BREAKING CHANGE:` | **MAJOR**    | `feat!: change API signature`         |

### Manual Version Bumping (Local Development)

If you need to manually bump versions locally (for testing):

```bash
# Patch version (1.0.0 → 1.0.1)
npm version patch -m "chore: bump patch version to %s"

# Minor version (1.0.0 → 1.1.0)
npm version minor -m "feat: bump minor version to %s"

# Major version (1.0.0 → 2.0.0)
npm version major -m "breaking: bump major version to %s"
```

**Note:** These commands will:

- Update `package.json` version
- Create a git commit
- Create a git tag

To push manually:

```bash
git push origin main --tags
```

---

## 🎯 Release Scenarios

### Scenario 1: Release a Patch Version (Bug Fix)

```bash
# 1. Make your bug fix
# 2. Commit with fix: prefix
git commit -m "fix: resolve type error in Redis helper"

# 3. Push to main
git push origin main

# 4. GitHub Actions will:
#    - Detect fix: commit
#    - Bump PATCH version (e.g., 0.0.14 → 0.0.15)
#    - Generate changelog
#    - Create tag
#    - Publish to npm
```

### Scenario 2: Release a Minor Version (New Feature)

```bash
# 1. Add your new feature
# 2. Commit with feat: prefix
git commit -m "feat: add new S3 helper method"

# 3. Push to main
git push origin main

# 4. GitHub Actions will:
#    - Detect feat: commit
#    - Bump MINOR version (e.g., 0.0.14 → 0.1.0)
#    - Generate changelog
#    - Create tag
#    - Publish to npm
```

### Scenario 3: Release Multiple Changes

```bash
# Make multiple commits
git commit -m "feat: add new utility"
git commit -m "fix: resolve bug in helper"
git commit -m "docs: update documentation"

# Push all commits
git push origin main

# GitHub Actions will:
# - Analyze all commits since last release
# - Determine highest version bump needed
# - If any feat: exists → MINOR bump
# - If only fix:/chore: → PATCH bump
```

---

## 🔍 Verification

### Check Current Version

```bash
# From package.json
cat package.json | grep version

# From npm registry
npm info @alchemy/utilities version
```

### Verify Published Package

```bash
# View package info
npm info @alchemy/utilities

# View version history
npm view @alchemy/utilities versions
```

### Test Installation

```bash
# In a test project
npm install @alchemy/utilities@latest

# Or install specific version
npm install @alchemy/utilities@0.0.14
```

---

## 🛠️ Troubleshooting

### Build Fails

```bash
# Clean and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

### Tests Fail

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- path/to/test.spec.ts
```

### Release Not Triggered

- Ensure you're pushing to `main` branch
- Check that GitHub Actions workflow is enabled
- Verify commit messages follow conventional format
- Check GitHub Actions logs for errors

### Version Not Updated

- Ensure `standard-version` is installed: `npm list standard-version`
- Check that commit messages are in conventional format
- Verify `.versionrc` or `package.json` configuration (if exists)

---

## 📝 Quick Reference

### Build Commands

```bash
npm run build          # Build the project
npm test               # Run tests
npm run test:cov       # Run tests with coverage
```

### Release Commands (GitHub Actions Only)

```bash
npm run release        # Trigger release (only works in CI)
```

### Manual Version Commands (Local)

```bash
npm version patch      # Bump patch version
npm version minor      # Bump minor version
npm version major     # Bump major version
```

### Git Commands

```bash
git push origin main --tags    # Push commits and tags
git tag                        # List all tags
git tag -d <tag-name>         # Delete local tag
git push origin :refs/tags/<tag-name>  # Delete remote tag
```

---

## 🔐 Authentication

### Method 1: npm login (Interactive)

```bash
npm login
```

This will open a browser window for authentication. After successful login, you can publish.

### Method 2: Using Access Token

1. **Generate an npm access token:**
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Choose "Automation" or "Publish" type
   - Copy the token

2. **Update `.npmrc` file:**

```bash
registry=https://registry.npmjs.org/
always-auth=true
//registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE
```

**OR** use environment variable:

```bash
export NPM_TOKEN=your_npm_token_here
```

3. **Verify authentication:**

```bash
npm whoami
```

This should display your npm username if authenticated correctly.

### Troubleshooting Authentication

- **401 Unauthorized**: Token expired or invalid - generate a new token
- **404 Not Found**: Package doesn't exist or you don't have publish permissions
- **403 Forbidden**: You don't have permission to publish this package

**Note:** If you're publishing a scoped package (e.g., `@alchemy/utilities`), ensure `publishConfig.access` is set to `"public"` in `package.json`.

---

## 📚 Additional Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version Documentation](https://github.com/conventional-changelog/standard-version)

---

## ⚠️ Important Notes

1. **Releases are automated** - The `npm run release` command only works in GitHub Actions
2. **Commit messages matter** - Use conventional commit format for automatic versioning
3. **Always test before release** - Run `npm test` and `npm run build` before pushing
4. **Main branch only** - Releases should only be triggered from the `main` branch
5. **No local releases** - The release script prevents local execution for safety
