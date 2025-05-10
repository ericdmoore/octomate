// lambda/plugin-status-checker/index.ts
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { type Handler, EventBridgeEvent } from 'aws-lambda';

const dynamo = new DynamoDBClient({});
const eventBridge = new EventBridgeClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

export const handler: Handler<EventBridgeEvent<string, string>> = async (event: any) => {
  const { emailId } = JSON.parse(event.detail as string);

  // Get the current plugin status record for this email
  const record = await dynamo.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { emailId: { S: emailId } },
  }));

  const manifest = JSON.parse(record.Item?.pluginManifest?.S ?? '[]') as string[]
  const pluginStatus = JSON.parse(record.Item?.pluginStatus?.S ?? '{}') as Record<string, { status: string, reason?: string, failedAt?: string }>;

  const completedPlugins = Object.keys(pluginStatus).filter(
    k => pluginStatus[k]?.status === 'done' || pluginStatus[k]?.status === 'failed'
  );

  const incomplete = manifest.filter(p => !completedPlugins.includes(p));

  if (incomplete.length === 0) {
    console.log(`[${emailId}] All plugins completed.`);
    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        EventBusName: EVENT_BUS_NAME,
        Source: 'octomate.pluginMgr',
        DetailType: 'emailProcessingStop',
        Detail: JSON.stringify({ emailId }),
      }]
    }));
    return;
  }

  console.warn(`[${emailId}] Incomplete plugins: ${incomplete.join(', ')}`);

  // Optionally update pluginStatus with timeouts
  for (const name of incomplete) {
    await dynamo.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { emailId: { S: emailId } },
      UpdateExpression: `SET pluginStatus.#name = :timeout` ,
      ExpressionAttributeNames: { '#name': name },
      ExpressionAttributeValues: {
        ':timeout': { S: JSON.stringify({ status: 'failed', reason: 'timeout', failedAt: new Date().toISOString() }) }
      }
    }));
  }

  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      EventBusName: EVENT_BUS_NAME,
      Source: 'octomate.pluginMgr',
      DetailType: 'emailProcessingStop',
      Detail: JSON.stringify({ emailId, partial: true, failedPlugins: incomplete }),
    }]
  }));
};