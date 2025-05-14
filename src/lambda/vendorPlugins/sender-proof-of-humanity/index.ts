// plugins/proof-of-humanity/index.ts
import { Handler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { v4 as uuidv4 } from 'uuid';

const ses = new SESClient({});
const eb = new EventBridgeClient({});

const EMAIL_FROM = process.env.EMAIL_FROM!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const HUMANITY_VERIFICATION_BASE_URL = process.env.HUMANITY_VERIFICATION_BASE_URL!; // e.g., https://verify.octomail.cc/verify

export const handler: Handler = async (event) => {
  const detail = event.detail;
  const emailId = detail.emailId;
  const from = detail.from;
  const challengeId = uuidv4();

  const verifyUrl = `${HUMANITY_VERIFICATION_BASE_URL}?id=${challengeId}`;

  const challengeEmail = {
    Destination: {
      ToAddresses: [from],
    },
    Message: {
      Subject: {
        Data: 'Verify You’re Human to Deliver Your Email',
      },
      Body: {
        Text: {
          Data: `Hi,

To deliver your message, please complete this short verification:

Click here: ${verifyUrl}

This helps us keep inboxes safe from automated spam.

Thanks,
Octomate System`
        },
      },
    },
    Source: EMAIL_FROM,
  };

  await ses.send(new SendEmailCommand(challengeEmail));

  await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'octomate.plugin.proof-of-humanity',
          DetailType: 'plugin/proof-of-humanity/finished',
          Detail: JSON.stringify({
            pluginName: 'proof-of-humanity',
            emailId,
            challengeId,
            status: 'pending',
            sentTo: from,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    })
  );

  return { statusCode: 200 };
};
