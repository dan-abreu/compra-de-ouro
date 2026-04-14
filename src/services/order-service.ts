import { PrismaClient } from "@prisma/client";

import {
  CreatePurchaseOrderInput as CreatePurchaseOrderCommand,
  PurchaseOrderService
} from "./purchase-order-service.js";
import {
  CreateSalesOrderInput as CreateSalesOrderCommand,
  SalesOrderService
} from "./sales-order-service.js";

export type CreatePurchaseOrderInput = CreatePurchaseOrderCommand;
export type CreateSalesOrderInput = CreateSalesOrderCommand;

export class OrderService {
  private readonly purchaseOrderService: PurchaseOrderService;
  private readonly salesOrderService: SalesOrderService;

  constructor(private readonly prisma: PrismaClient) {
    this.purchaseOrderService = new PurchaseOrderService(prisma);
    this.salesOrderService = new SalesOrderService(prisma);
  }

  async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    return this.purchaseOrderService.create(input);
  }

  async createSalesOrder(input: CreateSalesOrderInput) {
    return this.salesOrderService.create(input);
  }
}
