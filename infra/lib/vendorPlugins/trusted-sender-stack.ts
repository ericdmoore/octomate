// infra/lib/trusted-sender-plugin-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';


/**
 * Trusted Sender Score Plugin
 * 
 * 
 * 
 */

interface TrustedSenderPluginStackProps extends StackProps {
  eventBus: events.IEventBus;
  tableName: string;
  eventBusName: string;
}

export class TrustedSenderPluginStack extends Stack {
  constructor(scope: Construct, id: string, props: TrustedSenderPluginStackProps) {
    super(scope, id, props);

    const trustedSenderFn = new lambdaNode.NodejsFunction(this, 'TrustedSenderPluginFn', {
      entry: path.join(__dirname, '../../plugins/trusted-sender-checker/index.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: props.tableName,
        EVENT_BUS_NAME: props.eventBusName,
      },
      bundling: {
        minify: true,
        externalModules: ['aws-sdk'],
      },
    });

    trustedSenderFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
      resources: ['*'],
    }));

    trustedSenderFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [props.eventBus.eventBusArn],
    }));

    new events.Rule(this, 'TrustedSenderStartRule', {
      eventBus: props.eventBus,
      eventPattern: {
        source: ['octomate.plugin.trusted-sender-checker'],
        detailType: ['plugin/trusted-sender-checker/start'],
      },
      targets: [new targets.LambdaFunction(trustedSenderFn)],
    });
  }
}
