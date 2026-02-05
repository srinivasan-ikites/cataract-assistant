# GCP Ops Agent - Setup Documentation

> **Date Configured:** February 4, 2026
> **VM Name:** instance-20251226-113214
> **Purpose:** Send application logs and system metrics to Google Cloud for monitoring

---

## QUICK START: Stop/Start Commands

### STOP GCP Logging (When Using New Relic or Other Tools)

```bash
# SSH into your VM first
gcloud compute ssh instance-20251226-113214 --zone=asia-south1-c

# Stop the agent (logs will stop being sent to GCP)
sudo systemctl stop google-cloud-ops-agent

# Verify it's stopped
sudo systemctl status google-cloud-ops-agent
# Should show: "Active: inactive (dead)"

# OPTIONAL: Disable auto-start on boot
sudo systemctl disable google-cloud-ops-agent
```

### START GCP Logging Again

```bash
# SSH into your VM first
gcloud compute ssh instance-20251226-113214 --zone=asia-south1-c

# Start the agent
sudo systemctl start google-cloud-ops-agent

# Verify it's running
sudo systemctl status google-cloud-ops-agent
# Should show: "Active: active (exited)"

# OPTIONAL: Enable auto-start on boot
sudo systemctl enable google-cloud-ops-agent
```

### Check Current Status

```bash
sudo systemctl status google-cloud-ops-agent
```

| Status | Meaning |
|--------|---------|
| `Active: active (exited)` | Running, sending logs to GCP |
| `Active: inactive (dead)` | Stopped, NOT sending logs |
| `Loaded: enabled` | Will start on boot |
| `Loaded: disabled` | Will NOT start on boot |

---

## What Was Done

### Summary
Installed Google Cloud Ops Agent on the VM to:
1. Collect **metrics** (CPU, Memory, Disk usage) and send to Cloud Monitoring
2. Collect **logs** (Docker container logs, system logs) and send to Cloud Logging

### Components Installed
- **Google Cloud Ops Agent** - Main service that coordinates everything
- **Fluent Bit** - Sub-agent that collects and forwards logs
- **OpenTelemetry Collector** - Sub-agent that collects and forwards metrics

### Files Created/Modified
| File | Purpose |
|------|---------|
| `/etc/google-cloud-ops-agent/config.yaml` | Main configuration file |
| `/var/log/google-cloud-ops-agent/` | Agent's own log files |
| `/run/google-cloud-ops-agent-fluent-bit/` | Generated Fluent Bit config |

### APIs Enabled
- `monitoring.googleapis.com` - For sending metrics
- `logging.googleapis.com` - For sending logs

---

## Quick Reference Commands

### Check Agent Status
```bash
# Is the agent running?
sudo systemctl status google-cloud-ops-agent

# Expected output: "Active: active (exited)" with all checks PASS
```

### View Agent Logs
```bash
# View last 20 lines of agent logs
sudo journalctl -u google-cloud-ops-agent -n 20 --no-pager

# View logs from last 5 minutes
sudo journalctl -u google-cloud-ops-agent --since "5 minutes ago" --no-pager

# View Fluent Bit (log collector) logs
sudo journalctl -u google-cloud-ops-agent-fluent-bit -n 20 --no-pager

# View detailed Fluent Bit logs
sudo tail -50 /var/log/google-cloud-ops-agent/subagents/logging-module.log
```

### Restart Agent (after config changes)
```bash
# Restart the agent
sudo systemctl restart google-cloud-ops-agent

# Check status after restart
sudo systemctl status google-cloud-ops-agent
```

### View/Edit Configuration
```bash
# View current config
sudo cat /etc/google-cloud-ops-agent/config.yaml

# Edit config
sudo nano /etc/google-cloud-ops-agent/config.yaml

# After editing, always restart:
sudo systemctl restart google-cloud-ops-agent
```

### View Docker Logs Locally
```bash
# List running containers
docker ps

# View logs for a specific container
docker logs <container_name>

# View last 50 lines of backend logs
docker logs cataract-assistant_backend_1 --tail 50

# Follow logs in real-time (Ctrl+C to stop)
docker logs cataract-assistant_backend_1 -f

# View raw Docker log file
LOGFILE=$(sudo find /var/lib/docker/containers -name "*-json.log" | head -1)
sudo tail -20 "$LOGFILE"
```

