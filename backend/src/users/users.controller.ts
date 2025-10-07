import { Body, Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieve a list of all users. Requires JWT authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved list of users',
    schema: {
      example: [
        {
          id: 1,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ],
    },
  })
  findAll() {
    return this.usersService.findAll();
  }
}
