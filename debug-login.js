const bcrypt = require('bcryptjs');

async function testPasswordHash() {
  const testPasswords = ['admin', 'password', '123456'];
  
  for (const pwd of testPasswords) {
    const hash = await bcrypt.hash(pwd, 12);
    console.log(`Password: ${pwd} -> Hash: ${hash}`);
    
    // Test verification
    const isValid = await bcrypt.compare(pwd, hash);
    console.log(`Verification test: ${isValid}`);
    console.log('---');
  }
}

testPasswordHash().catch(console.error);