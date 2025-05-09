# Observability Guidelines for Octomate Event System

This document defines logging, event emission, and monitoring practices for tracking the health and performance of the Octomate event and plugin system.

---

## 🔍 What to Observe

### Core Lifecycle Events (Required)

For every email processed, emit or log:

* `emailReceived`
* `emailTaggedPluginManifest`
* `emailProcessingStart`
* `emailProcessingStop`
* `emailAvailable`

### Plugin Execution Events (Required per plugin)

* `plugin/<name>/start`
* `plugin/<name>/stop` (or `plugin/<name>/failed` if applicable)

### System Metrics (Optional but Recommended)

* Plugin execution durations
* Plugin failure counts by type
* Number of concurrent plugins per email

---

## 📝 Logging Guidelines

### Plugin Lambda Logs

* Use `console.log` or structured logs to include:

  * `pluginName`, `emailId`
  * Start and end timestamps
  * Status: success, error, or timeout
  * Optional `summary` or `outputPreview`

### PluginMgr Logs

* Track plugin manifests per email
* Emit summary logs for each email after plugin set is complete:

```json
{
  "emailId": "abc123",
  "pluginManifest": ["spam", "ics", "digest"],
  "results": {
    "spam": "success",
    "ics": "success",
    "digest": "failed"
  },
  "durationMs": 1837
}
```

---

## 📊 Metrics and Alarms

### Lambda Metrics

| Metric        | Use For                        |
| ------------- | ------------------------------ |
| `Duration`    | Long-running plugins           |
| `Errors`      | Any plugin failing to complete |
| `Throttles`   | Plugin concurrency bottlenecks |
| `Invocations` | Plugin usage statistics        |

### CloudWatch Alarms (Suggested)

* Plugin failure rate > 5% (per hour)
* Any `PutEvents` failure
* DLQ message count for plugin invocations

---

## 📁 EventBridge Observability

### Enable Archive for:

* Replay of missed plugin runs
* Testing new plugin versions against live history
* Forensic debugging

### Use EventBridge Schema Registry (optional):

* Define JSON schema per event type
* Enable downstream validation for 3rd-party consumers

---

## 🧪 Local Development Tools

* Use `test-events/*.json` fixtures to simulate inbound email + plugin events
* Consider writing integration tests for `plugin/<name>/start → stop` cycles
* Validate event size before emitting (>256KB = EventBridge failure)

---

## ✨ Future Enhancements

* Correlation ID tracing (inject `traceId` into each event)
* Plugin health dashboard (success %, avg exec time, etc.)
* Plugin logs aggregated via CloudWatch Log Insights
