import type { Handler, SNSEvent, Context } from "aws-lambda";
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Readable } from "stream";
import { octomateEventBridge } from '../../lib/events/eventBridge';


const { BUCKET_NAME, TABLE_NAME, _EVENT_BUS_NAME } = process.env;

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

//#region interfaces

interface SnsSesNotification {
  notificationType: "Received" | "Bounce" | "Complaint";
  mail: {
    source: string;
    destination: string[];
    messageId: string;
  };
  content: {
    s3BucketName: string;
    s3ObjectKey: string;
  };
}


//#endregion interfaces


/**
 *  ## Email Receive Handler
 *  Triggered by SES -> SNS -> Lambda 
 *  when an email is received.
 * 
 * 
 *  1. Email arrives
 *    ↓
 *  2. SES receives email for your domain (via MX record)
 *    ↓
 *  3. SES rule action: Store in S3
 *    ↓
 *  4. SES rule action: Publish to SNS
 *    ↓
 *  5. SNS topic notifies subscribers (e.g. your Lambda)
 *    ↓
 *  6. Lambda is triggered with SNS event, which contains:
 *    - metadata (sender, recipient, etc)
 *    - S3 location of raw email
 *  
 * 
 */
export const handler: Handler<SNSEvent> = async (event, _ctx: Context) => {

  const timestamp = new Date().toISOString();
  const messageStr = event.Records[0].Sns.Message 
  const emailId = event.Records[0].Sns.MessageId 

  const mailData = JSON.parse(messageStr) as {
    notificationType: "Received" | "Delivery" | "Bounce" | "Complaint";
    mail: Record<string, string>
    content: {
      s3BucketName:string
      s3ObjectKey: string
    }
  }
  
  // Load the mail that has already been saved in S3
  const s3mail = await s3.send(new GetObjectCommand({
    Bucket: mailData.content.s3BucketName,
    Key: mailData.content.s3ObjectKey,
  }))

  const emailRaw = await streamToString(s3mail.Body as Readable);
  console.log("Email content:", emailRaw);
  
  // 2. Store metadata in DynamoDB
  await ddb.send(new PutItemCommand({
    TableName: TABLE_NAME!,
    Item: {
      emailId: { S: emailId },
      from: { S: mailData.mail.source },
      to: { SS: [...mailData.mail.destination.split(',')], },
      timestamp: { S: timestamp },
      s3Url: { S: `s3://${mailData.content.s3BucketName}/${mailData.content.s3ObjectKey}`},
    },
  }));
  
  await octomateEventBridge({ region: '', creds:{key:'',secret:''}}).inbound.emailReceived({
    from: mailData.mail.source, 
    to: [...mailData.mail.destination.split(',')],
    emailId: emailId,
    rawS3Url: `s3://${BUCKET_NAME}/emails/${emailId}.txt`,
  })

  return { statusCode: 200 };
}