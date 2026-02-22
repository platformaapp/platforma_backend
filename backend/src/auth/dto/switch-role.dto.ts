import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import type { UserRole } from 'src/users/user.entity';

export class SwitchRoleDto {
  @ApiProperty({
    description: 'Role to switch to',
    enum: ['student', 'tutor', 'admin'],
    example: 'tutor',
  })
  @IsEnum(['student', 'tutor', 'admin'])
  role: UserRole;
}
