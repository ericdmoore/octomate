# EventBridge and AWS Lambda Operational Limits

This document outlines key operational limits and best practices for the Octomate event system.

---

## EventBridge Limits

| Resource / Behavior             | Default Limit                      | Notes                                             |
| ------------------------------- | ---------------------------------- | ------------------------------------------------- |
| **Event size**                  | **256 KB** per event               | Includes full JSON payload and metadata           |
| **PutEvents (API call)**        | **10,000 events/sec** per region   | Shared across all custom/default buses            |
| **PutEvents (per call)**        | Up to **10 events per batch call** | Use batch where possible                          |
| **Custom event bus throughput** | **2,400 events/sec per bus**       | Can request increase                              |
| **Rules per event bus**         | **300**                            | Request a soft limit increase if needed           |
| **Targets per rule**            | **5**                              | Use fan-out Lambda or Step Functions for chaining |
| **Retry duration**              | **24 hours** default               | With exponential backoff                          |
| **Dead Letter Queue support**   | ✅ Yes                              | For failed rule targets                           |

---

## Lambda Plugin Limits

| Resource                                | Limit                           |
| --------------------------------------- | ------------------------------- |
| **Timeout**                             | Max **15 minutes** (900 sec)    |
| **Concurrent executions (per account)** | **1,000** (soft limit)          |
| **Payload size**                        | **6 MB** (request and response) |
| **Environment variable size**           | Max **4 KB** total              |
| **Retry behavior**                      | Configurable, with optional DLQ |

---

## Design Best Practices

* **Plugin timeouts**: Set conservative execution limits (e.g., 2 minutes max)
* **Parallel execution**: Trigger plugins via EventBridge for fan-out execution
* **Result tracking**: Use DynamoDB or metadata hash table to track plugin completion
* **DLQs**: Use per-plugin DLQs or a shared failure bucket
* **Payload minimization**: Store large email data in S3, pass S3 references in events
* **Archive & Replay**: Enable EventBridge Archive to allow plugin reprocessing
* **Throttling**: If batch-emitting plugin starts, chunk or throttle to avoid API burst limits

---

## Monitoring Suggestions

* Set CloudWatch alarms on:

  * `PutEvents` failure rate
  * Lambda `Throttles` and `Errors`
  * DLQ message volume (plugin failures)
* Enable X-Ray or embedded trace IDs in emitted events

---

## Future-Proofing

* Consider namespacing plugin rules per organization if user-installed plugins become common
* Consider Step Functions if plugin execution dependencies grow
* Consider long-term plugin state metrics for usage/failure rates
