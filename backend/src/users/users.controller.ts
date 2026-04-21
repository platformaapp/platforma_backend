import { Controller, Get, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users (public)' })
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
