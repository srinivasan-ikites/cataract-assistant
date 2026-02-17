# Autonomous Development Pipeline

> **What this document covers:** A complete reference for the automated development cycle we are building for the Cataract Counsellor project. Covers the concepts, architecture, tools, workflows, and how every piece connects.
>
> **Last Updated:** February 2026

---

## Table of Contents

1. [What Is This?](#1-what-is-this)
2. [Terminology](#2-terminology)
3. [Current Manual Workflow](#3-current-manual-workflow)
4. [Proposed Automated Workflow](#4-proposed-automated-workflow)
5. [The Two GitHub Actions Workflows](#5-the-two-github-actions-workflows)
6. [Workflow A: Agent Fix (Issue to PR)](#6-workflow-a-agent-fix-issue-to-pr)
7. [Workflow B: Deploy (Merge to Production)](#7-workflow-b-deploy-merge-to-production)
8. [Error Monitoring and Auto-Remediation](#8-error-monitoring-and-auto-remediation)
9. [The Complete Connected Flow](#9-the-complete-connected-flow)
10. [GitHub Runners: Where Does Code Execute?](#10-github-runners-where-does-code-execute)
11. [Context and Token Consumption](#11-context-and-token-consumption)
12. [What You Need to Set Up](#12-what-you-need-to-set-up)
13. [GCP Instance Requirements](#13-gcp-instance-requirements)
14. [Safety Guardrails](#14-safety-guardrails)
15. [What This Does NOT Do](#15-what-this-does-not-do)
16. [Cost Estimates](#16-cost-estimates)
17. [Implementation Order](#17-implementation-order)

---

## 1. What Is This?

This is an **Autonomous Development Pipeline** — a system that automates the manual steps of software development:

| Manual Step (Today) | Automated Equivalent |
|---|---|
| You read a bug report and fix it | AI agent reads the issue and writes the fix |
| You push code and SSH into GCP to deploy | Auto-deploys on merge to main |
| You check logs for production errors | Monitoring tool catches errors automatically |
| You create a task to fix a production bug | Monitoring auto-creates a GitHub issue |

The industry terms for the individual pieces:

| Layer | Industry Term | What It Covers |
|---|---|---|
| AI writes code from requests | **Agentic Software Engineering** | Agent receives task, plans, codes, tests, opens PR |
| Auto-deploy on merge | **CI/CD** (Continuous Integration / Continuous Deployment) | GitHub Actions builds and deploys automatically |
| Auto-detect and fix production errors | **AIOps / Self-Healing Systems** | Monitoring detects errors, AI creates fix PRs |
| The whole cycle together | **Autonomous Development Pipeline** or **Agentic SDLC** | End-to-end: request to code to deploy to monitor to fix |

---

## 2. Terminology

| Term | What It Means |
|---|---|
| **GitHub Actions** | GitHub's built-in automation system. You write YAML workflow files that define what happens when events occur (push, PR, issue created, etc.) |
| **Workflow** | A single automation defined in a `.yml` file inside `.github/workflows/`. One repo can have multiple workflows. |
| **Runner** | The virtual machine (VM) that executes a workflow. Can be GitHub-hosted (free, temporary) or self-hosted (your own server). |
| **GitHub-hosted runner** | A temporary VM provided by GitHub (Ubuntu, Windows, or macOS). Spins up fresh for each run, destroyed after. Free tier: 2,000 minutes/month. |
| **Self-hosted runner** | Your own server (e.g., your GCP instance) registered with GitHub to run workflows. You install the runner agent on your machine. |
| **Claude Code Action** | An official GitHub Action by Anthropic that installs and runs Claude Code CLI in a workflow. It can read issues, fix code, and open PRs. |
| **Container Registry** | A storage service for Docker images (Google Artifact Registry, Docker Hub). You push built images here so your GCP can pull them. |
| **Webhook** | An HTTP request automatically sent from one service to another when an event occurs. Example: Sentry sends a webhook to GitHub when an error is detected. |
| **CI** | Continuous Integration — automatically building and testing code on every push/PR. |
| **CD** | Continuous Deployment — automatically deploying code to production after tests pass. |
| **Sentry / New Relic** | Monitoring tools that watch your live application for errors, crashes, and performance issues. They capture stack traces, request details, and timestamps. |
| **Alert Policy** | A rule in your monitoring tool: "If X happens, do Y." Example: "If error count > 0 in 5 minutes, fire a webhook." |
| **PR (Pull Request)** | A GitHub feature where code changes on a branch are proposed for merging into the main branch. Allows review before merging. |

---

## 3. Current Manual Workflow

```
Step 1: You write/fix code locally on your laptop
            |
Step 2: You push code to GitHub
            |
Step 3: You SSH into your GCP instance manually
            |
Step 4: You run: git pull
            |
Step 5: You run: docker build + docker run
            |
Step 6: Application is updated on production
```

**Problems with this approach:**
- Every step requires your manual intervention
- If a production error happens while you're asleep, nobody fixes it until morning
- Deployment is error-prone (forgot to pull? forgot to rebuild?)
- No automated tests run before deployment — broken code can go live

---

## 4. Proposed Automated Workflow

The automated system has **three phases** that work together:

```
PHASE A: Feature/Bug Fix Request
    You create GitHub Issue + label "agent"
    -> AI agent writes code -> opens PR
    -> You review and merge
    -> Auto-deploys to GCP

PHASE B: Continuous Deployment
    Any merge to main branch
    -> GitHub Actions builds Docker image
    -> Pushes to container registry
    -> SSHs into GCP and updates containers
    -> Application is live

PHASE C: Error Detection and Auto-Fix
    Production error occurs
    -> Sentry/New Relic catches it
    -> Auto-creates GitHub Issue with stack trace
    -> Triggers Phase A automatically
```

---

## 5. The Two GitHub Actions Workflows

This system uses **two separate workflow files**, not one:

```
.github/
  workflows/
    claude-agent.yml     <- Workflow A: AI agent fixes issues
    deploy.yml           <- Workflow B: Deploy on merge to main
```

They serve completely different purposes and trigger on different events:

| | Workflow A: Agent Fix | Workflow B: Deploy |
|---|---|---|
| **Trigger** | Issue labeled "agent" | PR merged to `main` branch |
| **Purpose** | AI reads issue, writes fix, opens PR | Build Docker image, deploy to GCP |
| **Runs on** | GitHub-hosted runner (Ubuntu VM) | GitHub-hosted runner (Ubuntu VM) |
| **Needs** | Claude Code CLI, Anthropic API key | Docker, SSH key to GCP, registry credentials |
| **Output** | A Pull Request with the fix | Updated production deployment |
| **Duration** | 5-15 minutes | 3-8 minutes |

---

## 6. Workflow A: Agent Fix (Issue to PR)

### What Triggers It
- A GitHub issue is created (or updated) with the label `agent`
- This can happen manually (you create the issue) or automatically (Sentry creates it)

### What Happens Step by Step

```
1. GitHub detects: Issue #42 has label "agent"
        |
2. GitHub spins up a fresh Ubuntu VM (runner)
        |
3. Runner executes the workflow steps:
   a. Checks out your repository (git clone)
   b. Installs Claude Code CLI
   c. Claude Code starts a fresh session:
      - Reads CLAUDE.md (understands the project)
      - Reads the issue title and body
      - Searches for relevant files (Glob/Grep)
      - Reads the specific files that need changes
      - Makes the fix
      - Runs tests (if configured)
      - Creates a new branch
      - Commits and pushes changes
      - Opens a Pull Request linked to the issue
        |
4. GitHub VM is destroyed (cleaned up)
        |
5. You receive a notification: "PR #43 opened by Claude"
        |
6. You review the PR:
   - Read the changes
   - Check if tests pass (Workflow B's test job)
   - Approve and merge, OR request changes
```

### What Claude Code Does NOT Need on the Runner
- Does NOT need Docker running
- Does NOT need your database (Supabase)
- Does NOT need your app running
- It only needs: source code files + ability to read/edit them

Claude Code works by reading and editing files, not by running the application. It understands code structurally.

### Simplified Workflow File Example

```yaml
# .github/workflows/claude-agent.yml
name: Claude Agent Fix

on:
  issues:
    types: [labeled]

jobs:
  fix-issue:
    if: github.event.label.name == 'agent'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Read the GitHub issue below and fix the problem.
            Create a branch, commit the fix, and open a PR.

            Issue Title: ${{ github.event.issue.title }}
            Issue Body: ${{ github.event.issue.body }}
```

---

## 7. Workflow B: Deploy (Merge to Production)

### What Triggers It
- A Pull Request is merged into the `main` branch

### What Happens Step by Step

```
1. GitHub detects: Push to main branch (PR merged)
        |
2. GitHub spins up a fresh Ubuntu VM (runner)
        |
3. Runner executes the workflow steps:
   a. Checks out the repository
   b. Builds Docker image from your Dockerfile
   c. Pushes the image to a Container Registry
      (Google Artifact Registry or Docker Hub)
        |
4. Runner connects to YOUR GCP instance via SSH:
   a. Runs: docker pull <new-image-from-registry>
   b. Runs: docker stop <old-container>
   c. Runs: docker run <new-image>
        |
5. GitHub VM is destroyed
        |
6. Your GCP instance is now running the updated code
```

### Why Use a Container Registry?

```
WITHOUT registry (won't work):
  GitHub VM ---[giant Docker image]--->  GCP Instance
  (no direct connection, different networks)

WITH registry (correct approach):
  GitHub VM --push-->  Registry  <--pull--  GCP Instance
  (both can access the registry independently)
```

The registry is a middleman. GitHub VM builds the image and uploads it. Your GCP downloads it. They never need a direct connection for the image transfer.

### How GitHub VM Connects to GCP

GitHub Actions uses SSH to run commands on your GCP:

```
Setup (one-time):
  1. Generate SSH key pair
  2. Put the PRIVATE key in GitHub Secrets (Settings > Secrets > SSH_PRIVATE_KEY)
  3. Put the PUBLIC key on your GCP instance (~/.ssh/authorized_keys)

During workflow:
  1. GitHub VM loads the private key from secrets
  2. Connects: ssh user@your-gcp-ip
  3. Runs commands: docker pull, docker stop, docker run
  4. Disconnects
```

### Simplified Workflow File Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: pytest tests/

  deploy:
    needs: test  # Only deploy if tests pass
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t your-registry/cataract-assistant:latest .

      - name: Push to registry
        run: docker push your-registry/cataract-assistant:latest

      - name: Deploy to GCP
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.GCP_HOST }}
          username: ${{ secrets.GCP_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            docker pull your-registry/cataract-assistant:latest
            docker stop cataract-app || true
            docker rm cataract-app || true
            docker run -d --name cataract-app -p 8000:8000 your-registry/cataract-assistant:latest
```

---

## 8. Error Monitoring and Auto-Remediation

### How Monitoring Works

```
YOUR APP (running on GCP)
    |
    | Sentry/New Relic SDK is embedded in your code
    | (a few lines added to backend/main.py and frontend/App.tsx)
    |
    | When an error happens:
    |   - SDK captures: error message, stack trace, request URL,
    |     user info, timestamp, environment variables
    |   - SDK sends this data to Sentry/New Relic cloud servers
    |
    v
SENTRY / NEW RELIC DASHBOARD
    |
    | You see: all errors, their frequency, affected users
    | You configure Alert Policy:
    |   "If any new error occurs -> trigger webhook"
    |
    v
WEBHOOK FIRES
    |
    | Sentry sends HTTP POST to GitHub API:
    |   POST https://api.github.com/repos/your/repo/issues
    |   Body: {
    |     title: "Production Error: TypeError in chat_service.py:245",
    |     body: "Stack trace: ...\nEndpoint: POST /ask\nCount: 12 in 5min",
    |     labels: ["agent", "production-bug"]
    |   }
    |
    v
GITHUB ISSUE #44 CREATED AUTOMATICALLY
    |
    | Has label "agent" -> triggers Workflow A
    |
    v
CLAUDE CODE AGENT FIXES IT
    |
    v
PR OPENED -> YOU REVIEW -> MERGE -> AUTO-DEPLOY
```

### What Monitoring Covers vs What It Does NOT

| Monitoring Catches (Production) | Monitoring Does NOT Catch |
|---|---|
| Runtime crashes and exceptions | Test failures in CI (GitHub Actions handles this) |
| API errors (500, 404, timeouts) | Code style issues (linters handle this) |
| Performance degradation (slow queries) | Security vulnerabilities (security scanners handle this) |
| Memory leaks, high CPU usage | Bugs that don't cause errors (logic bugs) |

### Test Failures vs Production Errors

These are two different things handled differently:

```
TEST FAILURES (caught in CI):
  You open PR -> GitHub Actions runs tests -> tests FAIL -> PR is blocked
  No New Relic involved. This is purely GitHub Actions.
  You (or the agent) fix the tests before merging.

PRODUCTION ERRORS (caught by monitoring):
  Code is already deployed -> users hit a bug -> app crashes
  New Relic/Sentry catches it -> creates GitHub issue -> agent fixes it
  This is the monitoring + auto-remediation flow.
```

---

## 9. The Complete Connected Flow

All three phases linked together:

```
=================================================================
              PHASE A: YOU REQUEST A FEATURE
=================================================================

  You create GitHub Issue:
  "Add patient age display on module cards"
  You add label: "agent"
           |
           v
  WORKFLOW A fires (GitHub VM)
  -> Claude Code reads issue + CLAUDE.md
  -> Searches relevant files
  -> Implements the feature
  -> Runs tests
  -> Opens PR #42
           |
           v
  GitHub Actions runs test suite on PR
  -> All 70 API + 8 E2E + 5 edge case tests pass
  -> PR shows green checkmark
           |
           v
  You review PR #42 -> Approve -> Merge to main
           |
           v
  WORKFLOW B fires (GitHub VM)
  -> Builds Docker image
  -> Pushes to container registry
  -> SSHs into GCP
  -> Pulls new image, restarts containers
           |
           v
  Feature is live on production


=================================================================
              PHASE B: PRODUCTION ERROR OCCURS
=================================================================

  Patient opens chatbot -> app crashes with TypeError
           |
           v
  Sentry catches:
  "TypeError in chat_service.py:245 - NoneType has no attribute 'get'"
  Stack trace, request URL, timestamp included
           |
           v
  Alert policy triggers -> webhook fires
  -> Auto-creates GitHub Issue #43
     Title: "Production Error: TypeError in chat_service.py:245"
     Body: full stack trace + request context
     Label: "agent"
           |
           v
  WORKFLOW A fires (same as Phase A)
  -> Claude Code reads the stack trace
  -> Goes directly to chat_service.py:245
  -> Understands the bug (patient has no medications_plan)
  -> Adds null check
  -> Runs tests
  -> Opens PR #44
           |
           v
  You review PR #44 -> Approve -> Merge
           |
           v
  WORKFLOW B fires -> deploys the fix
           |
           v
  Bug is fixed in production


=================================================================
              PHASE C: SAFETY GUARDRAILS
=================================================================

  At every stage, safety checks are in place:

  1. PR created by agent -> tests MUST pass before merge is allowed
  2. You ALWAYS review before merging (human-in-the-loop)
  3. If tests fail, PR is blocked -> agent can see failures and retry
  4. Production monitoring continues after deploy -> catches new issues
```

---

## 10. GitHub Runners: Where Does Code Execute?

### GitHub-Hosted Runners (Recommended to Start)

| Aspect | Detail |
|---|---|
| **What** | Temporary VMs provided by GitHub |
| **OS** | Ubuntu (default), Windows, macOS available |
| **Lifecycle** | Created fresh for each workflow run, destroyed after |
| **Cost** | Free for public repos. Private repos: 2,000 min/month free tier |
| **Specs** | 2 CPU, 7GB RAM, 14GB SSD (standard) |
| **State** | No persistence between runs. Clean every time. |

### Self-Hosted Runners (Your GCP Instance — Future Option)

| Aspect | Detail |
|---|---|
| **What** | Your own server registered with GitHub |
| **Setup** | Repo Settings > Actions > Runners > "New self-hosted runner" |
| **OS** | Whatever your GCP runs (Ubuntu, etc.) |
| **Lifecycle** | Always running, persistent |
| **Cost** | No GitHub minutes used. You pay only for GCP instance |
| **State** | Persistent — dependencies stay installed between runs |

### When to Use Which

| Use GitHub-Hosted When | Use Self-Hosted (GCP) When |
|---|---|
| Starting out (simplest setup) | You exceed 2,000 free minutes/month |
| Standard test suites | Tests need private network access (internal DB) |
| No special hardware needed | You need GPU or high RAM |
| Small-to-medium projects | Re-installing dependencies every run is too slow |

### Switching Between Them

Switching is a one-line change in the workflow file:

```yaml
# GitHub-hosted:
runs-on: ubuntu-latest

# Self-hosted (your GCP):
runs-on: self-hosted
```

Everything else stays the same. Start with GitHub-hosted, switch later if needed.

---

## 11. Context and Token Consumption

### The Problem

When you use Claude Code locally, it builds up context over time:

```
LOCAL (your laptop):
  Session 1: Fix auth bug  -> learns codebase
  Session 2: Add feature   -> already knows auth code from session 1
  Session 3: Fix UI bug    -> knows everything from sessions 1+2

  Token cost per task: LOW (has accumulated context)
```

In GitHub Actions, every run starts fresh:

```
GITHUB ACTIONS:
  Issue #1: Fix auth bug   -> reads CLAUDE.md, explores, fixes
  Issue #2: Add feature    -> reads CLAUDE.md again, explores again, fixes
  Issue #3: Fix UI bug     -> reads CLAUDE.md again, no memory of #1 or #2

  Token cost per task: HIGHER (no accumulated context)
```

### Why It's Not As Bad As It Sounds

Claude Code does NOT read the entire codebase every time. Here's what actually happens:

```
Step 1: Read CLAUDE.md                    ~4,000 tokens  (project cheat sheet)
Step 2: Read issue description            ~200 tokens    (the specific problem)
Step 3: Targeted search (Glob/Grep)       ~500 tokens    (find relevant files)
Step 4: Read 2-5 relevant files           ~3,000-8,000 tokens (only what's needed)
Step 5: Write the fix                     ~1,000 tokens
Step 6: Run tests                         ~500 tokens
                                          ─────────────
                                   Total: ~10,000-15,000 tokens per task
```

Compared to a local session with accumulated context:

```
Step 1: Compacted history loaded          ~5,000 tokens
Step 2: You describe the issue            ~20 tokens
Step 3: Claude already knows where to look ~2,000 tokens to read file
                                          ─────────────
                                   Total: ~7,000 tokens per task
```

**The CI run costs about 1.5-2x more tokens per task, not 10x or 100x.**

### How to Minimize Token Usage

1. **Keep CLAUDE.md comprehensive** — It's your project's compressed memory. The better it is, the less Claude needs to explore. (Yours is already excellent.)

2. **Write detailed issue descriptions** — Specific issues save tokens:
   ```
   Bad:  "Chat is broken"
   Good: "POST /ask returns 500 when patient has no medications_plan.
          Stack trace: TypeError in chat_service.py line 245"
   ```

3. **Sentry stack traces are free context** — When Sentry creates an issue with a full stack trace, Claude goes straight to the exact file and line. Minimal exploration needed.

4. **Memory files in the repo** — The `.claude/` memory directory can be committed. CI runs would read those patterns automatically.

### Cost Comparison

| Scenario | Input Tokens | Output Tokens | Approx Cost |
|---|---|---|---|
| Simple bug fix (local, with history) | ~7K | ~2K | ~$0.10 |
| Simple bug fix (CI, fresh start) | ~15K | ~3K | ~$0.25 |
| Medium feature (local) | ~30K | ~10K | ~$0.60 |
| Medium feature (CI, fresh start) | ~50K | ~15K | ~$1.00 |

For 5-10 issues per week via the agent: approximately **$5-15/week** in API costs.

---

## 12. What You Need to Set Up

| # | What | Purpose | Prerequisites |
|---|---|---|---|
| 1 | **GitHub Actions: Test workflow** | Run tests on every PR to catch bugs before merge | Test suite (already have: 70 API + 8 E2E + 5 edge case) |
| 2 | **GitHub Actions: Deploy workflow** | Auto-deploy to GCP when PRs merge to main | SSH key to GCP, Docker registry account |
| 3 | **Claude Code GitHub Action** | AI agent that reads issues, fixes code, opens PRs | Anthropic API key in GitHub Secrets |
| 4 | **Sentry or New Relic** | Catch production errors with full stack traces | SDK added to FastAPI (backend) and React (frontend) |
| 5 | **Alert to GitHub webhook** | Auto-create GitHub issues from production errors | Alert policy configured in Sentry/New Relic |

### GitHub Secrets Required

These are stored in: Repository Settings > Secrets and Variables > Actions

| Secret Name | What It Is | Used By |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude | Workflow A (agent) |
| `GCP_HOST` | Your GCP instance IP address | Workflow B (deploy) |
| `GCP_USER` | SSH username on your GCP instance | Workflow B (deploy) |
| `SSH_PRIVATE_KEY` | Private SSH key for GCP access | Workflow B (deploy) |
| `REGISTRY_USERNAME` | Docker Hub or Artifact Registry username | Workflow B (deploy) |
| `REGISTRY_PASSWORD` | Docker Hub or Artifact Registry password/token | Workflow B (deploy) |

---

## 13. GCP Instance Requirements

Your existing GCP instance needs:

| Requirement | Why | You Likely Already Have It |
|---|---|---|
| Docker installed | To run containers | Yes (you deploy with Docker) |
| SSH access enabled | For GitHub Actions to connect | Yes (you SSH manually today) |
| Public IP or domain | So GitHub runners can reach it | Yes |
| Port 8000 open | Backend API | Yes |
| Port 3000 open | Frontend (if served from GCP) | Yes |

**New additions needed:**
- Public key added to `~/.ssh/authorized_keys` (for the deploy workflow)
- Docker configured to pull from your chosen container registry

---

## 14. Safety Guardrails

### Human-in-the-Loop (Critical)

The agent NEVER auto-merges or auto-deploys without your approval:

```
Agent creates PR -> YOU review -> YOU merge -> auto-deploy
                    ^^^^^^^^^    ^^^^^^^^^^
                    These steps are ALWAYS manual
```

### Branch Protection Rules

Configure on GitHub (Settings > Branches > Branch protection rules for `main`):

- Require pull request reviews before merging
- Require status checks to pass (tests must be green)
- Do not allow bypassing the above settings

### Test Gate

Every PR (whether from you or the agent) must pass tests before merge:

```
PR opened -> GitHub Actions runs tests -> Pass? -> Allow merge
                                       -> Fail? -> Block merge
```

---

## 15. What This Does NOT Do

| The system does NOT... | Why |
|---|---|
| Auto-merge PRs without your review | Too risky. AI can make mistakes. Human review is critical. |
| Access your database directly | Claude Code edits code files. It doesn't connect to Supabase. |
| Run on your GCP instance (for agent work) | Agent runs on GitHub's temporary VMs. Only deployment touches GCP. |
| Replace your judgment | It proposes fixes. You decide whether to accept them. |
| Fix bugs it can't reproduce | If the bug requires running the app with real data, the agent may not catch it. |
| Handle infrastructure changes | Server configs, DNS, SSL certificates — these remain manual. |

---

## 16. Cost Estimates

### GitHub Actions (Runner Minutes)

| Plan | Free Minutes/Month | Overage Cost |
|---|---|---|
| Free (public repo) | Unlimited | N/A |
| Free (private repo) | 2,000 minutes | $0.008/min |
| Pro (private repo) | 3,000 minutes | $0.008/min |

Estimated usage: 10-20 workflow runs/week x 10 min each = 400-800 min/month. Well within free tier.

### Anthropic API (Claude Code)

| Usage | Est. Monthly Cost |
|---|---|
| 5-10 agent fixes per week | $20-60/month |
| Heavy usage (20+ fixes/week) | $80-150/month |

### Monitoring (Sentry)

| Plan | Cost | Includes |
|---|---|---|
| Developer (free) | $0 | 5K errors/month, 1 user |
| Team | $26/month | 50K errors/month, unlimited users |

### Container Registry

| Service | Cost |
|---|---|
| Docker Hub (free) | 1 private repo, unlimited public |
| Google Artifact Registry | ~$0.10/GB stored, free egress within GCP |

### Total Estimated Monthly Cost

```
GitHub Actions:           $0 (within free tier)
Anthropic API:            $20-60
Sentry:                   $0 (free tier)
Container Registry:       $0-5
                          ─────────
Total:                    $20-65/month
```

---

## 17. Implementation Order

| Step | What | Priority | Complexity |
|---|---|---|---|
| **1** | GitHub Actions: Test workflow (run tests on every PR) | **Do first** | Low |
| **2** | GitHub Actions: Deploy workflow (auto-deploy on merge to main) | **Do second** | Medium |
| **3** | Claude Code GitHub Action (AI agent for issues) | **Do third** | Low |
| **4** | Sentry integration (error monitoring) | **Do fourth** | Low-Medium |
| **5** | Sentry -> GitHub webhook (auto-create issues from errors) | **Do fifth** | Low |

**Why this order:**
- Step 1 gives you immediate value: no more deploying broken code
- Step 2 eliminates your manual SSH + pull + docker routine
- Step 3 adds the AI agent on top of a working CI/CD foundation
- Steps 4-5 close the loop with production monitoring

Each step is independent and valuable on its own. You don't need all 5 to benefit — even just Step 1+2 transforms your workflow.

---

## Quick Reference: File Locations

```
.github/
  workflows/
    test.yml                    # Run tests on every PR
    deploy.yml                  # Deploy to GCP on merge to main
    claude-agent.yml            # AI agent fixes issues

CLAUDE.md                       # Project documentation (agent reads this)
.claude/
  memory/                       # Persistent patterns (agent reads these too)

docs/
  autonomous-development-pipeline.md   # This document
```

---

*This document will be updated as the pipeline is implemented and refined.*
