import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReturnsService } from './returns.service';
import { ReturnsRefundService } from './returns.refund.service';
import { ReturnsMetricsService } from './returns.metrics.service';
import { reviewReturnSchema } from './dto/review-return.dto';
import { approveReturnSchema } from './dto/approve-return.dto';
import { rejectReturnSchema } from './dto/reject-return.dto';
import { markReceivedSchema } from './dto/mark-received.dto';
import { inspectReturnSchema } from './dto/inspect-return.dto';
import { listReturnsSchema } from './dto/list-returns.dto';
import { issueRefundSchema } from './dto/issue-refund.dto';
import { manualReturnSchema } from './dto/manual-return.dto';
import type { ReviewReturnDto } from './dto/review-return.dto';
import type { ApproveReturnDto } from './dto/approve-return.dto';
import type { RejectReturnDto } from './dto/reject-return.dto';
import type { MarkReceivedDto } from './dto/mark-received.dto';
import type { InspectReturnDto } from './dto/inspect-return.dto';
import type { ListReturnsDto } from './dto/list-returns.dto';
import type { IssueRefundDto } from './dto/issue-refund.dto';
import type { ManualReturnDto } from './dto/manual-return.dto';

@Controller('admin/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
export class ReturnsAdminController {
  constructor(
    private readonly returns: ReturnsService,
    private readonly refunds: ReturnsRefundService,
    private readonly metrics: ReturnsMetricsService,
  ) {}

  @Get()
  async list(@Query(new ZodValidationPipe(listReturnsSchema)) query: ListReturnsDto) {
    const status = Array.isArray(query.status)
      ? query.status
      : query.status
        ? [query.status]
        : undefined;
    return this.returns.listForAdmin({
      status,
      slaOverdue: query.slaOverdue,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('manual')
  async createManual(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(manualReturnSchema)) dto: ManualReturnDto,
  ) {
    return this.returns.createManual({ adminId: user.id, dto });
  }

  @Get('metrics/dashboard')
  async dashboardMetrics(@Query('rangeDays') rangeDays = '30') {
    const parsed = parseInt(rangeDays, 10);
    return this.metrics.getDashboard(Number.isFinite(parsed) ? parsed : 30);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.returns.getForAdmin(id);
  }

  @Patch(':id/review')
  async review(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(reviewReturnSchema)) dto: ReviewReturnDto,
  ) {
    return this.returns.transition({
      id,
      to: 'UNDER_REVIEW',
      adminId: user.id,
      patch: {
        reviewer: { connect: { id: user.id } },
        reviewerNotes: dto.reviewerNotes,
      },
    });
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(approveReturnSchema)) dto: ApproveReturnDto,
  ) {
    const pickupAddress =
      dto.pickupAddress === undefined
        ? undefined
        : dto.pickupAddress === null
          ? Prisma.JsonNull
          : (dto.pickupAddress as Prisma.InputJsonValue);
    return this.returns.transition({
      id,
      to: 'APPROVED',
      adminId: user.id,
      patch: {
        carrier: dto.carrier,
        pickupAddress,
        reviewerNotes: dto.approvalNotes,
      },
    });
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(rejectReturnSchema)) dto: RejectReturnDto,
  ) {
    return this.returns.transition({
      id,
      to: 'REJECTED',
      adminId: user.id,
      patch: { rejectionReason: dto.rejectionReason, closedAt: new Date() },
    });
  }

  @Patch(':id/mark-received')
  async markReceived(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(markReceivedSchema)) dto: MarkReceivedDto,
  ) {
    return this.returns.transition({
      id,
      to: 'RECEIVED',
      adminId: user.id,
      patch: { trackingNumber: dto.trackingNumber },
    });
  }

  @Patch(':id/start-inspection')
  async startInspection(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.returns.transition({
      id,
      to: 'INSPECTING',
      adminId: user.id,
    });
  }

  @Patch(':id/inspect')
  async inspect(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(inspectReturnSchema)) dto: InspectReturnDto,
  ) {
    return this.returns.recordInspection({
      id,
      adminId: user.id,
      itemResults: dto.itemResults,
      inspectionNotes: dto.inspectionNotes,
    });
  }

  @Patch(':id/return-to-customer')
  async returnToCustomer(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.returns.transition({
      id,
      to: 'RETURNED_TO_CUSTOMER',
      adminId: user.id,
      patch: { closedAt: new Date() },
    });
  }

  @Post(':id/issue-refund')
  async issueRefund(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(issueRefundSchema)) dto: IssueRefundDto,
  ) {
    return this.refunds.issueRefund({
      returnId: id,
      adminId: user.id,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference,
      notes: dto.notes,
      overrideFromFail: dto.overrideFromFail,
    });
  }
}
