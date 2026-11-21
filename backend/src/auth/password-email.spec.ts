import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('new-password-hash'), compare: jest.fn().mockResolvedValue(true) }));

const flushMail = () => new Promise(resolve => setImmediate(resolve));

describe('password email workflows', () => {
  let auth: AuthService;
  let users: any;
  let mail: any;
  let sessions: any;
  const user = { id: 'test-user', email: 'test@example.test', fullName: 'Имя', passwordHash: 'old-hash' };

  beforeEach(() => {
    users = { findOne: jest.fn().mockResolvedValue({ ...user }), save: jest.fn().mockImplementation(async value => value) };
    sessions = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    mail = { assertConfigured: jest.fn(), sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined), sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
    auth = new AuthService(users, sessions, {} as any, {} as any, { verify: jest.fn().mockReturnValue({ sub: user.id, type: 'password_reset' }), sign: jest.fn().mockReturnValue('test.token.signature') } as any, { get: jest.fn() } as any, mail);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('notifies after an authenticated password change', async () => {
    await auth.changePassword(user.id, 'old-password', 'new-password');
    await flushMail();
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: 'new-password-hash' }));
    expect(mail.sendPasswordChangedEmail).toHaveBeenCalledWith(user.email, user.fullName);
  });

  it('does not notify or save when the current password is wrong', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(auth.changePassword(user.id, 'wrong', 'new-password')).rejects.toBeInstanceOf(UnauthorizedException);
    await flushMail();
    expect(users.save).not.toHaveBeenCalled();
    expect(mail.sendPasswordChangedEmail).not.toHaveBeenCalled();
  });

  it('notifies after reset and invalidates old sessions', async () => {
    await auth.resetPassword({ reset_token: 'test.token.signature', password: 'new-password' });
    await flushMail();
    expect(sessions.update).toHaveBeenCalled();
    expect(mail.sendPasswordChangedEmail).toHaveBeenCalledWith(user.email, user.fullName);
  });

  it('does not undo a successful password change on mail failure', async () => {
    mail.sendPasswordChangedEmail.mockRejectedValue(new Error('provider unavailable'));
    await expect(auth.changePassword(user.id, 'old-password', 'new-password')).resolves.toBeUndefined();
    await flushMail();
    expect(users.save).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Password changed email failed'), 'provider unavailable');
  });

  it('exposes missing mail configuration uniformly before looking up any account', async () => {
    mail.assertConfigured.mockImplementation(() => { throw new ServiceUnavailableException('mail unavailable'); });
    await expect(auth.requestPasswordChange({ email: user.email })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('does not return a false success from the controller on missing mail configuration', async () => {
    const controller = new AuthController({ requestPasswordChange: jest.fn().mockRejectedValue(new ServiceUnavailableException('mail unavailable')) } as any, {} as any);
    await expect(controller.forgotPassword({ email: user.email })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('keeps the generic response for unknown emails when mail is configured', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(auth.requestPasswordChange({ email: 'unknown@example.test' })).resolves.toBeUndefined();
    await flushMail();
    expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('queues the reset-link email for a registered account', async () => {
    await auth.requestPasswordChange({ email: user.email });
    await flushMail();
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(user.email, 'test.token.signature', user.fullName);
  });
});
