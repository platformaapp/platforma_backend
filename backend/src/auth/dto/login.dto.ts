import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from 'src/users/user.entity';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'student', enum: ['student', 'tutor', 'admin'] })
  @IsEnum(['student', 'tutor', 'admin'])
  @IsNotEmpty()
  role: UserRole;
}
