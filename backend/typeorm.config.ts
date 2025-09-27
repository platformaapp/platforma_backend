import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { NODE_ENV } from 'src/utils/constants';

dotenv.config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/src/migrations/*.js'],
  synchronize: NODE_ENV === 'development',
  logging: false,
});
