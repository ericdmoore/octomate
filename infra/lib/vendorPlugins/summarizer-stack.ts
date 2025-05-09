// infra/lib/summarizer-plugin-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

interface SummarizerPluginStackProps extends StackProps {
  eventBus: events.IEventBus;
  tableName: string;
  eventBusName: string;
  bucketName: string;
}

export class SummarizerPluginStack extends Stack {
  constructor(scope: Construct, id: string, props: SummarizerPluginStackProps) {
    super(scope, id, props);

    const summarizerFn = new lambdaNode.NodejsFunction(this, 'SummarizerPluginFn', {
      entry: path.join(__dirname, '../../plugins/summarizer/index.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: props.tableName,
        EVENT_BUS_NAME: props.eventBusName,
        BUCKET_NAME: props.bucketName,
      },
      bundling: {
        minify: true,
        externalModules: ['aws-sdk'],
      },
    });

    summarizerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
      resources: ['*'], // tighten later
    }));

    summarizerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${props.bucketName}/*`],
    }));

    summarizerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [props.eventBus.eventBusArn],
    }));

    new events.Rule(this, 'SummarizerStartRule', {
      eventBus: props.eventBus,
      eventPattern: {
        source: ['octomate.plugin.summarizer'],
        detailType: ['plugin/summarizer/start'],
      },
      targets: [new targets.LambdaFunction(summarizerFn)],
    });
  }
}
