const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminLogin() {
  try {
    const email = 'admin@fenomena.com';
    const password = 'admin123';

    console.log('🔍 Testing login untuk admin...');
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 Password: ${password}`);

    // Ambil data user seperti di authenticateUser function
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        region:regions(*)
      `)
      .eq('email', email)
      .single();

    if (error || !user) {
      console.error('❌ User tidak ditemukan:', error);
      return;
    }

    console.log('✅ User ditemukan:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Username: ${user.username}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - isVerified: ${user.isVerified}`);
    console.log(`   - Region: ${user.regionId}`);

    // Test password verification
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`🔓 Password valid: ${isPasswordValid}`);

    if (!user.isVerified) {
      console.log('❌ User belum verified');
      return;
    }

    if (!isPasswordValid) {
      console.log('❌ Password tidak valid');
      return;
    }

    console.log('🎉 Login test berhasil! Admin dapat login dengan credentials tersebut.');

  } catch (error) {
    console.error('❌ Error during login test:', error);
  }
}

testAdminLogin();