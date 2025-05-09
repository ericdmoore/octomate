Notes on Plugins
======================

Principles:
- Make it hard to mess up the lifecycle of a plugin
- Keep requirements for successful plugin very low.
- All plugins get invoked on their own start event (core feature)
- All plugins are expected to emit a "failure"/"stopped" event or "finished" event and to return **in less than 2 Minutes**
- 


## Problem: Plugins That Never Emit

This happens when:

    - The plugin Lambda times out
    - It throws an unhandled exception
    - It’s never invoked due to misrouting
    - AWS delivery delay (rare, but possible)

In these cases:

    - PluginMgr won't hear a finished or stopped event
    - So it never checks the manifest
    - So the email’s processing status is stuck in limbo

🧠 Who Should Detect a Missing Plugin Completion?

There are a few options:
### Option A: Polling PluginMgr

    PluginMgr checks metadata table every N seconds for “incomplete” emails.

    ✅ Guaranteed to detect silent failures

    ⚠️ Slightly delayed (e.g. runs every 30s or 60s)

    ❌ Wasteful at scale unless optimized (e.g. use a TTL scan, or metadata triggers)

You can improve this with:

    - EventBridge Scheduler
    - DynamoDB Streams + TTL watcher

### Option B: Scheduled Wake-Up

    When PluginMgr emits start events, it also schedules a “check-in” event 2 minutes later.

This avoids constant polling by instead using per-email scheduled re-checks.

Example:

// When plugins start
evb.send([
  ...pluginStartEvents,
  {
    DetailType: 'plugin/checkStatus',
    Detail: { emailId },
    EventTime: now + 2 minutes
  }
])

    ✅ Only wakes up if necessary

    ✅ Scales better

    ⚠️ Slightly delayed (2 min window)

### Option C: Use DynamoDB Conditional Writes with TTL

A more advanced model:

    When each plugin writes its status: done, it atomically increments a completedCount

    If completedCount === manifest.length, it emits emailProcessingStop

    If timeout hits and the count is incomplete, emit a partialFailure

✅ This removes the need for polling altogether
⚠️ Adds complexity and tighter coupling to metadata schema
🚦 Recommendation

Use Option B (Scheduled Wake-Up) for now.

Why?

    It’s event-driven, like the rest of your system

    Doesn’t waste compute cycles

    Easy to wire up with EventBridge Scheduler or just a delayed event

    Keeps PluginMgr logic centralized

✅ How to Implement Wake-Up on Timeout

const scheduleTimeoutCheck = async (emailId: string) => {
  await evb.send(new PutEventsCommand({
    Entries: [{
      DetailType: 'plugin/checkStatus',
      Source: 'octomate.pluginMgr',
      Detail: JSON.stringify({ emailId }),
      EventTime: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes from now
    }]
  }));
};

Then have a PluginStatusChecker Lambda subscribed to plugin/checkStatus that checks:

    Is the plugin manifest complete?

    If not → mark missing plugins as timeout, emit emailProcessingFinished