import * as nodemailer from 'nodemailer';
import { FRONTEND_URL, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_SECURE, SMTP_USER } from './constants';

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  fullName: string
): Promise<void> => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '<platformaapp@platformaapp.ru>',
    to: email,
    subject: 'Password Reset Request',
    html: `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #007bff; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">🔐 Сброс пароля</h1>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">Здравствуйте ${fullName || 'User'},</h2>

            <p style="color: #666; line-height: 1.6;">
                Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы установить новый пароль:
            </p>

            <!-- Reset Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}"
                   style="background-color: #007bff;
                          color: white;
                          padding: 15px 30px;
                          text-decoration: none;
                          border-radius: 5px;
                          font-size: 16px;
                          display: inline-block;
                          border: none;
                          cursor: pointer;">
                    Сбросить пароль
                </a>
            </div>

            <!-- Alternative link -->
            <p style="color: #666; font-size: 14px;">
                Или скопируйте и вставьте эту ссылку в свой браузер:<br>
                <a href="${resetUrl}" style="color: #007bff; word-break: break-all;">
                    ${resetUrl}
                </a>
            </p>

            <!-- Warning -->
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="color: #856404; margin: 0;">
                    ⏰ <strong>Срок действия этой ссылки истекает через 1 час по соображениям безопасности.
                </p>
            </div>

            <!-- Footer note -->
            <p style="color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
                Если вы не запрашивали сброс пароля, проигнорируйте это письмо —
                ваша учетная запись останется защищенной.
            </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <p style="color: #6c757d; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Platforma. Все права защищены.<br>
                Это автоматическое сообщение, пожалуйста, не отвечайте.
            </p>
        </div>
    </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (err) {
    console.error(
      'Error sending password reset email:',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
};
