import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { PlanModule } from './modules/plan/plan.module';
import { UserContextMiddleware } from './middleware/user-context.middleware';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'pr_system.db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    AuthModule,
    PlanModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