### Check What Fluent Bit is Watching
```bash
# See which files Fluent Bit is monitoring
sudo cat /run/google-cloud-ops-agent-fluent-bit/fluent_bit_main.conf | grep -A 5 "Path"

# Check if Docker log files exist
sudo ls -la /var/lib/docker/containers/
```

### Troubleshooting Commands
```bash
# Check if APIs are enabled
gcloud services list --enabled | grep -E "(monitoring|logging)"

# Check if Fluent Bit process is running
ps aux | grep fluent

# Check if metrics collector is running
ps aux | grep otel

# View all Ops Agent related processes
ps aux | grep google-cloud-ops

# Check disk space (logs can fill disk)
df -h

# Check agent version
dpkg -l | grep google-cloud-ops-agent
```

### Generate Test Logs
```bash
# Hit health endpoint (creates a log entry)
curl http://localhost:8000/healthz

# Hit docs endpoint
curl http://localhost:8000/docs

# These will appear in GCP Logs Explorer within 1-2 minutes
```

---

## GCP Console URLs

### Logs Explorer (View Application Logs)
```
https://console.cloud.google.com/logs/query
```

### Metrics Explorer (View CPU, Memory, Disk)
```
https://console.cloud.google.com/monitoring/metrics-explorer
```

### Alerting (Set Up Alerts)
```
https://console.cloud.google.com/monitoring/alerting
```

---

## Log Query Reference

### Query Syntax Basics

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Exact match | `field="value"` |
| `!=` | Not equal | `field!="value"` |
| `=~` | Regex match | `field=~"pattern"` |
| `-` | Exclude | `-field="value"` |
| `AND` | Both conditions | `field1="a" AND field2="b"` |
| `OR` | Either condition | `field1="a" OR field2="b"` |
| `"text"` | Search anywhere | `"error"` |

### Common Queries

**All Application Logs (Exclude SSH Noise):**
```
resource.type="gce_instance"
-jsonPayload.message=~"Invalid user|ssh-rsa|ecdsa-sha2"
-logName=~"syslog"
```

**Only Docker/Application Logs (Recommended):**
```
resource.type="gce_instance"
logName=~"docker"
```

**Find Specific User (Clinic Staff):**
```
resource.type="gce_instance"
"user:admin@cataract.com"
```

**Find Specific Patient:**
```
resource.type="gce_instance"
"patient:P001"
```

**Find Specific Clinic:**
```
resource.type="gce_instance"
"clinic:VIC-MCLEAN-001"
```

**Find Specific Request:**
```
resource.type="gce_instance"
"REQ-abc12345"
```

**Only Errors:**
```
resource.type="gce_instance"
logName=~"docker"
("ERROR" OR "500" OR "Exception")
```

**Find Failed Logins:**
```
resource.type="gce_instance"
("401" OR "Invalid" OR "expired")
```

---

## Current Configuration

The config file at `/etc/google-cloud-ops-agent/config.yaml`:

```yaml
logging:
  receivers:
    docker_logs:
      type: files
      include_paths:
        - /var/lib/docker/containers/*/*-json.log
      record_log_file_path: true
    syslog:
      type: files
      include_paths:
        - /var/log/syslog
        - /var/log/messages
  processors:
    docker_parser:
      type: parse_json
      time_key: time
      time_format: "%Y-%m-%dT%H:%M:%S.%LZ"
  service:
    pipelines:
      docker_pipeline:
        receivers: [docker_logs]
        processors: [docker_parser]
      system_pipeline:
        receivers: [syslog]

metrics:
  receivers:
    hostmetrics:
      type: hostmetrics
      collection_interval: 60s
  service:
    pipelines:
      default_pipeline:
        receivers: [hostmetrics]
```

---

## How Data Flows

