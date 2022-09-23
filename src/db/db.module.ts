import { Module } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';

export const PG_CONNECTION = 'PG_CONNECTION';

const dbProvider = {
  provide: PG_CONNECTION,
  useValue: new Pool({
    user: 'postgres',
    password: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'cars_test',
  }),
};
export type db_type = typeof dbProvider.useValue;

@Module({
  providers: [dbProvider],
  exports: [dbProvider],
})
export class DbModule {}
