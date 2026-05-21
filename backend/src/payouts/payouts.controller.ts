import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { TutorGuard } from 'src/auth/guards/tutor.guard';
import { AuthenticatedRequest } from 'src/utils/types';
import { PayoutMethod } from './entities/tutor-payout.entity';
import { IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class SavePayoutDetailsDto {
  @IsEnum(PayoutMethod)
  method: PayoutMethod;

  @IsString()
  @IsNotEmpty()
  destination: string;
}

class RequestPayoutDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;
}

@Controller('tutor/payouts')
@UseGuards(TutorGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('balance')
  @HttpCode(HttpStatus.OK)
  async getBalance(@Req() req: AuthenticatedRequest) {
    const data = await this.payoutsService.getBalance(req.user.sub);
    return { success: true, data };
  }

  @Get('details')
  @HttpCode(HttpStatus.OK)
  async getPayoutDetails(@Req() req: AuthenticatedRequest) {
    const data = await this.payoutsService.getPayoutDetails(req.user.sub);
    return { success: true, data };
  }

  @Patch('details')
  @HttpCode(HttpStatus.OK)
  async savePayoutDetails(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SavePayoutDetailsDto,
  ) {
    await this.payoutsService.savePayoutDetails(req.user.sub, dto.method, dto.destination);
    return { success: true, message: 'Реквизиты сохранены' };
  }

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  async requestPayout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestPayoutDto,
  ) {
    const payout = await this.payoutsService.requestPayout(req.user.sub, dto.amount);
    return {
      success: true,
      data: {
        id: payout.id,
        amount: Number(payout.amount),
        currency: payout.currency,
        status: payout.status,
        method: payout.method,
        destinationMasked: payout.destinationMasked,
        createdAt: payout.createdAt,
      },
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getPayouts(@Req() req: AuthenticatedRequest) {
    const payouts = await this.payoutsService.getPayouts(req.user.sub);
    return {
      success: true,
      data: payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        method: p.method,
        destinationMasked: p.destinationMasked,
        yookassaPayoutId: p.yookassaPayoutId,
        errorMessage: p.errorMessage,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
      })),
    };
  }
}
