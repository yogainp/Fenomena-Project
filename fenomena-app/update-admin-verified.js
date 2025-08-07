const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL atau Key tidak ditemukan di environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAdminVerified() {
  try {
    console.log('🔍 Mencari user dengan role ADMIN...');
    
    // Cari semua user dengan role ADMIN
    const { data: adminUsers, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'ADMIN');

    if (fetchError) {
      console.error('❌ Error mengambil data admin:', fetchError);
      return;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.log('⚠️  Tidak ada user dengan role ADMIN ditemukan');
      return;
    }

    console.log(`📊 Ditemukan ${adminUsers.length} user admin:`);
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}, Username: ${user.username}, Verified: ${user.isVerified}`);
    });

    // Update semua admin menjadi verified
    const { data: updatedUsers, error: updateError } = await supabase
      .from('users')
      .update({
        isVerified: true,
        verifiedAt: new Date().toISOString()
      })
      .eq('role', 'ADMIN')
      .select('*');

    if (updateError) {
      console.error('❌ Error updating admin users:', updateError);
      return;
    }

    console.log('✅ Berhasil memperbarui status verifikasi admin:');
    updatedUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email} -> Verified: ${user.isVerified}`);
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

updateAdminVerified();