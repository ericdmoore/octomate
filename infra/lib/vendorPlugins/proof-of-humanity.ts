// infra/lib/proof-of-humanity-ddb.ts
import { Construct } from 'constructs';
import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { StackProps,} from 'aws-cdk-lib';

export class ProofOfHumanityDDBStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'ProofOfHumanityTable', {
      partitionKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: process.env.NODE_ENV === 'production'
        ? undefined
        : RemovalPolicy.DESTROY,
    });
  }
}
