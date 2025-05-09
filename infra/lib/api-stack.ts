// lib/api-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

interface ApiStackProps extends StackProps {
  emailMetadataTable: dynamodb.ITable;
  pluginRegistryTable: dynamodb.ITable;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const api = new appsync.GraphqlApi(this, 'EmailApi', {
      name: 'email-api',
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
      xrayEnabled: true,
    });

    const emailDS = api.addDynamoDbDataSource('EmailMetadataDataSource', props.emailMetadataTable);
    const pluginDS = api.addDynamoDbDataSource('PluginRegistryDataSource', props.pluginRegistryTable);

    // Placeholders for attaching resolvers to schema fields
    emailDS.createResolver('GetEmailByIdResolver', {
        typeName: 'Query',
        fieldName: 'getEmailById',
        requestMappingTemplate: appsync.MappingTemplate.fromString(`
          {
            "version": "2017-02-28",
            "operation": "GetItem",
            "key": {
              "emailId": $util.dynamodb.toDynamoDBJson($ctx.args.emailId)
            }
          }
        `),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
      });
      
    pluginDS.createResolver('GetPluginConfigResolver', {
    typeName: 'Query',
    fieldName: 'getPluginConfig',
    requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
        "version": "2017-02-28",
        "operation": "GetItem",
        "key": {
            "pluginKey": $util.dynamodb.toDynamoDBJson($ctx.args.pluginKey)
        }
        }
    `),
    responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
      
  }
}