const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL atau Key tidak ditemukan di environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAdminPassword() {
  try {
    const newPassword = 'admin123'; // Password baru untuk admin
    console.log(`🔐 Membuat hash untuk password: ${newPassword}`);
    
    // Hash password baru dengan salt rounds 12 (sama seperti di auth.ts)
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log('✅ Password berhasil di-hash');

    // Update password admin
    const { data: updatedUsers, error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword
      })
      .eq('role', 'ADMIN')
      .select('email, username');

    if (updateError) {
      console.error('❌ Error updating admin password:', updateError);
      return;
    }

    console.log('✅ Password admin berhasil direset:');
    updatedUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}, Username: ${user.username}`);
    });
    
    console.log(`🔑 Password baru: ${newPassword}`);
    console.log('📝 Silakan login dengan credentials tersebut');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

resetAdminPassword();