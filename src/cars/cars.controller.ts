import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CreateCarDto } from './dto/create-car.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateCarDto } from './dto/update-car.dto';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  createCar(@Body() createCarDto: CreateCarDto) {
    return this.carsService.createCar(createCarDto);
  }

  @Get()
  getCars() {
    return this.carsService.getCars();
  }

  @Put()
  updateCar(@Body() updateCarDto: UpdateCarDto) {
    return this.carsService.updateCar(updateCarDto);
  }

  @Post('booking')
  bookCar(@Body() createBookDto: CreateBookDto) {
    return this.carsService.bookCar(createBookDto);
  }

  @Get('booking')
  getBooking() {
    return this.carsService.getBooking();
  }

  @Get('report/:month')
  getReport(@Param('month') month: number) {
    return this.carsService.getReport(+month);
  }
}
