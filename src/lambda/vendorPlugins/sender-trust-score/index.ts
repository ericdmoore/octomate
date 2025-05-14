/**
 *  Trusted Contact are ones where 
 *  - the User has sent multiple messages to the contact
 *  - The contact has passed a Humanity test
 *  - The ratio of sent vs received messages "is high" - needs definition
 * 
 *  - The contact is not a spammer
 *  - The contact sends ussful information 
 *  - That would be trustworthy enough to udpated our understanding of other contacts 
 * 
 *   
 * 
 * 
 * 
 * 
 */

// plugins/trusted-sender-checker/index.ts
import { Handler } from 'aws-lambda';
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';

const TABLE_NAME = process.env.TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

const ddb = new DynamoDBClient({});
const eb = new EventBridgeClient({});

export const handler: Handler = async (event) => {
  const detail = event.detail;
  const emailId = detail.emailId;
  const sender = detail.from;
  const userId = detail.userId || 'default-user';

  let trustLevel = 20;
  let classification = 'unknown';

  // Example: hardcoded heuristics for demo
  const allowlist = ['eric@trusted.biz', 'billing@amazon.com'];
  const domain = sender.split('@')[1];

  if (allowlist.includes(sender)) {
    trustLevel = 100;
    classification = 'manual-allowlist';
  } else if (domain.endsWith('.edu') || domain.endsWith('.org')) {
    trustLevel = 60;
    classification = 'org-edu-domain';
  } else if (domain === 'company.com') {
    trustLevel = 80;
    classification = 'coworker-domain';
  } else {
    classification = 'low-history';
  }

  await ddb.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { emailId: { S: emailId } },
      UpdateExpression:
        'SET pluginStatus.trustedSenderChecker = :status, senderTrust = :trust',
      ExpressionAttributeValues: {
        ':status': {
          S: JSON.stringify({
            status: 'done',
            completedAt: new Date().toISOString(),
          }),
        },
        ':trust': {
          S: JSON.stringify({
            level: trustLevel,
            classification,
            source: 'plugin',
          }),
        },
      },
    })
  );

  await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'octomate.plugin.trusted-sender-checker',
          DetailType: 'plugin/trusted-sender-checker/finished',
          Detail: JSON.stringify({
            pluginName: 'trusted-sender-checker',
            emailId,
            success: true,
            trustLevel,
            classification,
          }),
        },
      ],
    })
  );

  return { statusCode: 200 };
};
