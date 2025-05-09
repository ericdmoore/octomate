// infra/lib/plugin-checker-stack.ts
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

interface PluginCheckerStackProps extends StackProps {
  eventBus: events.IEventBus;
  tableName: string;
  eventBusName: string;
}

export class PluginCheckerStack extends Stack {
  constructor(scope: Construct, id: string, props: PluginCheckerStackProps) {
    super(scope, id, props);

    const checkerFn = new lambda.Function(this, 'PluginStatusCheckerFn', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/plugin-status-checker')),
      environment: {
        TABLE_NAME: props.tableName,
        EVENT_BUS_NAME: props.eventBusName
      },
      timeout: Duration.seconds(30),
    });

    checkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
      resources: ['*'], // TODO: tighten this
    }));

    checkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [props.eventBus.eventBusArn],
    }));

    new events.Rule(this, 'PluginStatusCheckRule', {
      eventBus: props.eventBus,
      eventPattern: {
        source: ['octomate.pluginMgr'],
        detailType: ['plugin/checkStatus'],
      },
      targets: [new targets.LambdaFunction(checkerFn)],
    });
  }
}