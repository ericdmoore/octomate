import { handler } from '../lambda/email-receive/index';

test('should process and emit event for SES email', async () => {
  const result = await handler({
    Records: [
      {
        ses: {
          mail: {
            messageId: 'test-id-123',
            source: 'sender@example.com',
            destination: ['recipient@example.com']
          }
        }
      }
    ]
  });

  expect(result.statusCode).toBe(200);
});
