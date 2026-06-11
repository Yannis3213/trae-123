import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('warningLevel') warningLevel?: string,
    @Query('role') role?: string,
  ) {
    return this.ordersService.findAll({ status, warningLevel, role });
  }

  @Get('warnings')
  getWarnings() {
    return this.ordersService.getWarnings();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.ordersService.create(body);
  }

  @Put(':id/correct')
  correct(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.correct(id, body);
  }

  @Put(':id/review')
  review(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.review(id, body);
  }

  @Put(':id/approve')
  approve(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.approve(id, body);
  }

  @Put(':id/return')
  returnOrder(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.returnOrder(id, body);
  }

  @Post('batch-review')
  batchReview(@Body() body: any) {
    return this.ordersService.batchReview(body);
  }

  @Post('batch-approve')
  batchApprove(@Body() body: any) {
    return this.ordersService.batchApprove(body);
  }
}
