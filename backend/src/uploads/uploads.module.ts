import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AuthModule, JwtModule, ConfigModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
