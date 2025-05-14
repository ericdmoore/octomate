// plugins/date-extractor/index.ts
import { ComprehendClient, DetectEntitiesCommand } from '@aws-sdk/client-comprehend';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { EventBridgeEvent, Handler } from 'aws-lambda';
import { Readable } from 'stream';

const comprehend = new ComprehendClient({});
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

export const handler: Handler<EventBridgeEvent<'',''>> = async (event) => {
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

  const detect = await comprehend.send(new DetectEntitiesCommand({
    Text: rawText.slice(0, 4000), // max 5KB
    LanguageCode: 'en'
  }));

  const dates = detect.Entities?.filter(e => e.Type === 'DATE') || [];
  const summary = dates.map(d => d.Text).join('; ');

  await ddb.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { emailId: { S: emailId } },
    UpdateExpression: 'SET pluginStatus.dateExtractor = :summary',
    ExpressionAttributeValues: {
      ':summary': { S: JSON.stringify({ status: 'done', dates, completedAt: new Date().toISOString() }) },
    },
  }));

  await evb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: EVENT_BUS_NAME,
      Source: 'octomate.plugin.date-extractor',
      DetailType: 'plugin/date-extractor/stop',
      Detail: JSON.stringify({ pluginName: 'date-extractor', emailId, success: true, summary }),
    }],
  }));
};