```
YOUR APPLICATION
     │
     │ print() / logging.info()
     ▼
DOCKER DAEMON
     │
     │ Writes to /var/lib/docker/containers/{id}/{id}-json.log
     ▼
FLUENT BIT (Ops Agent component)
     │
     │ Watches log files, reads new lines
     │ Parses JSON, extracts log message
     ▼
GOOGLE CLOUD LOGGING API
     │
     │ HTTPS request (authenticated via VM service account)
     ▼
GCP LOGS EXPLORER
     │
     │ Stored, indexed, searchable
     ▼
YOU VIEW IN BROWSER
```

---

## Common Issues & Solutions

### Issue: Logs not appearing in GCP Console
**Solutions:**
1. Check time range in GCP Console (use "Last 5 minutes")
2. Verify agent is running: `sudo systemctl status google-cloud-ops-agent`
3. Check for errors: `sudo journalctl -u google-cloud-ops-agent -n 30`
4. Restart agent: `sudo systemctl restart google-cloud-ops-agent`

### Issue: "API Check: FAIL" in agent logs
**Solution:**
```bash
gcloud services enable monitoring.googleapis.com logging.googleapis.com
sudo systemctl restart google-cloud-ops-agent
```

### Issue: Agent fails to start after config change
**Solution:**
1. Check YAML syntax (indentation must be 2 spaces, no tabs)
2. View error: `sudo journalctl -u google-cloud-ops-agent -n 30`
3. Restore backup: `sudo cp /etc/google-cloud-ops-agent/config.yaml.backup /etc/google-cloud-ops-agent/config.yaml`

### Issue: Disk filling up with logs
**Solution:**
Add log rotation to docker-compose.yml:
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Uninstall (If Needed)

```bash
# Stop the agent
sudo systemctl stop google-cloud-ops-agent

# Uninstall
sudo apt-get remove google-cloud-ops-agent

# Remove config files
sudo rm -rf /etc/google-cloud-ops-agent
```

---

## Additional Resources

- [Ops Agent Documentation](https://cloud.google.com/stackdriver/docs/solutions/agents/ops-agent)
- [Ops Agent Configuration](https://cloud.google.com/stackdriver/docs/solutions/agents/ops-agent/configuration)
- [Cloud Logging Query Language](https://cloud.google.com/logging/docs/view/logging-query-language)
- [Cloud Monitoring Metrics](https://cloud.google.com/monitoring/api/metrics_gcp)

---

*Last Updated: February 5, 2026*





<!-- commands to check the logs -->
 resource.type="gce_instance"
  jsonPayload.log=~".*backend.*|.*Auth.*|.*API.*|.*Uvicorn.*"

  Better Queries for Different Needs

  Query 1: ALL Application Logs (Exclude SSH Noise)

  resource.type="gce_instance"
  -jsonPayload.message=~"Invalid user|ssh-rsa|ecdsa-sha2"
  -logName=~"syslog"

  This shows everything EXCEPT:
  - SSH authentication failures
  - System logs

  ---
  Query 2: Only Docker/Application Logs (Recommended)

  resource.type="gce_instance"
  logName=~"docker"

  This shows ONLY logs from your Docker containers (backend + frontend).

  ---
  Query 3: Only Backend Logs (Most Useful)

  resource.type="gce_instance"
  logName=~"docker"
  jsonPayload.stream="stdout" OR jsonPayload.stream="stderr"

  ---
  Query 4: Only Errors and Warnings

  resource.type="gce_instance"
  logName=~"docker"
  (jsonPayload.log=~"ERROR|Error|error|WARNING|Warning|Exception|Traceback")

  ---
  Query 5: Everything from Your App (Comprehensive)

  resource.type="gce_instance"
  logName=~"docker"
  -jsonPayload.log=~"GET /assets|GET /static|\.js|\.css|\.ico"

  This shows all Docker logs but excludes static file requests (frontend noise).

  ---
  My Recommendation

  Use this as your default query:

  resource.type="gce_instance"
  logName=~"docker"

  Why?
  - Shows ALL your application logs (backend + frontend)
  - Excludes SSH failures automatically
  - Excludes system logs
  - You won't miss any important logs




  <!-- resource.type="gce_instance"
  "patient:" -->

  <!-- resource.type="gce_instance"
  "admin@cataract.com" -->