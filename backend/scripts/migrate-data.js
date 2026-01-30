/**
 * Data Migration Script: PostgreSQL (Supabase) to MySQL
 * 
 * This script exports data from your Supabase PostgreSQL database
 * and imports it into your cPanel MySQL database.
 * 
 * Usage:
 * 1. Set environment variables (see .env.example)
 * 2. Run: node scripts/migrate-data.js
 */

import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Supabase connection (source)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// MySQL connection config (target)
const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
};

// Migration order (respects foreign key dependencies)
const TABLES_ORDER = [
  'areas',
  'packages', 
  'routers',
  'expense_categories',
  'permissions',
  'customers',
  'mikrotik_users',
  'billing_records',
  'payments',
  'call_records',
  'reminder_logs',
  'transactions',
  'system_settings',
  'profiles',
  'user_roles',
  'activity_logs',
];

// Helper to format dates for MySQL
function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function formatDateOnly(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toISOString().slice(0, 10);
}

// Export data from Supabase
async function exportFromSupabase(tableName) {
  console.log(`📤 Exporting ${tableName}...`);
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) {
    // Try without ordering if created_at doesn't exist
    const { data: data2, error: error2 } = await supabase
      .from(tableName)
      .select('*');
    
    if (error2) {
      console.error(`  ❌ Error exporting ${tableName}:`, error2.message);
      return [];
    }
    return data2 || [];
  }
  
  console.log(`  ✅ Exported ${data?.length || 0} records`);
  return data || [];
}

// Transform data for MySQL compatibility
function transformRecord(tableName, record) {
  const transformed = { ...record };
  
  // Convert timestamps
  if (transformed.created_at) {
    transformed.created_at = formatDate(transformed.created_at);
  }
  if (transformed.updated_at) {
    transformed.updated_at = formatDate(transformed.updated_at);
  }
  if (transformed.sent_at) {
    transformed.sent_at = formatDate(transformed.sent_at);
  }
  if (transformed.call_date) {
    transformed.call_date = formatDate(transformed.call_date);
  }
  if (transformed.last_synced_at) {
    transformed.last_synced_at = formatDate(transformed.last_synced_at);
  }
  
  // Convert date-only fields
  if (transformed.expiry_date) {
    transformed.expiry_date = formatDateOnly(transformed.expiry_date);
  }
  if (transformed.billing_start_date) {
    transformed.billing_start_date = formatDateOnly(transformed.billing_start_date);
  }
  if (transformed.billing_date) {
    transformed.billing_date = formatDateOnly(transformed.billing_date);
  }
  if (transformed.due_date) {
    transformed.due_date = formatDateOnly(transformed.due_date);
  }
  if (transformed.paid_date) {
    transformed.paid_date = formatDateOnly(transformed.paid_date);
  }
  if (transformed.payment_date) {
    transformed.payment_date = formatDateOnly(transformed.payment_date);
  }
  if (transformed.transaction_date) {
    transformed.transaction_date = formatDateOnly(transformed.transaction_date);
  }
  
  // Convert JSONB to JSON string for MySQL
  if (transformed.value && typeof transformed.value === 'object') {
    transformed.value = JSON.stringify(transformed.value);
  }
  if (transformed.details && typeof transformed.details === 'object') {
    transformed.details = JSON.stringify(transformed.details);
  }
  
  // Handle boolean fields
  if (typeof transformed.is_active === 'boolean') {
    transformed.is_active = transformed.is_active ? 1 : 0;
  }
  if (typeof transformed.auto_renew === 'boolean') {
    transformed.auto_renew = transformed.auto_renew ? 1 : 0;
  }
  if (typeof transformed.allowed === 'boolean') {
    transformed.allowed = transformed.allowed ? 1 : 0;
  }
  
  return transformed;
}

// Import data to MySQL
async function importToMySQL(connection, tableName, records) {
  if (records.length === 0) {
    console.log(`  ⏭️  Skipping ${tableName} (no records)`);
    return;
  }
  
  console.log(`📥 Importing ${records.length} records to ${tableName}...`);
  
  // Get column names from first record
  const columns = Object.keys(records[0]);
  const placeholders = columns.map(() => '?').join(', ');
  
  let imported = 0;
  let errors = 0;
  
  for (const record of records) {
    const transformed = transformRecord(tableName, record);
    const values = columns.map(col => transformed[col] ?? null);
    
    try {
      await connection.execute(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
      imported++;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        // Skip duplicates
        console.log(`  ⚠️  Duplicate entry skipped: ${record.id}`);
      } else {
        console.error(`  ❌ Error inserting record:`, error.message);
        errors++;
      }
    }
  }
  
  console.log(`  ✅ Imported ${imported} records (${errors} errors)`);
}

// Main migration function
async function migrate() {
  console.log('🚀 Starting Data Migration: PostgreSQL → MySQL\n');
  console.log('='.repeat(50));
  
  // Validate environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  if (!process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
    console.error('❌ Missing MySQL credentials. Set DB_USER, DB_PASS, DB_NAME');
    process.exit(1);
  }
  
  let connection;
  
  try {
    // Connect to MySQL
    console.log('\n📡 Connecting to MySQL...');
    connection = await mysql.createConnection(mysqlConfig);
    console.log('✅ MySQL connected\n');
    
    // Disable foreign key checks during migration
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Migrate each table
    for (const tableName of TABLES_ORDER) {
      console.log(`\n${'─'.repeat(40)}`);
      
      // Export from Supabase
      const records = await exportFromSupabase(tableName);
      
      // Import to MySQL
      await importToMySQL(connection, tableName, records);
    }
    
    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Export-only mode (creates JSON files)
async function exportOnly() {
  console.log('📤 Export-only mode: Creating JSON backup files\n');
  
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const exportDir = './exports';
  await fs.mkdir(exportDir, { recursive: true });
  
  for (const tableName of TABLES_ORDER) {
    const records = await exportFromSupabase(tableName);
    const filePath = path.join(exportDir, `${tableName}.json`);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
    console.log(`  📄 Saved ${filePath}`);
  }
  
  console.log('\n✅ Export completed! Check the ./exports folder');
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--export-only')) {
  exportOnly();
} else {
  migrate();
}
