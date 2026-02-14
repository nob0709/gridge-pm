/**
 * データ復元スクリプト
 *
 * 使い方:
 *   node scripts/restore.js backups/backup-2024-01-15.json
 *
 * 注意: 既存データを全て上書きします！
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  console.error('Set environment variables:');
  console.error('  export SUPABASE_URL="your-url"');
  console.error('  export SUPABASE_ANON_KEY="your-key"');
  process.exit(1);
}

const backupFile = process.argv[2];
if (!backupFile) {
  console.error('Usage: node scripts/restore.js <backup-file.json>');
  console.error('Example: node scripts/restore.js backups/backup-2024-01-15.json');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function restore() {
  console.log(`Reading backup from: ${backupFile}`);

  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  console.log(`Backup timestamp: ${data.timestamp}`);
  console.log(`Stats: ${data.stats.projectCount} projects, ${data.stats.taskCount} tasks, ${data.stats.memberCount} members`);
  console.log('');
  console.log('WARNING: This will overwrite all existing data!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // Delete existing data
    console.log('Deleting existing data...');
    await supabase.from('tasks').delete().neq('id', '');
    await supabase.from('projects').delete().neq('id', '');
    await supabase.from('members').delete().neq('id', '');

    // Restore projects
    if (data.projects.length > 0) {
      console.log(`Restoring ${data.projects.length} projects...`);
      const { error: pError } = await supabase.from('projects').insert(data.projects);
      if (pError) throw pError;
    }

    // Restore tasks
    if (data.tasks.length > 0) {
      console.log(`Restoring ${data.tasks.length} tasks...`);
      const { error: tError } = await supabase.from('tasks').insert(data.tasks);
      if (tError) throw tError;
    }

    // Restore members
    if (data.members.length > 0) {
      console.log(`Restoring ${data.members.length} members...`);
      const { error: mError } = await supabase.from('members').insert(data.members);
      if (mError) throw mError;
    }

    console.log('Restore completed successfully!');

  } catch (error) {
    console.error('Restore failed:', error);
    process.exit(1);
  }
}

restore();
