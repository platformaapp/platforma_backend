import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Администратор';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  synchronize: false,
  logging: false,
});

async function seedAdmin() {
  await dataSource.initialize();

  const usersRepo = dataSource.getRepository('users');

  const existing = await usersRepo.findOne({ where: { email: ADMIN_EMAIL } }) as any;

  if (existing) {
    const roles: string[] = existing.roles ?? [];
    if (roles.includes('admin')) {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
      await dataSource.destroy();
      return;
    }

    existing.roles = [...roles, 'admin'];
    await usersRepo.save(existing);
    console.log(`Admin role added to existing user: ${ADMIN_EMAIL}`);
    await dataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await usersRepo.save(
    usersRepo.create({
      email: ADMIN_EMAIL,
      passwordHash,
      fullName: ADMIN_NAME,
      roles: ['admin'],
      phone: null,
      avatarUrl: null,
      bio: null,
    })
  );

  console.log(`Admin user created: ${ADMIN_EMAIL}`);
  await dataSource.destroy();
}

seedAdmin().catch((err: unknown) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
