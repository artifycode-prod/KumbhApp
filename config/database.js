const { Pool } = require('pg');

let pool = null;

const connectDB = async (retryCount = 0) => {
  const maxRetries = 3;
  const retryDelay = 5000;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

  if (!connectionString) {
    console.warn('⚠️ DATABASE_URL or POSTGRES_URI not set - database features will not work');
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      console.error('❌ Production requires database connection. Exiting...');
      process.exit(1);
    }
    return null;
  }

  try {
    console.log(`Attempting to connect to PostgreSQL... (Attempt ${retryCount + 1}/${maxRetries + 1})`);
    const safeUrl = connectionString.replace(/:[^:@]+@/, ':****@');
    console.log(`Connection string: ${safeUrl}`);

    const useSSL = connectionString.includes('neon.tech') || connectionString.includes('supabase') || connectionString.includes('sslmode=require');
    pool = new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: connectionString.includes('neon.tech') } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    console.log('✅ PostgreSQL Connected successfully');

    pool.on('error', (err) => {
      console.error('❌ PostgreSQL pool error:', err.message);
    });

    return pool;
  } catch (error) {
    if (retryCount < maxRetries && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
      console.error(`❌ Connection attempt ${retryCount + 1} failed:`, error.message);
      console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return connectDB(retryCount + 1);
    }

    console.error('❌ PostgreSQL connection error:', error.message);
    console.error('\n💡 Please check:');
    console.error('   1. DATABASE_URL or POSTGRES_URI in .env is correct');
    console.error('   2. Database is accessible (Neon: check project is active)');
    console.error('   3. Run schema.sql to create tables: psql $DATABASE_URL -f db/schema.sql');

    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      console.error('\n❌ Production requires database connection. Exiting...');
      process.exit(1);
    } else {
      console.warn('\n⚠️ Server will continue but database features will not work.');
    }
    return null;
  }
};

const getPool = () => pool;

const query = async (text, params) => {
  if (!pool) {
    const p = await connectDB();
    if (!p) throw new Error('Database not connected');
  }
  return pool.query(text, params);
};

const isConnected = () => {
  return pool !== null;
};

module.exports = connectDB;
module.exports.getPool = getPool;
module.exports.query = query;
module.exports.isConnected = isConnected;
