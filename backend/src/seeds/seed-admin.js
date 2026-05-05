#!/usr/bin/env node
'use strict';

const { Client } = require('pg');
const bcrypt = require('bcrypt');

const path = require('path');
// Try project root .env first, then backend/.env
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Администратор';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT || '5432';
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
  console.error('Error: DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME must be set in .env');
  console.error(`  DB_HOST=${DB_HOST ?? '(not set)'}`);
  console.error(`  DB_USERNAME=${DB_USERNAME ?? '(not set)'}`);
  console.error(`  DB_PASSWORD=${DB_PASSWORD ? '(set)' : '(not set)'}`);
  console.error(`  DB_NAME=${DB_NAME ?? '(not set)'}`);
  process.exit(1);
}

async function seedAdmin() {
  const client = new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  await client.connect();

  const { rows } = await client.query('SELECT id, roles FROM users WHERE email = $1', [ADMIN_EMAIL]);

  if (rows.length > 0) {
    const user = rows[0];
    const roles = user.roles ? user.roles.split(',') : [];

    if (roles.includes('admin')) {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
      await client.end();
      return;
    }

    roles.push('admin');
    await client.query('UPDATE users SET roles = $1 WHERE id = $2', [roles.join(','), user.id]);
    console.log(`Admin role added to existing user: ${ADMIN_EMAIL}`);
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await client.query(
    `INSERT INTO users (id, email, password_hash, full_name, roles, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())`,
    [ADMIN_EMAIL, passwordHash, ADMIN_NAME, 'admin']
  );

  console.log(`Admin user created: ${ADMIN_EMAIL}`);
  await client.end();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
