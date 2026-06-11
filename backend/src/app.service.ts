import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '农业合作社-月底集中处理种植任务系统 API 运行中';
  }
}
