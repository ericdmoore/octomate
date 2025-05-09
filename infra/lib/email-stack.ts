// lib/email-stack.ts
import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as ses_actions from 'aws-cdk-lib/aws-ses-actions';
import * as ses_cfn from 'aws-cdk-lib/aws-ses/lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';


interface EmailStackProps extends StackProps {
  domainName: string  
}

export class EmailStack extends Stack {
  public readonly emailMetadataTable: dynamodb.Table;
  public readonly emailEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);

    const emailBucket = new s3.Bucket(this, 'RawEmailBucket');

    this.emailMetadataTable = new dynamodb.Table(this, 'EmailMetadataTable', {
      partitionKey: { name: 'emailId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    this.emailEventBus = new events.EventBus(this, 'EmailEventBus');

    const emailReceiveLambda = new lambda.Function(this, 'EmailReceiveHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      
      code: lambda.Code.fromAsset(path.join( __dirname , '../lambda/email-receive')),
      environment: {
        BUCKET_NAME: emailBucket.bucketName,
        TABLE_NAME: this.emailMetadataTable.tableName,
        EVENT_BUS_NAME: this.emailEventBus.eventBusName,
      },
    });

    const emailSendLambda = new lambda.Function(this, 'EmailSendHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/email-send')),
      environment: {
        TABLE_NAME: this.emailMetadataTable.tableName,
        EVENT_BUS_NAME: this.emailEventBus.eventBusName,
      },
    });

    emailBucket.grantPut(emailReceiveLambda);
    this.emailMetadataTable.grantWriteData(emailReceiveLambda);
    this.emailEventBus.grantPutEventsTo(emailReceiveLambda);

    this.emailMetadataTable.grantReadWriteData(emailSendLambda);
    this.emailEventBus.grantPutEventsTo(emailSendLambda);

    emailReceiveLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));

    emailSendLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));

    const alertTopic = new sns.Topic(this, 'EmailSystemAlerts');

    new CfnOutput(this, 'SnsTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS Topic for system alerts and plugin notifications',
    });

    const receiptRuleSet = new ses.ReceiptRuleSet(this, 'DefaultRuleSet', {
      receiptRuleSetName: 'EmailSystemRuleSet',
    });

    receiptRuleSet.addRule('LambdaRule', {
      recipients: [],
      actions: [
        new ses_actions.Lambda({
          function: emailReceiveLambda,
          invocationType: ses_actions.LambdaInvocationType.EVENT,
        })
      ],
      enabled: true,
      scanEnabled: true,
    });

    new CfnOutput(this, 'SesRuleSetName', {
      value: receiptRuleSet.receiptRuleSetName,
      description: 'SES Receipt RuleSet Name for MX setup',
    });

    const hostedZone = route53.HostedZone.fromLookup(this, 'UserDomainZone', {
      domainName: props.domainName,
    });

    new route53.MxRecord(this, 'MXRecord', {
      zone: hostedZone,
      values: [
        {
          priority: 10,
          hostName: 'inbound-smtp.us-east-1.amazonaws.com',
        },
      ],
      ttl: Duration.minutes(5),
    });

    new route53.TxtRecord(this, 'SPFRecord', {
      zone: hostedZone,
      values: ['v=spf1 include:amazonses.com ~all'],
      ttl: Duration.minutes(5),
    });

    const domainIdentity = new ses_cfn.CfnEmailIdentity(this, 'DomainIdentity', {
      emailIdentity: props.domainName,
    });

    new CfnOutput(this, 'SESVerificationReminder', {
      value: `Check SES console to confirm domain ${props.domainName} is verified.`,
      description: 'Reminder to manually confirm SES domain identity verification status.'
    });

    const dkimTokens = domainIdentity.attrDkimDnsTokenName1 && [
      domainIdentity.attrDkimDnsTokenName1,
      domainIdentity.attrDkimDnsTokenName2,
      domainIdentity.attrDkimDnsTokenName3
    ];

    if (dkimTokens) {
      dkimTokens.forEach((token, index) => {
        new route53.CnameRecord(this, `DkimToken${index + 1}`, {
          zone: hostedZone,
          recordName: `${token}._domainkey.${props.domainName}`,
          domainName: `${token}.dkim.amazonses.com`,
          ttl: Duration.minutes(5),
        });
      });
    }

    new CfnOutput(this, 'MXAndSPFConfigured', {
      value: `MX, SPF, and DKIM records created for ${props.domainName}`,
    });
  }
}
