// plugins/proof-of-humanity/api/verify.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const ddb = new DynamoDBClient({});
const eb = new EventBridgeClient({});

const VERIFICATION_TABLE = process.env.VERIFICATION_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

export const handler: APIGatewayProxyHandler = async (event) => {
  const challengeId = event.queryStringParameters?.id;

  if (!challengeId) {
    return {
      statusCode: 400,
      body: 'Missing challenge ID.',
    };
  }

  // Update the verification status in DynamoDB
  await ddb.send(new UpdateItemCommand({
    TableName: VERIFICATION_TABLE,
    Key: { challengeId: { S: challengeId } },
    UpdateExpression: 'SET status = :s, verifiedAt = :ts',
    ExpressionAttributeValues: {
      ':s': { S: 'verified' },
      ':ts': { S: new Date().toISOString() },
    },
  }));

  // Emit an EventBridge event for downstream handling
  await eb.send(new PutEventsCommand({
    Entries: [
      {
        EventBusName: EVENT_BUS_NAME,
        Source: 'octomate.humanity-check',
        DetailType: 'humanityCheckVerified',
        Detail: JSON.stringify({ challengeId, verified: true }),
      },
    ],
  }));

  return {
    statusCode: 200,
    body: `✅ Verification complete. Your message will now be delivered.`,
  };
};
