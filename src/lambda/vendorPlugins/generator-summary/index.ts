// plugins/summarizer/index.ts
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {octomateEventBridge, type PluginStartData} from '../../../lib/events/eventBridge';
import { Handler, EventBridgeEvent } from 'aws-lambda';
import { Readable } from 'stream';

const dynamo = new DynamoDBClient({});
const eventBridge = new EventBridgeClient({});
const s3 = new S3Client({});
const evb = octomateEventBridge({region:'', eventBusName:'default', creds:{key:'', secret:''}})

const TABLE_NAME = process.env.TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export const handler: Handler<EventBridgeEvent<'plugin/summarizer/start', PluginStartData>> = async (event) => {
  const detail = event.detail;
  const emailId = detail.emailId as string;

  // Read metadata from DDB to locate raw S3 object
  const meta = await dynamo.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { emailId: { S: emailId } },
  }));

  const s3Key = `emails/${emailId}.txt`;
  const s3Obj = await s3.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  }));
  const rawText = await streamToString(s3Obj.Body as Readable);

  // Simulate summarization logic
  const result = rawText.length > 140
    ? rawText.slice(0, 140) + '...'
    : rawText;

  // Update plugin status in DDB
  await dynamo.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { emailId: { S: emailId } },
    UpdateExpression: 'SET pluginStatus.summarizer = :result',
    ExpressionAttributeValues: {
      ':result': { S: JSON.stringify({ status: 'done', result, completedAt: new Date().toISOString() }) },
    },
  }));



  await evb.plugins.finish({
    pluginName:'summarizer', 
    status: 'Finished',
    emailId, 
    result,
    timestamp: Math.floor(Date.now() / 1000)
  })

  // Emit plugin finished event
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      EventBusName: EVENT_BUS_NAME,
      Source: 'octomate.plugin.summarizer',
      DetailType: 'plugin/summarizer/stop',
      Detail: JSON.stringify({ pluginName: 'summarizer', emailId, success: true, result }),
    }],
  }));

  return { statusCode: 200 };
};

