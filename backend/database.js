const knex = require('knex');

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './nudge.db',
  },
  useNullAsDefault: true,
});

async function initDb() {
  if (!(await db.schema.hasTable('users'))) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('username').unique().notNullable();
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('connections'))) {
    await db.schema.createTable('connections', (table) => {
      table.increments('id').primary();
      table.string('user1').notNullable(); // requester
      table.string('user2').notNullable(); // requested
      table.string('status').defaultTo('pending'); // pending, accepted
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('reminders'))) {
    await db.schema.createTable('reminders', (table) => {
      table.increments('id').primary();
      table.string('text').notNullable();
      table.string('createdBy').notNullable();
      table.string('assignedTo').notNullable();
      table.string('time').notNullable();
      table.string('status').defaultTo('pending'); // pending, done, ignored
      table.boolean('seen').defaultTo(false);
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('subscriptions'))) {
    await db.schema.createTable('subscriptions', (table) => {
      table.increments('id').primary();
      table.string('username').notNullable();
      table.text('subscription').notNullable(); // JSON string
    });
  }
}

module.exports = { db, initDb };
