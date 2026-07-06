import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  async stats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [totalRooms, occupied, arrivalsToday, departuresToday, pendingReservations, inventory, workOrders, activeHousekeeping, summary] =
      await Promise.all([
        this.prisma.room.count({ where: { isActive: true } }),
        this.prisma.room.count({ where: { isActive: true, status: 'OCCUPIED' } }),
        this.prisma.reservation.count({ where: { checkInDate: { gte: startOfToday, lt: endOfToday }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),
        this.prisma.reservation.count({ where: { checkOutDate: { gte: startOfToday, lt: endOfToday }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] } } }),
        this.prisma.reservation.count({ where: { status: 'PENDING' } }),
        this.prisma.inventoryItem.findMany({ select: { currentQty: true, minStockLevel: true } }),
        this.prisma.workOrder.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        this.prisma.housekeepingTask.count({ where: { status: { not: 'COMPLETED' } } }),
        this.finance.summary(),
      ]);

    return {
      occupancyRate: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0,
      revenueToday: summary.revenue,
      arrivalsToday,
      departuresToday,
      pendingReservations,
      lowStockAlerts: inventory.filter((i) => i.currentQty < i.minStockLevel).length,
      openWorkOrders: workOrders,
      activeHousekeeping,
    };
  }

  async reportsOverview() {
    const [rooms, occupied, inventory, payroll, workOrders, summary] = await Promise.all([
      this.prisma.room.count({ where: { isActive: true } }),
      this.prisma.room.count({ where: { isActive: true, status: 'OCCUPIED' } }),
      this.prisma.inventoryItem.findMany(),
      this.prisma.payrollPeriod.findMany({ orderBy: { startDate: 'desc' }, take: 1 }),
      this.prisma.workOrder.findMany(),
      this.finance.summary(),
    ]);

    const inventoryValuation = inventory.reduce((s, i) => s + i.currentQty * Number(i.unitCost), 0);
    const workOrderSpend = workOrders.reduce((s, w) => s + Number(w.estimatedCost), 0);

    return {
      occupancyRate: rooms ? Math.round((occupied / rooms) * 100) : 0,
      revenueByAccount: summary.byAccount,
      totalRevenue: summary.revenue,
      totalExpense: summary.expense + summary.payroll,
      netPosition: summary.net,
      inventoryValuation,
      latestPayroll: payroll[0] ? { periodName: payroll[0].periodName, totalGross: Number(payroll[0].totalGross), totalNet: Number(payroll[0].totalNet), headcount: payroll[0].headcount } : null,
      workOrderSpend,
    };
  }
}
