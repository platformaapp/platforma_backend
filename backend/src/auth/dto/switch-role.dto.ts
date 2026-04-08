import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { UserRole } from 'src/users/user.entity';

export class SwitchRoleDto {
  @ApiProperty({
    description: 'Role to switch to',
    enum: ['student', 'tutor', 'admin'],
    example: 'tutor',
  })
  @IsEnum(['student', 'tutor', 'admin'])
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Refresh token (if not sent via cookie)',
    example: 'abc123...',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
