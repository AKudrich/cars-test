import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { DbModule } from '../db/db.module';

@Module({
  controllers: [CarsController],
  providers: [CarsService],
  imports: [DbModule],
})
export class CarsModule {}
