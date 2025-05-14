// plugins/ics-generator/index.ts
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Handler } from 'aws-lambda';
import { Readable } from 'stream';

const ddb = new DynamoDBClient({});
const evb = new EventBridgeClient({});
const s3 = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

function streamToString(stream: Readable): Promise<string> {
  const chunks: Uint8Array[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

export const handler: Handler = async (event) => {
  const detail = event.detail;
  const emailId = detail.emailId as string;

  const meta = await ddb.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { emailId: { S: emailId } },
  }));

  const s3Key = `emails/${emailId}.txt`;
  const rawEmail = await s3.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  }));
  const rawText = await streamToString(rawEmail.Body as Readable);

  // Very naive ICS placeholder based on content
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Auto-generated Event\nDESCRIPTION:${rawText.substring(0, 50)}\nDTSTART;TZID=UTC:20250101T120000\nDTEND;TZID=UTC:20250101T130000\nEND:VEVENT\nEND:VCALENDAR`;

  await ddb.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { emailId: { S: emailId } },
    UpdateExpression: 'SET pluginStatus.icsGenerator = :ics',
    ExpressionAttributeValues: {
      ':ics': { S: JSON.stringify({ status: 'done', ics, completedAt: new Date().toISOString() }) },
    },
  }));

  await evb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: EVENT_BUS_NAME,
      Source: 'octomate.plugin.ics-generator',
      DetailType: 'plugin/ics-generator/stop',
      Detail: JSON.stringify({ pluginName: 'ics-generator', emailId, success: true, summary: ics.slice(0, 80) }),
    }],
  }));
};
