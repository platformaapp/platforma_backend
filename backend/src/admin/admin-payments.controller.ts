import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminPaymentsService, PaymentExportRow } from './admin-payments.service';

const CSV_HEADERS = [
  'Дата создания заказа в ЮKassa',
  'Дата платежа',
  'Идентификатор платежа',
  'Статус платежа',
  'Сумма платежа',
  'Сумма к зачислению',
  'Валюта',
  'Описание заказа',
  'Метод платежа',
  'Сумма возврата по платежу',
  'Дата возврата',
  'RRN операции',
  'Номер карты плательщика',
  'Статус авторизации',
  'Код articleId',
  'Имя articleId',
  'Номер счёта',
  'Тариф кредита',
  'Скидка по кредиту',
  'Признак платежа',
  'lecture_id',
  'lecture_name',
  'lecture_date',
  'speaker_id',
  'speaker_name',
];

function csvCell(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function fmtDate(d: Date | null): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function rowToCsvLine(r: PaymentExportRow): string {
  const cells = [
    fmtDate(r.orderCreatedAt),
    fmtDate(r.paidAt),
    r.paymentId,
    r.status,
    r.amount.toFixed(2),
    r.incomeAmount,
    r.currency,
    r.description,
    r.paymentMethod,
    r.refundAmount,
    fmtDate(r.refundedAt),
    r.rrn,
    r.cardMasked,
    r.authStatus,
    r.articleIdCode,
    r.articleIdName,
    r.accountNumber,
    r.creditTariff,
    r.creditDiscount,
    r.paymentSign,
    r.lectureId,
    r.lectureName,
    fmtDate(r.lectureDate),
    r.speakerId,
    r.speakerName,
  ];
  return cells.map(csvCell).join(';');
}

@ApiTags('Admin Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminJwtGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Get('export')
  @ApiOperation({
    summary:
      'Выгрузка всех платежей (сессии + мероприятия) в CSV, колонки как в ' +
      'отчёте ЮKassa + lecture_id/lecture_name/lecture_date/speaker_id/speaker_name. ' +
      'Без from/to — за весь период. "Сумма к зачислению", RRN, статус авторизации, ' +
      'точная сумма возврата и аналитические метки ЮKassa у нас не хранятся — ' +
      'колонки присутствуют для совместимости формата, но остаются пустыми.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO дата, включительно' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO дата, включительно' })
  async exportPayments(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const rows = await this.adminPaymentsService.exportPayments(fromDate, toDate);

    const lines = [CSV_HEADERS.join(';'), ...rows.map(rowToCsvLine)];
    // BOM — иначе Excel по умолчанию читает UTF-8 CSV как ANSI и ломает кириллицу.
    const csv = '﻿' + lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payments_export_${Date.now()}.csv"`
    );
    res.send(csv);
  }
}
