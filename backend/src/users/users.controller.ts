import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all users. Requires JWT authentication.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Successfully retrieved list of users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('tutors')
  @ApiOperation({ summary: 'Get all tutors (public)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of users with tutor role',
    schema: {
      example: [{ id: 'uuid', fullName: 'Иван Иванов', avatarUrl: null, bio: 'Описание', roles: ['tutor'] }],
    },
  })
  findTutors() {
    return this.usersService.findTutors();
  }
}
