const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function backup() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(now.getTime() + jstOffset);
  const dateStr = jstDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = jstDate.toISOString().split('T')[1].slice(0, 5).replace(':', '-'); // HH-MM

  console.log(`Starting backup: ${dateStr} ${timeStr} JST`);

  try {
    // Fetch all data
    const { data: projects, error: pError } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true });
    if (pError) throw pError;

    const { data: tasks, error: tError } = await supabase
      .from('tasks')
      .select('*');
    if (tError) throw tError;

    const { data: members, error: mError } = await supabase
      .from('members')
      .select('*')
      .order('sort_order', { ascending: true });
    if (mError) throw mError;

    const backup = {
      timestamp: jstDate.toISOString(),
      projects: projects || [],
      tasks: tasks || [],
      members: members || [],
      stats: {
        projectCount: projects?.length || 0,
        taskCount: tasks?.length || 0,
        memberCount: members?.length || 0,
      }
    };

    // Save to file
    const backupDir = path.join(process.cwd(), 'backups');
    const filename = `backup-${dateStr}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`Backup saved: ${filename}`);
    console.log(`Stats: ${backup.stats.projectCount} projects, ${backup.stats.taskCount} tasks, ${backup.stats.memberCount} members`);

    // Keep only last 30 days of backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 30) {
      const toDelete = files.slice(30);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(backupDir, f));
        console.log(`Deleted old backup: ${f}`);
      });
    }

  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

backup();
