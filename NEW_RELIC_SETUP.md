# New Relic Setup Guide

> **Purpose:** Step-by-step guide to integrate New Relic for application monitoring
> **Free Tier:** 100 GB/month, 1 full user, all features included

---

## Table of Contents

1. [What is New Relic?](#what-is-new-relic)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create New Relic Account](#step-1-create-new-relic-account)
4. [Step 2: Get Your License Key](#step-2-get-your-license-key)
5. [Step 3: Install Python Agent (Backend)](#step-3-install-python-agent-backend)
6. [Step 4: Update Docker Configuration](#step-4-update-docker-configuration)
7. [Step 5: Deploy to Production](#step-5-deploy-to-production)
8. [Step 6: Verify in New Relic Dashboard](#step-6-verify-in-new-relic-dashboard)
9. [Understanding the Dashboard](#understanding-the-dashboard)
10. [Common Queries (NRQL)](#common-queries-nrql)
11. [Stop/Start New Relic](#stopstart-new-relic)
12. [Troubleshooting](#troubleshooting)

---

## What is New Relic?

New Relic is an observability platform that provides:

| Feature | What it does |
|---------|--------------|
| **APM** | Track application performance (response times, throughput) |
| **Logs** | Collect and search application logs |
| **Errors** | Catch and group exceptions automatically |
| **Traces** | See how requests flow through your system |
| **Dashboards** | Visualize metrics with charts and graphs |
| **Alerts** | Get notified when something goes wrong |

### Free Tier Limits

| Resource | Free Limit | Your Usage (estimated) |
|----------|------------|------------------------|
| Data ingestion | 100 GB/month | ~10-20 GB/month |
| Full users | 1 user | 1 (you) |
| Basic users | Unlimited | For team members (read-only) |
| Data retention | 8 days | Enough for debugging |

---

## Prerequisites

Before starting:

- [ ] GCP Ops Agent stopped (optional, can run both)
- [ ] Access to your VM via SSH
- [ ] Docker and docker-compose installed
- [ ] Your application running

### Stop GCP Agent (Optional)

If you want to use ONLY New Relic:

```bash
# SSH into VM
gcloud compute ssh instance-20251226-113214 --zone=asia-south1-c

# Stop GCP agent
sudo systemctl stop google-cloud-ops-agent
sudo systemctl disable google-cloud-ops-agent
```

---

## Step 1: Create New Relic Account

1. Go to: **https://newrelic.com/signup**

2. Click **"Start for free"**

3. Fill in:
   - Email: your-email@domain.com
   - Password: (create a strong password)
   - Name: Your Name
   - Company: IKITES (or your company)

4. **No credit card required!**

5. Verify your email

6. You'll land on the New Relic dashboard

---

## Step 2: Get Your License Key

1. In New Relic dashboard, click on your **profile icon** (bottom left)

2. Click **"API keys"**

3. Find **"INGEST - LICENSE"** key

4. Click **"Copy key"**

5. Save this key - you'll need it:
   ```
   YOUR_LICENSE_KEY_HERE (looks like: eu01xxNRAL...)
   ```

### Alternative: Find key via UI

1. Go to: **Add Data** (left sidebar)
2. Search for "Python"
3. Click "Python"
4. The license key will be shown in the setup instructions

---

## Step 3: Install Python Agent (Backend)

### 3.1 Add to requirements.txt

Add this line to `backend/requirements.txt`:

```
newrelic
```

### 3.2 Create newrelic.ini Configuration File

Create file `backend/newrelic.ini`:

```ini
# New Relic Python Agent Configuration
# Documentation: https://docs.newrelic.com/docs/agents/python-agent/configuration

[newrelic]
# Your New Relic license key (get from New Relic dashboard)
license_key = YOUR_LICENSE_KEY_HERE

# Application name (appears in New Relic dashboard)
app_name = Cataract Counsellor API

# Enable/disable the agent (set to false to disable without removing code)
monitor_mode = true

# Logging level for the agent itself
log_level = info

# Log file location (inside container)
log_file = /tmp/newrelic-python-agent.log

# Enable distributed tracing (recommended)
distributed_tracing.enabled = true

# Transaction tracer settings
transaction_tracer.enabled = true
transaction_tracer.transaction_threshold = apdex_f
transaction_tracer.record_sql = obfuscated
transaction_tracer.stack_trace_threshold = 0.5

# Error collector settings
error_collector.enabled = true
error_collector.ignore_errors =
error_collector.ignore_status_codes = 100-102 200-208 226 300-308

# Browser monitoring (not needed for API-only backend)
browser_monitoring.auto_instrument = false

# Custom attributes
labels = environment:production;team:backend
```

### 3.3 Update Backend Dockerfile

Edit `backend/Dockerfile` to use New Relic:

**Option A: Wrap the startup command (Recommended)**

```dockerfile
# Add near the end of your Dockerfile, before CMD

# Copy New Relic config
COPY newrelic.ini /app/newrelic.ini

# Set New Relic environment variable
ENV NEW_RELIC_CONFIG_FILE=/app/newrelic.ini

# Change CMD to use newrelic-admin
CMD ["newrelic-admin", "run-program", "uvicorn", "adk_app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Option B: Use environment variables only (Alternative)**

```dockerfile
# Add these environment variables
ENV NEW_RELIC_LICENSE_KEY=your_license_key_here
ENV NEW_RELIC_APP_NAME="Cataract Counsellor API"
ENV NEW_RELIC_LOG_LEVEL=info
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true

# Change CMD to use newrelic-admin
CMD ["newrelic-admin", "run-program", "uvicorn", "adk_app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Step 4: Update Docker Configuration

### 4.1 Option A: Use docker-compose.yml environment variables

Edit `docker-compose.yml`:

```yaml
version: "3.9"

services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    env_file:
      - backend/.env
    environment:
      # New Relic configuration
      - NEW_RELIC_LICENSE_KEY=your_license_key_here
      - NEW_RELIC_APP_NAME=Cataract Counsellor API
      - NEW_RELIC_LOG_LEVEL=info
      - NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
    volumes:
      - ./backend/data:/app/data
    ports:
      - "8000:8000"
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: cataract-ui/Dockerfile
      args:
        VITE_API_URL: http://35.244.44.106:8000
    depends_on:
      - backend
    ports:
      - "3000:80"
    restart: unless-stopped
```

### 4.2 Option B: Add to backend/.env (Simpler)

Add to `backend/.env`:

```bash
# New Relic Configuration
NEW_RELIC_LICENSE_KEY=your_license_key_here
NEW_RELIC_APP_NAME=Cataract Counsellor API
NEW_RELIC_LOG_LEVEL=info
NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
```

---

## Step 5: Deploy to Production

### 5.1 SSH into your VM

```bash
gcloud compute ssh instance-20251226-113214 --zone=asia-south1-c
```

### 5.2 Navigate to project

```bash
cd /path/to/cataract-assistant
```

### 5.3 Pull latest code

```bash
git pull origin sri-full-architecture
```

### 5.4 Update .env with New Relic key

```bash
nano backend/.env

# Add these lines:
NEW_RELIC_LICENSE_KEY=your_actual_license_key
NEW_RELIC_APP_NAME=Cataract Counsellor API
NEW_RELIC_LOG_LEVEL=info
NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
```

### 5.5 Rebuild and restart

```bash
# Rebuild backend with New Relic
docker-compose build backend

# Restart services
docker-compose down && docker-compose up -d

# Check logs
docker-compose logs -f backend --tail=50
```

### 5.6 Look for New Relic startup message

You should see in logs:
```
New Relic Python Agent (x.x.x)
```

---

## Step 6: Verify in New Relic Dashboard

### 6.1 Generate some traffic

```bash
# From your VM or local machine
curl https://cataract-assistant.ikites.ai/api/healthz
curl https://cataract-assistant.ikites.ai/api/docs
```

Or log in through the web interface.

### 6.2 Check New Relic Dashboard

1. Go to: **https://one.newrelic.com**

2. Click **"APM & Services"** (left sidebar)

3. You should see **"Cataract Counsellor API"**

4. Click on it to see:
   - Response times
   - Throughput (requests/minute)
   - Error rate
   - Recent transactions

### 6.3 Data appears within 2-5 minutes

If you don't see data:
- Wait 5 minutes
- Check docker logs for errors
- Verify license key is correct

---

## Understanding the Dashboard

### APM Overview Page

| Section | What it shows |
|---------|---------------|
| **Web transactions time** | Average response time breakdown |
| **Throughput** | Requests per minute |
| **Error rate** | Percentage of failed requests |
| **Apdex score** | User satisfaction (0-1, higher is better) |

### Transactions Tab

Shows individual endpoints:
- `/api/auth/login` - Login endpoint
- `/ask` - Chat endpoint
- `/doctor/uploads/patient` - File upload

Click on a transaction to see:
- Average duration
- Slowest traces
- Database queries

### Errors Tab

Shows caught exceptions:
- Error message
- Stack trace
- How often it occurs
- Which users affected

### Logs Tab

Shows application logs (if configured):
- Searchable
- Filterable by time
- Linked to transactions

---

## Common Queries (NRQL)

New Relic uses NRQL (New Relic Query Language) - similar to SQL.

### Find Slow Requests

```sql
SELECT average(duration)
FROM Transaction
WHERE appName = 'Cataract Counsellor API'
FACET name
SINCE 1 hour ago
```

### Count Requests by Endpoint

```sql
SELECT count(*)
FROM Transaction
WHERE appName = 'Cataract Counsellor API'
FACET name
SINCE 1 day ago
```

### Find Errors

```sql
SELECT count(*)
FROM TransactionError
WHERE appName = 'Cataract Counsellor API'
FACET error.message
SINCE 1 day ago
```

### Response Time Over Time

```sql
SELECT average(duration)
FROM Transaction
WHERE appName = 'Cataract Counsellor API'
TIMESERIES
SINCE 1 day ago
```

### Find Specific User's Requests

If you add custom attributes:
```sql
SELECT *
FROM Transaction
WHERE appName = 'Cataract Counsellor API'
AND user_email = 'admin@cataract.com'
SINCE 1 hour ago
```

---

## Stop/Start New Relic

### Disable New Relic (Without Removing Code)

**Option 1: Environment variable**
```bash
# In backend/.env, add:
NEW_RELIC_ENABLED=false

# Restart
docker-compose restart backend
```

**Option 2: In newrelic.ini**
```ini
[newrelic]
monitor_mode = false
```

### Re-enable New Relic

```bash
# Remove or set to true:
NEW_RELIC_ENABLED=true
# Or in newrelic.ini:
monitor_mode = true

# Restart
docker-compose restart backend
```

### Completely Remove New Relic

1. Remove from `requirements.txt`:
   ```
   # Remove: newrelic
   ```

2. Remove from Dockerfile:
   ```dockerfile
   # Change back to:
   CMD ["uvicorn", "adk_app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

3. Remove environment variables from `.env`

4. Rebuild and restart:
   ```bash
   docker-compose build backend
   docker-compose down && docker-compose up -d
   ```

---

## Troubleshooting

### Issue: No data in New Relic dashboard

**Check 1: Verify agent is running**
```bash
docker-compose logs backend | grep -i "new relic"
# Should see: "New Relic Python Agent (x.x.x)"
```

**Check 2: Verify license key**
```bash
docker-compose exec backend env | grep NEW_RELIC
# Should show your license key
```

**Check 3: Check agent logs**
```bash
docker-compose exec backend cat /tmp/newrelic-python-agent.log
```

### Issue: "License key invalid" error

1. Go to New Relic dashboard
2. Profile → API Keys
3. Copy the INGEST - LICENSE key (not the User key)
4. Update your .env file
5. Restart: `docker-compose restart backend`

### Issue: High overhead/slow performance

Reduce sampling rate in `newrelic.ini`:
```ini
[newrelic]
# Only trace 10% of transactions
transaction_tracer.transaction_threshold = 2.0
```

### Issue: Too much data ingested (hitting free limit)

1. Reduce log verbosity
2. Disable transaction tracing for health endpoints:
   ```ini
   [newrelic]
   rules.ignore_url_regexes = ^/healthz$;^/health$
   ```

---

## Comparison: GCP vs New Relic

| Feature | GCP Logging | New Relic |
|---------|-------------|-----------|
| **View logs** | Logs Explorer | Logs tab |
| **Query language** | GCP Query | NRQL (SQL-like) |
| **APM** | Limited | Full featured |
| **Error tracking** | Manual search | Automatic grouping |
| **Dashboards** | Basic | Advanced |
| **Cost** | Pay per GB | 100 GB free |

---

## Quick Reference

| Task | Command/Action |
|------|----------------|
| **Start New Relic** | Set `NEW_RELIC_ENABLED=true` + restart |
| **Stop New Relic** | Set `NEW_RELIC_ENABLED=false` + restart |
| **View dashboard** | https://one.newrelic.com |
| **Check agent** | `docker-compose logs backend \| grep "new relic"` |
| **Update license key** | Edit `backend/.env` → restart |

---

## Next Steps After Setup

1. [ ] Set up alerting for errors
2. [ ] Create custom dashboards
3. [ ] Add custom attributes (user_id, clinic_id) to transactions
4. [ ] Configure log forwarding (optional)
5. [ ] Invite team members as basic users

---

## Additional Resources

- [New Relic Python Agent Docs](https://docs.newrelic.com/docs/agents/python-agent/)
- [NRQL Query Reference](https://docs.newrelic.com/docs/query-your-data/nrql-new-relic-query-language/)
- [New Relic University (Free Training)](https://learn.newrelic.com/)
- [New Relic Community Forum](https://forum.newrelic.com/)

---

## Alerting System Management

### Setting Up Error Alerts

1. Go to **Alerts → Alert Policies → Create a policy**
2. Name it: `Cataract Counsellor Alerts`
3. Click **Create a condition** → Select **NRQL**
4. Use this query for error rate alerts:
   ```sql
   SELECT (count(apm.service.error.count) / count(apm.service.transaction.duration)) * 100
   AS 'Error rate (%)'
   FROM Metric
   WHERE appName = 'Cataract Counsellor API'
   ```
5. Set threshold:
   - **Static** (not Anomaly)
   - **Above 1** for at least **1 minute** (for testing)
   - **Above 5** for at least **5 minutes** (for production)
6. Add notification channel (Email/Slack)

### Disable Alerts Only (Keep Monitoring)

**Option A: Disable a single alert condition**
1. Go to **Alerts → Alert Conditions**
2. Find your condition (e.g., `Cataract API - High Error Rate`)
3. Click **three dots (...)** → **Disable**

**Option B: Disable entire policy**
1. Go to **Alerts → Alert Policies**
2. Find your policy → Click **three dots (...)** → **Disable policy**

**Option C: Delete alerts completely**
1. Go to **Alerts → Alert Policies**
2. Click on the policy → **Delete policy**

### Re-enable Alerts

1. Go to **Alerts → Alert Policies**
2. Find your disabled policy
3. Click **three dots (...)** → **Enable policy**

Or for individual conditions:
1. Go to **Alerts → Alert Conditions**
2. Find the disabled condition → **Enable**

---

## Complete Disconnection & Reactivation

### Stop Everything (Complete Disconnection)

**Step 1: Update Dockerfile**

Change the CMD back to run without New Relic:

```dockerfile
# Current (with New Relic):
CMD ["newrelic-admin", "run-program", "uvicorn", "adk_app.api.app:app", "--host", "0.0.0.0", "--port", "8000"]

# Change to (without New Relic):
CMD ["uvicorn", "adk_app.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Comment out environment variables (optional)**

In `backend/.env`:
```bash
# NEW_RELIC_LICENSE_KEY=your_license_key_here
# NEW_RELIC_APP_NAME=Cataract Counsellor API
```

**Step 3: Redeploy**
```bash
docker-compose build backend
docker-compose down && docker-compose up -d
```

**Step 4: Delete from New Relic Dashboard (optional)**
1. Go to **APM & Services**
2. Click on `Cataract Counsellor API`
3. Click **Settings** (gear icon) → **Delete application**

### Reactivate Everything

**Step 1: Update Dockerfile**

Add `newrelic-admin` wrapper back:

```dockerfile
CMD ["newrelic-admin", "run-program", "uvicorn", "adk_app.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Uncomment environment variables**

In `backend/.env`:
```bash
NEW_RELIC_LICENSE_KEY=your_license_key_here
NEW_RELIC_APP_NAME=Cataract Counsellor API
NEW_RELIC_LOG_LEVEL=info
```

**Step 3: Redeploy**
```bash
docker-compose build backend
docker-compose down && docker-compose up -d
```

**Step 4: Verify**
```bash
docker-compose logs backend | grep -i "new relic"
# Should see: "New Relic Python Agent (x.x.x)"
```

**Step 5: Re-enable alerts**
1. Go to **Alerts → Alert Policies**
2. Enable your policy and conditions

---

## Free Tier Limits & Usage Monitoring

### Free Tier Limits

| Resource | Free Limit | After Limit |
|----------|------------|-------------|
| **Data ingestion** | 100 GB/month | $0.40/GB |
| **Full users** | 1 user | $99/user/month |
| **Basic users** | Unlimited | Free |
| **Data retention** | 8 days | Paid plans for longer |
| **Credit card required** | No | - |
| **Expiry** | Never | Forever free |

### Where to Check Your Usage

**Method 1: Usage Dashboard**
1. Go to [one.newrelic.com](https://one.newrelic.com)
2. Click your **profile icon** (bottom left)
3. Click **Administration** → **Plan & Usage**
4. Or direct link: [one.newrelic.com/usage](https://one.newrelic.com/usage)

**Method 2: NRQL Query**
```sql
SELECT sum(GigabytesIngested)
FROM NrConsumption
WHERE productLine = 'DataPlatform'
SINCE 1 month ago
```

### Expected Usage for Cataract Counsellor

| Traffic Level | Estimated Usage |
|---------------|-----------------|
| Low (dev/testing) | 1-5 GB/month |
| Medium (50-100 users/day) | 10-20 GB/month |
| High (500+ users/day) | 30-50 GB/month |

**You're unlikely to exceed the 100 GB free tier** with normal usage.

### Tips to Reduce Data Ingestion

1. **Ignore health check endpoints:**
   ```ini
   # In newrelic.ini
   rules.ignore_url_regexes = ^/healthz$;^/health$;^/api/healthz$
   ```

2. **Reduce log verbosity:**
   ```bash
   NEW_RELIC_LOG_LEVEL=warning  # Instead of info
   ```

3. **Disable transaction tracing for noisy endpoints:**
   ```ini
   transaction_tracer.transaction_threshold = 2.0  # Only trace slow requests
   ```

### Set Up Usage Alert (Optional)

Create an alert when approaching the limit:

1. **Alerts → Create condition → NRQL**
2. Query:
   ```sql
   SELECT sum(GigabytesIngested)
   FROM NrConsumption
   WHERE productLine = 'DataPlatform'
   SINCE 1 month ago
   ```
3. Threshold: **Above 80** (80 GB = 80% of free tier)

---

## GCP Logging Comparison

| Aspect | New Relic | GCP Cloud Logging |
|--------|-----------|-------------------|
| **Free data** | 100 GB/month | 50 GB/month |
| **Over-limit cost** | $0.40/GB | $0.50/GB |
| **Retention** | 8 days | 30 days |
| **Best for** | APM, errors, traces | Raw logs, debugging |
| **Alerting** | Built-in | Via Cloud Monitoring |
| **NRQL/Query** | SQL-like | Custom syntax |

### Check GCP Usage

1. Go to [GCP Console](https://console.cloud.google.com)
2. Navigate to: **Billing → Reports**
3. Or: **Logging → Logs Router → View usage**

---

## Quick Action Summary

| What You Want | How to Do It |
|---------------|--------------|
| Pause alerts temporarily | Alerts → Policies → Disable |
| Stop alerts permanently | Alerts → Policies → Delete |
| Stop monitoring (keep history) | Remove `newrelic-admin` from Dockerfile, redeploy |
| Delete everything | Above + delete app from dashboard |
| Check usage | Profile → Administration → Plan & Usage |
| Reactivate monitoring | Add `newrelic-admin` back to Dockerfile, redeploy |
| Reactivate alerts | Alerts → Policies → Enable |

---

*Last Updated: February 5, 2026*
