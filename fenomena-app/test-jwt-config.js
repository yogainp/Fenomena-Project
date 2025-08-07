require('dotenv').config({ path: '.env.local' });
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';

console.log('🔧 Testing JWT Configuration...');
console.log(`🔑 JWT_SECRET loaded: ${JWT_SECRET !== 'your-fallback-secret' ? '✅ Custom secret' : '❌ Using fallback'}`);

// Test JWT token generation and verification
const testPayload = {
  userId: 'test-user-id',
  email: 'admin@fenomena.com',
  role: 'ADMIN',
  regionId: 'test-region'
};

try {
  // Generate token
  const token = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '24h' });
  console.log('✅ Token generated successfully');
  console.log(`📝 Token length: ${token.length} characters`);

  // Verify token
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ Token verified successfully');
  console.log('📊 Decoded payload:', {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    exp: new Date(decoded.exp * 1000).toISOString()
  });

  console.log('🎉 JWT configuration is working correctly!');

} catch (error) {
  console.error('❌ JWT Error:', error.message);
}