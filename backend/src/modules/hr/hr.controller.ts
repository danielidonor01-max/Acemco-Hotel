import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmploymentType, EmployeeStatus, LeaveType, LeaveStatus } from '@prisma/client';
import { z } from 'zod';
import { HrService } from './hr.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  position: z.string().min(1),
  employmentType: z.nativeEnum(EmploymentType).default('FULL_TIME'),
  status: z.nativeEnum(EmployeeStatus).default('ACTIVE'),
  startDate: z.string(),
});
const updateEmployeeSchema = z.object({
  department: z.string().optional(),
  position: z.string().optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
});
const createLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.nativeEnum(LeaveType).default('ANNUAL'),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number().int().min(1),
});
const leaveStatusSchema = z.object({ status: z.nativeEnum(LeaveStatus) });

@ApiTags('hr')
@Controller('v1')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('employees')
  @RequirePermissions('hr:VIEW')
  listEmployees() {
    return this.hr.listEmployees();
  }

  @Post('employees')
  @RequirePermissions('hr:CREATE')
  createEmployee(@Body(new ZodValidationPipe(createEmployeeSchema)) dto: z.infer<typeof createEmployeeSchema>) {
    const { startDate, ...rest } = dto;
    return this.hr.createEmployee({ ...rest, startDate: new Date(startDate) });
  }

  @Patch('employees/:id')
  @RequirePermissions('hr:UPDATE')
  updateEmployee(@Param('id') id: string, @Body(new ZodValidationPipe(updateEmployeeSchema)) dto: z.infer<typeof updateEmployeeSchema>) {
    return this.hr.updateEmployee(id, dto);
  }

  @Get('leave-requests')
  @RequirePermissions('hr:VIEW')
  listLeave() {
    return this.hr.listLeave();
  }

  @Post('leave-requests')
  @RequirePermissions('hr:CREATE')
  createLeave(@Body(new ZodValidationPipe(createLeaveSchema)) dto: z.infer<typeof createLeaveSchema>) {
    return this.hr.createLeave(dto);
  }

  @Patch('leave-requests/:id')
  @RequirePermissions('hr:APPROVE')
  setLeaveStatus(@Param('id') id: string, @Body(new ZodValidationPipe(leaveStatusSchema)) dto: z.infer<typeof leaveStatusSchema>) {
    return this.hr.setLeaveStatus(id, dto.status);
  }
}
