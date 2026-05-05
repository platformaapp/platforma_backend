import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { GetApplicationsDto } from './dto/get-applications.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';

@ApiTags('Admin Tutor Applications')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminJwtGuard)
@Controller('admin/tutor-applications')
export class AdminTutorApplicationsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'List tutor applications with pagination and optional status filter' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'per_page', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiResponse({ status: 200, description: 'List of applications' })
  async getApplications(@Query() query: GetApplicationsDto) {
    return this.adminService.getApplications(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a tutor application' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Application approved' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.approveApplication(id);
    return { message: 'Заявка одобрена' };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a tutor application' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Application rejected' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectApplicationDto
  ) {
    await this.adminService.rejectApplication(id, dto.reason);
    return { message: 'Заявка отклонена' };
  }
}
