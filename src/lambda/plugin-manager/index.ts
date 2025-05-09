import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const { PLUGIN_REGISTRY_TABLE } = process.env;

export const handler = async (event: any) => {
  const detail = event.detail;
  const eventType = event['detail-type'];

  console.log(`Handling ${eventType} for emailId: ${detail.emailId}`);

  // Example: get plugin config for a static plugin key
  const pluginKey = 'alias-forwarding'; // This could be dynamic based on user/domain

  const config = await ddb.send(new GetItemCommand({
    TableName: PLUGIN_REGISTRY_TABLE!,
    Key: { pluginKey: { S: pluginKey } },
  }));

  // TODO: Based on pluginKey + config, dispatch to plugin logic
  console.log(`Loaded config for plugin ${pluginKey}:`, config.Item);

  return { statusCode: 200 };
};
