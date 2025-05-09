// lib/pluginMgr-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';

interface PluginStackProps extends StackProps {
  emailEventBus: events.IEventBus;
}

export class PluginStack extends Stack {
  public readonly pluginRegistryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: PluginStackProps) {
    super(scope, id, props);

    this.pluginRegistryTable = new dynamodb.Table(this, 'PluginRegistryTable', {
      partitionKey: { name: 'pluginKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const pluginManager = new lambda.Function(this, 'PluginManagerHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/plugin-manager')),
      environment: {
        PLUGIN_REGISTRY_TABLE: this.pluginRegistryTable.tableName,
      },
    });

    this.pluginRegistryTable.grantReadData(pluginManager);

    new events.Rule(this, 'PluginDispatchRule', {
        eventBus: props.emailEventBus,
        eventPattern: {
          source: ['email-system'],
          detailType: ['EmailReceived', 'EmailSent'],
        },
        targets: [new targets.LambdaFunction(pluginManager)],
      });      
  }
}