const supabase = require('./src/config/supabase');

async function clearLogs() {
  console.log('🚀 Starting log cleanup...');
  
  try {
    // 1. Clear Sessions (Paired entry/exits)
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .filter('id', 'gt', 0);
    
    if (sessionsError) throw sessionsError;
    console.log('✅ Sessions table cleared.');

    // 2. Clear Scans (Individual RFID events)
    const { error: scansError } = await supabase
      .from('scans')
      .delete()
      .filter('id', 'gt', 0);
    
    if (scansError) throw scansError;
    console.log('✅ Scans table cleared.');

    console.log('✨ All entry and exit logs have been cleared successfully.');
  } catch (err) {
    console.error('❌ Failed to clear logs:', err.message);
  } finally {
    process.exit();
  }
}

clearLogs();
