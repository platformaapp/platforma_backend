import { IsEnum, IsInt, IsOptional, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import type { UserRole } from '../../users/user.entity';

export enum MyEventsFilter {
  ALL = 'all',
  EVENTS = 'events',
  PERSONAL = 'personal',
}

export class MyEventsQueryDto {
  @IsIn(['student', 'tutor', 'admin'])
  role: UserRole;

  @IsOptional()
  @IsEnum(MyEventsFilter)
  filter?: MyEventsFilter = MyEventsFilter.ALL;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page: number = 10;
}
