import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [AuthModule, JwtModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
