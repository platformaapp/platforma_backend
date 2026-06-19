import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') ?? 465;
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    console.log(`[EmailService] SMTP config: host=${host}, port=${port}, secure=${secure}, user=${user}`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 30000,
      socketTimeout: 30000,
      greetingTimeout: 30000,
    });
  }

  async sendEventCreatedEmail(
    email: string,
    mentorName: string,
    eventTitle: string,
    eventDateTime: string,
    eventPrice: number,
    maxParticipants: number
  ): Promise<void> {
    const formattedDate = new Date(eventDateTime).toLocaleString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    const mailOptions = {
      from: '"Platforma Events" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `Событие "${eventTitle}" создано успешно`,
      html: `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .detail-item { margin: 10px 0; }
                .label { font-weight: bold; color: #555; }
                .value { color: #333; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
                .highlight { color: #667eea; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Событие создано!</h1>
                    <p>Ваше онлайн-событие готово к проведению</p>
                </div>
                <div class="content">
                    <p>Здравствуйте, <strong>${mentorName}</strong>!</p>
                    <p>Ваше событие было успешно создано и теперь доступно для записи студентам.</p>
                    
                    <div class="event-details">
                        <h2>📋 Детали события</h2>
                        <div class="detail-item">
                            <span class="label">Название:</span>
                            <span class="value highlight">${eventTitle}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Дата и время:</span>
                            <span class="value">${formattedDate}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Стоимость участия:</span>
                            <span class="value">${eventPrice} ₽</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Лимит участников:</span>
                            <span class="value">${maxParticipants} человек</span>
                        </div>
                    </div>
        
                    <p><strong>Что дальше?</strong></p>
                    <ul>
                        <li>Студенты смогут записываться на ваше событие</li>
                        <li>Вы получите уведомление о каждой новой записи</li>
                        <li>За 10 минут до начала автоматически создастся видеокомната</li>
                        <li>Вы сможете редактировать событие до его начала</li>
                    </ul>
        
                    <p>Следите за записями в вашем личном кабинете!</p>
                </div>
                <div class="footer">
                    <p>С уважением,<br>Команда Platforma Events</p>
                    <p>Если у вас есть вопросы, отвечайте на это письмо</p>
                </div>
            </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Event created email sent to ${email}`);
    } catch (err) {
      console.error(
        'Error sending event created email:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  // src/notifications/email.service.ts
  async sendEventTimeChangedEmail(
    email: string,
    studentName: string,
    eventTitle: string,
    oldDateTime: string,
    newDateTime: string,
    mentorName: string
  ): Promise<void> {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
      });
    };

    const mailOptions = {
      from: '"Platforma Events" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `🕐 Изменение времени события "${eventTitle}"`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .time-change { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff6b6b; }
              .time-comparison { display: flex; justify-content: space-between; margin: 15px 0; }
              .old-time, .new-time { flex: 1; padding: 15px; text-align: center; }
              .old-time { background: #ffeaea; border-radius: 6px; }
              .new-time { background: #e8f5e8; border-radius: 6px; }
              .arrow { display: flex; align-items: center; justify-content: center; font-size: 24px; color: #666; }
              .label { font-weight: bold; color: #555; margin-bottom: 5px; }
              .old-label { color: #e74c3c; }
              .new-label { color: #27ae60; }
              .detail-item { margin: 10px 0; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
              .highlight { color: #ee5a24; font-weight: bold; }
              .note { background: #fff9e6; padding: 15px; border-radius: 6px; border-left: 4px solid #f39c12; margin: 15px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🕐 Время события изменено</h1>
                  <p>Наставник изменил расписание события</p>
              </div>
              <div class="content">
                  <p>Здравствуйте, <strong>${studentName}</strong>!</p>
                  <p>Наставник <strong>${mentorName}</strong> изменил время проведения события, на которое вы записаны.</p>
                  
                  <div class="time-change">
                      <h2>📅 Новое расписание события</h2>
                      <div class="time-comparison">
                          <div class="old-time">
                              <div class="label old-label">❌ Прежнее время:</div>
                              <div>${formatDate(oldDateTime)}</div>
                          </div>
                          <div class="arrow">→</div>
                          <div class="new-time">
                              <div class="label new-label">✅ Новое время:</div>
                              <div class="highlight">${formatDate(newDateTime)}</div>
                          </div>
                      </div>
                  </div>
      
                  <div class="note">
                      <strong>💡 Важно:</strong> Ваша запись на событие сохранена. Если новое время вам не подходит, 
                      вы можете отменить запись в личном кабинете.
                  </div>
      
                  <p><strong>Детали события:</strong></p>
                  <ul>
                      <li><strong>Событие:</strong> "${eventTitle}"</li>
                      <li><strong>Наставник:</strong> ${mentorName}</li>
                      <li><strong>Новое время:</strong> ${formatDate(newDateTime)}</li>
                  </ul>
      
                  <p>Будем рады видеть вас на обновленном времени!</p>
              </div>
              <div class="footer">
                  <p>С уважением,<br>Команда Platforma Events</p>
                  <p><a href="https://platformaapp.ru/events">Перейти в личный кабинет</a></p>
              </div>
          </div>
      </body>
      </html>
    `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Event time changed email sent to ${email}`);
    } catch (err) {
      console.error(
        'Error sending event time changed email:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  // src/notifications/email.service.ts
  async sendNewRegistrationEmail(
    email: string,
    mentorName: string,
    eventTitle: string,
    studentName: string,
    studentEmail: string,
    eventDateTime: string,
    registeredCount: number,
    maxParticipants: number,
    eventPrice: number
  ): Promise<void> {
    const formattedDate = new Date(eventDateTime).toLocaleString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    const progressPercentage = Math.round((registeredCount / maxParticipants) * 100);
    const spotsLeft = maxParticipants - registeredCount;

    const mailOptions = {
      from: '"Platforma Events" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `🎯 Новый участник на событии "${eventTitle}"`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .registration-info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .student-card { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 15px 0; }
              .progress-container { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .progress-bar { background: #e9ecef; border-radius: 10px; height: 20px; overflow: hidden; }
              .progress-fill { background: linear-gradient(90deg, #28a745, #20c997); height: 100%; transition: width 0.3s; }
              .stats { display: flex; justify-content: space-between; margin-top: 10px; }
              .stat-item { text-align: center; }
              .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
              .stat-label { font-size: 12px; color: #666; }
              .detail-item { margin: 8px 0; }
              .label { font-weight: bold; color: #555; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
              .highlight { color: #667eea; font-weight: bold; }
              .success-badge { background: #d4edda; color: #155724; padding: 5px 10px; border-radius: 15px; font-size: 12px; display: inline-block; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎯 Новый участник!</h1>
                  <p>Кто-то записался на ваше событие</p>
              </div>
              <div class="content">
                  <p>Здравствуйте, <strong>${mentorName}</strong>!</p>
                  <p>На ваше событие записался новый участник.</p>
                  
                  <div class="registration-info">
                      <h2>📋 Информация о записи</h2>
                      
                      <div class="student-card">
                          <h3>👤 Новый участник</h3>
                          <div class="detail-item">
                              <span class="label">Имя:</span>
                              <span class="highlight">${studentName}</span>
                          </div>
                          <div class="detail-item">
                              <span class="label">Email:</span>
                              <span>${studentEmail}</span>
                          </div>
                          <div class="detail-item">
                              <span class="label">Статус:</span>
                              <span class="success-badge">Зарегистрирован</span>
                          </div>
                      </div>
      
                      <div class="detail-item">
                          <span class="label">Событие:</span>
                          <span class="highlight">"${eventTitle}"</span>
                      </div>
                      <div class="detail-item">
                          <span class="label">Дата и время:</span>
                          <span>${formattedDate}</span>
                      </div>
                      <div class="detail-item">
                          <span class="label">Стоимость:</span>
                          <span>${eventPrice} ₽</span>
                      </div>
                  </div>
      
                  <div class="progress-container">
                      <h3>📊 Прогресс записи</h3>
                      <div class="progress-bar">
                          <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                      </div>
                      <div class="stats">
                          <div class="stat-item">
                              <div class="stat-number">${registeredCount}</div>
                              <div class="stat-label">записано</div>
                          </div>
                          <div class="stat-item">
                              <div class="stat-number">${spotsLeft}</div>
                              <div class="stat-label">осталось мест</div>
                          </div>
                          <div class="stat-item">
                              <div class="stat-number">${maxParticipants}</div>
                              <div class="stat-label">всего мест</div>
                          </div>
                      </div>
                  </div>
      
                  <p><strong>💡 Что дальше?</strong></p>
                  <ul>
                      <li>Подготовьте материалы для события</li>
                      <li>За 10 минут до начала автоматически создастся видеокомната</li>
                      <li>Вы получите уведомление когда комната будет готова</li>
                      ${spotsLeft === 0 ? '<li><strong>🎉 Все места заполнены!</strong></li>' : ''}
                  </ul>
      
                  <p>Следите за новыми записями в вашем личном кабинете!</p>
              </div>
              <div class="footer">
                  <p>С уважением,<br>Команда Platforma Events</p>
                  <p><a href="https://platformaapp.ru/mentor/events">Перейти к управлению событиями</a></p>
              </div>
          </div>
      </body>
      </html>
    `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`New registration email sent to mentor ${email}`);
    } catch (err) {
      console.error(
        'Error sending new registration email:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  // src/notifications/email.service.ts
  async sendEventCancelledEmail(
    email: string,
    studentName: string,
    eventTitle: string,
    mentorName: string,
    eventDateTime: string,
    eventPrice: number,
    refundInfo?: string
  ): Promise<void> {
    const formattedDate = new Date(eventDateTime).toLocaleString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    const mailOptions = {
      from: '"Platforma Events" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `❌ Событие "${eventTitle}" отменено`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .cancellation-info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c; }
              .refund-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .next-steps { background: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-item { margin: 12px 0; }
              .label { font-weight: bold; color: #555; }
              .value { color: #333; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
              .highlight { color: #e74c3c; font-weight: bold; }
              .warning-icon { color: #e74c3c; font-size: 18px; margin-right: 8px; }
              .info-icon { color: #17a2b8; font-size: 18px; margin-right: 8px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>❌ Событие отменено</h1>
                  <p>Наставник отменил событие, на которое вы были записаны</p>
              </div>
              <div class="content">
                  <p>Здравствуйте, <strong>${studentName}</strong>!</p>
                  <p>К сожалению, наставник отменил событие, на которое вы были записаны.</p>
                  
                  <div class="cancellation-info">
                      <h2>📋 Информация об отмене</h2>
                      
                      <div class="detail-item">
                          <span class="label">Событие:</span>
                          <span class="value highlight">"${eventTitle}"</span>
                      </div>
                      
                      <div class="detail-item">
                          <span class="label">Наставник:</span>
                          <span class="value">${mentorName}</span>
                      </div>
                      
                      <div class="detail-item">
                          <span class="label">Дата и время:</span>
                          <span class="value">${formattedDate}</span>
                      </div>
                      
                      <div class="detail-item">
                          <span class="label">Стоимость:</span>
                          <span class="value">${eventPrice} ₽</span>
                      </div>
                  </div>
      
                  ${
                    eventPrice > 0
                      ? `
                  <div class="refund-notice">
                      <h3><span class="warning-icon">💳</span> Возврат средств</h3>
                      <p><strong>Средства будут автоматически возвращены на ваш счет в течение 1-3 рабочих дней.</strong></p>
                      <p>Если оплата еще не была произведена, плата с вас не будет взиматься.</p>
                      ${refundInfo ? `<p><em>${refundInfo}</em></p>` : ''}
                  </div>
                  `
                      : ''
                  }
      
                  <div class="next-steps">
                      <h3><span class="info-icon">💡</span> Что делать дальше?</h3>
                      <ul>
                          <li>Посмотрите другие события этого наставника</li>
                          <li>Изучите похожие события в каталоге</li>
                          <li>Создайте уведомление о интересующих темах</li>
                      </ul>
                      <p>Мы пришлем вам уведомление, когда появятся похожие события.</p>
                  </div>
      
                  <p>Приносим извинения за доставленные неудобства.</p>
              </div>
              <div class="footer">
                  <p>С уважением,<br>Команда Platforma Events</p>
                  <p><a href="https://platformaapp.ru/events">Посмотреть другие события</a></p>
                  <p>Если у вас есть вопросы, отвечайте на это письмо</p>
              </div>
          </div>
      </body>
      </html>
    `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Event cancelled email sent to ${email}`);
    } catch (err) {
      console.error(
        'Error sending event cancelled email:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }
  async sendMentorCancellationNotification(
    email: string,
    mentorName: string,
    eventTitle: string,
    studentName: string,
    studentEmail: string,
    eventDateTime: string,
    previousStatus: string
  ): Promise<void> {
    const mailOptions = {
      from: '"Platforma Events" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `❌ Студент отменил запись на "${eventTitle}"`,
      html: `
      <!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .cancellation-info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c; }
        .student-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .available-spots { background: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-item { margin: 10px 0; }
        .label { font-weight: bold; color: #555; }
        .value { color: #333; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
        .highlight { color: #e74c3c; font-weight: bold; }
        .info-icon { color: #17a2b8; font-size: 18px; margin-right: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Запись отменена</h1>
            <p>Студент отменил запись на ваше событие</p>
        </div>
        <div class="content">
            <p>Здравствуйте, <strong>${mentorName}</strong>!</p>
            <p>Студент отменил запись на ваше событие.</p>
            
            <div class="cancellation-info">
                <h2>📋 Информация об отмене</h2>
                
                <div class="detail-item">
                    <span class="label">Событие:</span>
                    <span class="value highlight">"${eventTitle}"</span>
                </div>
                
                <div class="detail-item">
                    <span class="label">Дата и время:</span>
                    <span class="value">${eventDateTime}</span>
                </div>
                
                <div class="detail-item">
                    <span class="label">Предыдущий статус:</span>
                    <span class="value">${previousStatus === 'registered' ? 'Зарегистрирован' : 'Ожидает подтверждения'}</span>
                </div>
            </div>

            <div class="student-info">
                <h3>👤 Отменивший студент</h3>
                <div class="detail-item">
                    <span class="label">Имя:</span>
                    <span class="value">${studentName}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Email:</span>
                    <span class="value">${studentEmail}</span>
                </div>
            </div>

            <div class="available-spots">
                <h3><span class="info-icon">📊</span> Доступные места</h3>
                <p>Теперь на вашем событии доступно на 1 место больше.</p>
                <p>Другие студенты смогут записаться на освободившееся место.</p>
            </div>

            <p><strong>💡 Что делать дальше?</strong></p>
            <ul>
                <li>Проверьте количество записанных участников в личном кабинете</li>
                <li>Если это повлияло на проведение события, обновите материалы</li>
                <li>При необходимости, можете изменить детали события</li>
            </ul>
        </div>
        <div class="footer">
            <p>С уважением,<br>Команда Platforma Events</p>
            <p><a href="https://platformaapp.ru/mentor/events">Перейти к управлению событиями</a></p>
        </div>
    </div>
</body>
</html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Mentor cancellation notification sent to ${email}`);
    } catch (err) {
      console.error(
        'Error sending mentor cancellation notification:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  async sendStudentCancellationConfirmation(
    email: string,
    studentName: string,
    eventTitle: string,
    mentorName: string,
    eventDateTime: string,
    eventPrice: number,
    wasPaid: boolean
  ): Promise<void> {
    const refundInfo = wasPaid
      ? 'Средства будут автоматически возвращены на ваш счет в течение 1-3 рабочих дней.'
      : 'Так как оплата еще не была произведена, плата с вас не будет взиматься.';

    const mailOptions = {
      from: '"Platforma Events" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `✅ Запись на "${eventTitle}" отменена`,
      html: `
      <!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .confirmation-info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
        .refund-section { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #155724; }
        .suggestions { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-item { margin: 12px 0; }
        .label { font-weight: bold; color: #555; }
        .value { color: #333; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
        .success-badge { background: #d4edda; color: #155724; padding: 5px 10px; border-radius: 15px; font-size: 12px; display: inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Запись отменена</h1>
            <p>Вы успешно отменили запись на событие</p>
        </div>
        <div class="content">
            <p>Здравствуйте, <strong>${studentName}</strong>!</p>
            <p>Ваша запись на событие была успешно отменена.</p>
            
            <div class="confirmation-info">
                <h2>📋 Подтверждение отмены</h2>
                
                <div class="detail-item">
                    <span class="label">Событие:</span>
                    <span class="value">"${eventTitle}"</span>
                </div>
                
                <div class="detail-item">
                    <span class="label">Наставник:</span>
                    <span class="value">${mentorName}</span>
                </div>
                
                <div class="detail-item">
                    <span class="label">Дата и время:</span>
                    <span class="value">${eventDateTime}</span>
                </div>
                
                <div class="detail-item">
                    <span class="label">Статус:</span>
                    <span class="success-badge">Запись отменена</span>
                </div>
            </div>

            ${
              eventPrice > 0
                ? `
            <div class="refund-section">
                <h3>💳 Возврат средств</h3>
                <p><strong>${refundInfo}</strong></p>
                <p>Если у вас есть вопросы по возврату средств, свяжитесь с нашей поддержкой.</p>
            </div>
            `
                : ''
            }

            <div class="suggestions">
                <h3>💡 Возможно вас заинтересует</h3>
                <ul>
                    <li>Посмотрите другие события наставника ${mentorName}</li>
                    <li>Изучите события по похожей тематике</li>
                    <li>Создайте уведомление о интересующих темах</li>
                </ul>
                <p>Мы поможем найти подходящее событие для вас!</p>
            </div>

            <p>Спасибо, что пользуетесь Platforma Events!</p>
        </div>
        <div class="footer">
            <p>С уважением,<br>Команда Platforma Events</p>
            <p><a href="https://platformaapp.ru/events">Посмотреть другие события</a></p>
            <p>Если у вас есть вопросы, отвечайте на это письмо</p>
        </div>
    </div>
</body>
</html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Student cancellation confirmation sent to ${email}`);
    } catch (err) {
      console.error(
        'Error sending student cancellation confirmation:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, fullName: string): Promise<void> {
    const resetUrl = `https://platformaapp.ru/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: '"Platforma" <platformaapp@platformaapp.ru>',
      to: email,
      subject: 'Сброс пароля',
      html: `
        <div style="max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:#007bff;padding:20px;text-align:center;">
            <h1 style="color:#fff;margin:0;">🔐 Сброс пароля</h1>
          </div>
          <div style="padding:30px;">
            <h2 style="color:#333;margin-top:0;">Здравствуйте, ${fullName || 'пользователь'}!</h2>
            <p style="color:#666;line-height:1.6;">
              Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы установить новый пароль:
            </p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${resetUrl}" style="background:#007bff;color:#fff;padding:15px 30px;
                 text-decoration:none;border-radius:5px;font-size:16px;display:inline-block;">
                Сбросить пароль
              </a>
            </div>
            <p style="color:#666;font-size:14px;">
              Или скопируйте ссылку:<br>
              <a href="${resetUrl}" style="color:#007bff;word-break:break-all;">${resetUrl}</a>
            </p>
            <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0;">
              <p style="color:#856404;margin:0;">
                ⏰ <strong>Ссылка действительна 1 час.</strong>
              </p>
            </div>
            <p style="color:#999;font-size:12px;border-top:1px solid #eee;padding-top:20px;">
              Если вы не запрашивали сброс пароля — проигнорируйте это письмо.
            </p>
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;">
            <p style="color:#6c757d;font-size:12px;margin:0;">
              © ${new Date().getFullYear()} Platforma. Все права защищены.
            </p>
          </div>
        </div>
      `,
    };

    const info = await this.transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}, messageId: ${info.messageId}, response: ${info.response}`);
  }

  async sendTutorApplicationNotification(applicant: {
    fullName: string;
    email: string;
    phone?: string | null;
    telegram?: string | null;
  }): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL');
    if (!adminEmail) {
      console.warn('[EmailService] ADMIN_NOTIFICATION_EMAIL not set, skipping tutor application notification');
      return;
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://platformaapp.ru');
    const adminUrl = `${frontendUrl}/admin/tutor-applications`;

    const mailOptions = {
      from: 'Platforma <platformaapp@platformaapp.ru>',
      to: adminEmail,
      subject: '📋 Новая заявка на роль наставника',
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:sans-serif;background:#fff;">
          <div style="background:#1a1a1a;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;">Новая заявка на наставника</h1>
          </div>
          <div style="padding:32px;">
            <p style="color:#333;font-size:16px;margin-top:0;">
              Поступила новая заявка на регистрацию наставником:
            </p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr>
                <td style="padding:10px 0;color:#666;width:140px;">Имя</td>
                <td style="padding:10px 0;color:#111;font-weight:600;">${applicant.fullName || '—'}</td>
              </tr>
              <tr style="border-top:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#666;">Email</td>
                <td style="padding:10px 0;color:#111;">${applicant.email}</td>
              </tr>
              ${applicant.phone ? `
              <tr style="border-top:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#666;">Телефон</td>
                <td style="padding:10px 0;color:#111;">${applicant.phone}</td>
              </tr>` : ''}
              ${applicant.telegram ? `
              <tr style="border-top:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#666;">Telegram</td>
                <td style="padding:10px 0;color:#111;">${applicant.telegram}</td>
              </tr>` : ''}
            </table>
            <div style="text-align:center;margin-top:32px;">
              <a href="${adminUrl}"
                 style="background:#1a1a1a;color:#fff;padding:14px 28px;text-decoration:none;
                        border-radius:6px;font-size:15px;display:inline-block;">
                Рассмотреть заявку
              </a>
            </div>
          </div>
          <div style="background:#f8f8f8;padding:16px;text-align:center;">
            <p style="color:#999;font-size:12px;margin:0;">
              © ${new Date().getFullYear()} Platforma — автоматическое уведомление
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Tutor application notification sent to ${adminEmail}`);
    } catch (err) {
      console.error('Error sending tutor application notification:', err instanceof Error ? err.message : err);
    }
  }

  async sendEventModerationEmail(params: {
    email: string;
    tutorName: string;
    eventTitle: string;
    changes: { coverChanged: boolean; titleChanged: boolean; descriptionChanged: boolean };
    newCoverUrl?: string;
    comment?: string;
  }): Promise<void> {
    const { email, tutorName, eventTitle, changes, newCoverUrl, comment } = params;

    const changesList: string[] = [];
    if (changes.coverChanged) changesList.push('обложка события');
    if (changes.titleChanged) changesList.push('название события');
    if (changes.descriptionChanged) changesList.push('описание события');
    const changesText = changesList.join(', ');

    const coverBlock = changes.coverChanged && newCoverUrl
      ? `<div style="margin:20px 0;">
           <p style="color:#555;margin-bottom:8px;">Рекомендуемая обложка взамен ранее прикреплённой:</p>
           <img src="${newCoverUrl}" alt="Новая обложка" style="max-width:100%;border-radius:8px;border:1px solid #e0e0e0;" />
         </div>`
      : '';

    const commentBlock = comment
      ? `<div style="background:#f0f7ff;border-left:4px solid #007bff;padding:15px;margin:20px 0;border-radius:4px;">
           <p style="color:#333;margin:0;"><strong>Комментарий от команды платформы:</strong></p>
           <p style="color:#555;margin:8px 0 0;">${comment}</p>
         </div>`
      : '';

    const mailOptions = {
      from: '"Platforma" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `Небольшие правки в вашем событии «${eventTitle}»`,
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#fff;">
          <div style="background:#007bff;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">Обновление вашего события</h1>
          </div>
          <div style="padding:30px;">
            <h2 style="color:#333;margin-top:0;">Привет, ${tutorName || 'наставник'}!</h2>
            <p style="color:#555;line-height:1.7;">
              В вашем событии <strong>«${eventTitle}»</strong> были внесены изменения (${changesText}).
            </p>
            ${coverBlock}
            ${commentBlock}
            <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0;">
              <p style="color:#333;margin:0 0 10px;font-weight:bold;">Не согласны с нашими правками?</p>
              <p style="color:#555;margin:0;line-height:1.7;">
                Напишите нам в Telegram —
                <a href="https://t.me/vladislav_yakunin" style="color:#007bff;text-decoration:none;font-weight:bold;">@vladislav_yakunin</a>.
                Давайте вместе доработаем событие, чтобы и вам, и нам было хорошо и приятно. 🤝
              </p>
            </div>
            <p style="color:#555;line-height:1.7;">
              Вы в любой момент можете зайти в личный кабинет и изменить обложку или текст самостоятельно.
            </p>
          </div>
          <div style="background:#f8f9fa;padding:15px;text-align:center;">
            <p style="color:#999;font-size:12px;margin:0;">
              © ${new Date().getFullYear()} Platforma. Все права защищены.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Event moderation email sent to ${email} for event "${eventTitle}"`);
    } catch (err) {
      console.error('Error sending event moderation email:', err instanceof Error ? err.message : err);
    }
  }

  async sendEventRegistrationConfirmationEmail(params: {
    email: string;
    studentName: string;
    eventTitle: string;
    mentorName: string;
    eventDateTime: string;
    eventPrice: number;
    eventId: string;
    isPaid: boolean;
  }): Promise<void> {
    const { email, studentName, eventTitle, mentorName, eventDateTime, eventPrice, eventId, isPaid } = params;

    const formattedDate = new Date(eventDateTime).toLocaleString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    const priceBlock = eventPrice > 0
      ? `<div class="detail-item">
           <span class="label">Стоимость:</span>
           <span class="value">${eventPrice} ₽${isPaid ? ' (оплачено)' : ' (ожидает оплаты)'}</span>
         </div>`
      : `<div class="detail-item">
           <span class="label">Стоимость:</span>
           <span class="value">Бесплатно</span>
         </div>`;

    const mailOptions = {
      from: '"Platforma" <platformaapp@platformaapp.ru>',
      to: email,
      subject: `Вы записаны на событие «${eventTitle}»`,
      html: `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .event-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
            .detail-item { margin: 12px 0; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; }
            .cta-button { display: inline-block; background: #28a745; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Вы записаны!</h1>
              <p>Регистрация на событие подтверждена</p>
            </div>
            <div class="content">
              <p>Здравствуйте, <strong>${studentName}</strong>!</p>
              <p>Вы успешно зарегистрировались на событие. Ждём вас!</p>

              <div class="event-card">
                <h2 style="margin-top:0;color:#28a745;">${eventTitle}</h2>
                <div class="detail-item">
                  <span class="label">Наставник:</span>
                  <span class="value">${mentorName}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Дата и время:</span>
                  <span class="value">${formattedDate} (МСК)</span>
                </div>
                ${priceBlock}
              </div>

              <p style="text-align:center;">
                <a href="https://platformaapp.ru/events/${eventId}" class="cta-button">Перейти к событию</a>
              </p>

              <p style="color:#555;">Ссылка для подключения появится на странице события незадолго до начала.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Platforma. Все права защищены.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Registration confirmation sent to student ${email} for event "${eventTitle}"`);
    } catch (err) {
      console.error('Error sending registration confirmation email:', err instanceof Error ? err.message : err);
    }
  }
}
