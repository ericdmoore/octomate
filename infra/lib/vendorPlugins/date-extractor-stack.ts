// infra/lib/ics-generator-plugin-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

interface IcsGeneratorPluginStackProps extends StackProps {
  eventBus: events.IEventBus;
  tableName: string;
  eventBusName: string;
  bucketName: string;
}

export class IcsGeneratorPluginStack extends Stack {
  constructor(scope: Construct, id: string, props: IcsGeneratorPluginStackProps) {
    super(scope, id, props);

    const icsFn = new lambdaNode.NodejsFunction(this, 'IcsGeneratorPluginFn', {
      entry: path.join(__dirname, '../../plugins/ics-generator/index.ts'),
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

    icsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
      resources: ['*'],
    }));

    icsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${props.bucketName}/*`],
    }));

    icsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [props.eventBus.eventBusArn],
    }));

    new events.Rule(this, 'IcsGeneratorTriggerRule', {
      eventBus: props.eventBus,
      eventPattern: {
        source: ['octomate.plugin.date-extractor'],
        detailType: ['plugin/date-extractor/finished'],
      },
      targets: [new targets.LambdaFunction(icsFn)],
    });
  }
}
