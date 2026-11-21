import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { EmailService } from './email.service';

describe('EmailService password mail (mocked provider)', () => {
  let fetchMock: jest.SpyInstance;
  const service = (key = 'unit-test-key') => new EmailService({ get: () => key } as unknown as ConfigService);

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'success', job_id: 'test-job' })));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects missing credentials without contacting the provider', async () => {
    const email = service('  ');
    await expect(email.sendPasswordResetEmail('test@example.test', 'test.token.signature', 'Имя')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a reset link with an escaped name and a bounded HTTPS request', async () => {
    await service().sendPasswordResetEmail('test@example.test', 'test.token.signature', '<b>Имя</b>');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body.message.recipients).toEqual([{ email: 'test@example.test' }]);
    expect(body.message.body.html).toContain('/reset-password?token=test.token.signature');
    expect(body.message.body.html).toContain('&lt;b&gt;Имя&lt;/b&gt;');
    expect(body.message.body.html).not.toContain('<b>Имя</b>');
  });

  it('sends a password-changed notification without a password or reset token', async () => {
    await service().sendPasswordChangedEmail('test@example.test', 'Имя');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message.subject).toBe('Пароль изменён');
    expect(body.message.body.html).toContain('/forgot-password');
    expect(body.message.body.html).not.toContain('token=');
  });

  it.each([
    { status: 'error', message: 'sender is not verified' },
    { status: 'success', failed_emails: { 'test@example.test': 'rejected' } },
  ])('does not treat provider rejection as delivery success: %j', async result => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result)));
    await expect(service().sendPasswordResetEmail('test@example.test', 'test.token.signature', 'Имя')).rejects.toThrow('Unisender Go');
  });
});
