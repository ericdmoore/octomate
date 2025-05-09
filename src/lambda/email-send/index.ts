import { type Handler} from "aws-lambda"
import { type EmailSentEvent } from '../types/email-events';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';


const ses = new SESClient({});
const eventBridge = new EventBridgeClient({});
const dynamo = new DynamoDBClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

export const handler: Handler<EmailSentEvent> = async (event) => {
  const { to, subject, body, from } = event;

  const emailParams = {
    Destination: { ToAddresses: [to] },
    Message: {
      Body: {
        Text: { Data: body.text },
        Html: { Data: body.markup.filter(m=>m.lang='HTML')[0].body },
      },
      Subject: { Data: subject },
    },
    Source: from,
  };

  try {
    const response = await ses.send(new SendEmailCommand(emailParams));
    const messageId = response.MessageId;

    if (!messageId) throw new Error("SES did not return a MessageId.");
    // Store in DynamoDB
    await dynamo.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        emailId: { S: messageId },
        to: { S: to ?? '>>UNKNOWN' },
        from: { S: from ?? '>>UNKNOWN'},
        subject: { S: subject ?? '>>EMPTY' },
        sentAt: { S: new Date().toISOString() },
      },
    }));

  
      const emailSentEvent: EmailSentEvent = {
        eventType: 'EmailSent',
        messageId: 'string',
        from: 'string',
        to: 'string',
        subject: 'string',
        body: {
          text:'string',
          markup:[{
            lang: 'HTML',
            body: 'string'
          }]
        },
        attachments:[{
            enc:'string',
            content: new Uint8Array()
        }],
        timestamp: {
            iso: 'string',
            epochSec: 1
        }
    };

    // Emit EventBridge event
    await eventBridge.send(new PutEventsCommand({
        Entries: [{
          EventBusName: EVENT_BUS_NAME,
          Source: 'email-system',
          DetailType: 'EmailSent',
          Detail: JSON.stringify(emailSentEvent),
        }],
      }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully', messageId }),
    };
  } catch (error: unknown) {
    console.error('Send failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Email send failed', detail: (error as Error).message }),
    };
  }
};
