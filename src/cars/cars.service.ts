import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { db_type, PG_CONNECTION } from '../db/db.module';
import { CreateCarDto } from './dto/create-car.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateCarDto } from './dto/update-car.dto';

import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import {
  BASE_PRICE,
  DAYS_FOR_NEXT_BOOK,
  MAX_DAYS_FOR_BOOKING,
  PERIOD_1,
  PERIOD_2,
  PERIOD_3,
  SALE_PERIOD_1,
  SALE_PERIOD_2,
  SALE_PERIOD_3,
  SALE_PERIOD_4,
} from '../constants';

dayjs.extend(utc);

@Injectable()
export class CarsService {
  constructor(@Inject(PG_CONNECTION) private db: db_type) {}

  async createCar(createCarDto: CreateCarDto) {
    const isValidNumberPlate = /^[а-я]{1}[0-9]{3}[а-я]{2}[0-9]{2}$/.test(createCarDto.number_plate);
    if (isValidNumberPlate) {
      const isExistCarWithTheNumberPlate = (
        await this.db.query('SELECT * FROM cars WHERE number_plate = $1', [createCarDto.number_plate])
      ).rows[0];
      if (isExistCarWithTheNumberPlate) {
        throw new HttpException(
          { message: 'Автомобиль с таким гос.номером уже существует' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const car = await this.db.query('INSERT INTO  cars (model, number_plate) values ($1, $2) RETURNING *', [
        createCarDto.model,
        createCarDto.number_plate,
      ]);
      return car.rows[0];
    } else {
      throw new HttpException({ message: 'Гос.номер указан неверно' }, HttpStatus.BAD_REQUEST);
    }
  }

  async getCars() {
    return (await this.db.query('SELECT * FROM cars')).rows;
  }

  async getCarById(id: number) {
    return (await this.db.query('SELECT * FROM cars where id = $1', [id])).rows[0];
  }

  async updateCar(updateCarDto: UpdateCarDto) {
    return (
      await this.db.query('UPDATE cars SET isBooking = $1 WHERE id = $2 RETURNING *', [
        updateCarDto.isBooking,
        updateCarDto.id,
      ])
    ).rows[0];
  }

  async bookCar(createBookDto: CreateBookDto) {
    const car = await this.getCarById(createBookDto.car_id);
    if (car.isbooking) {
      throw new HttpException({ message: 'Данный автомобиль уже забронирован' }, HttpStatus.BAD_REQUEST);
    }

    const dataStart = dayjs.utc(createBookDto.dataStart);
    const dataEnd = dayjs.utc(createBookDto.dataEnd);

    const days_of_booking = dataEnd.diff(dataStart, 'day');
    if (days_of_booking > MAX_DAYS_FOR_BOOKING) {
      throw new HttpException(
        { message: 'Автомобиль возможно забронировать максимум на 30 дней' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const dayStart = dataStart.day();
    const dayEnd = dataEnd.day();
    const checkIsWeekDayAllowed = (date: number): boolean => [6, 0].includes(date);

    if (checkIsWeekDayAllowed(dayStart) || checkIsWeekDayAllowed(dayEnd)) {
      throw new HttpException(
        { message: 'Даты начала и конца бронирования не могут быть субботой или воскресеньем' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const lastBook = (
      await this.db.query('SELECT * FROM booking_cars where car_id = $1 ORDER BY booking_end DESC LIMIT 1', [
        createBookDto.car_id,
      ])
    ).rows[0];
    if (lastBook) {
      const lastBookDateEnd = dayjs(lastBook.booking_end);
      const isBanBookTime = dataStart.diff(lastBookDateEnd, 'day') < DAYS_FOR_NEXT_BOOK;
      if (isBanBookTime) {
        throw new HttpException(
          {
            message: `Между бронированиями данной машины должно пройти 3 дня, бронировать можно с ${lastBookDateEnd
              .add(DAYS_FOR_NEXT_BOOK, 'day')
              .format('YYYY-MM-DD')}`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    await this.updateCar({ id: createBookDto.car_id, isBooking: true });
    const newBook = await this.db.query(
      'INSERT INTO  booking_cars (booking_start, booking_end, car_id, total_cost) values ($1, $2, $3, $4) RETURNING *',
      [dataStart, dataEnd, createBookDto.car_id, this.calculateTotalCost(days_of_booking)],
    );
    return newBook.rows[0];
  }

  async getBooking() {
    return (await this.db.query('SELECT * FROM booking_cars')).rows;
  }

  async getReport(month: number) {
    const cars = (await this.db.query('SELECT * FROM cars')).rows;
    const bookings = (
      await this.db.query(
        'SELECT * FROM cars as c ' +
          'INNER JOIN booking_cars as b on c.id = b.car_id ' +
          'WHERE (SELECT EXTRACT(month from b.booking_start) = $1) OR (SELECT EXTRACT(month from b.booking_end) = $1)',
        [month],
      )
    ).rows;

    const report = {};
    let totalDaysInBooking = 0;

    cars.forEach((car) => {
      const totalBookingDays = bookings.reduce((previousValue, currentValue) => {
        if (car.id === currentValue.car_id) {
          const start = dayjs(currentValue.booking_start);
          const end = dayjs(currentValue.booking_end);
          if (start.month() + 1 !== end.month() + 1) {
            if (month === start.month() + 1) {
              const newDate = start.endOf('month');
              return Number(previousValue) + Number(newDate.diff(start, 'day'));
            } else if (month === end.month() + 1) {
              const newDate = end.startOf('month');
              return Number(previousValue) + Number(end.diff(newDate, 'day'));
            }
          }
          return Number(previousValue) + Number(end.diff(start, 'day'));
        }
      }, 0);

      const percentageDaysInBooking = (totalBookingDays / dayjs().endOf('month').date()) * 100;
      const checkIsNan = isNaN(percentageDaysInBooking) ? 0 : percentageDaysInBooking;
      totalDaysInBooking += checkIsNan;
      report[
        car.number_plate
      ] = `Автомобиль с гос.номером ${car.number_plate}: % дней бронирования за месяц - ${checkIsNan}%`;
    });
    report['total'] = (totalDaysInBooking / cars.length).toFixed(2);
    return report;
  }

  private calculateTotalCost(amountOfDays: number) {
    const getSalePercent = (dayNumber: number) => {
      if (dayNumber <= PERIOD_1) {
        return SALE_PERIOD_1;
      } else if (dayNumber > PERIOD_1 && dayNumber <= PERIOD_2) {
        return SALE_PERIOD_2;
      } else if (dayNumber > PERIOD_2 && dayNumber <= PERIOD_3) {
        return SALE_PERIOD_3;
      }
      return SALE_PERIOD_4;
    };

    let salePercent = 0;

    for (let i = 1; i <= amountOfDays; i++) {
      salePercent += getSalePercent(i);
    }

    const sale = (BASE_PRICE * salePercent) / 100;
    return amountOfDays * BASE_PRICE - sale;
  }
}
