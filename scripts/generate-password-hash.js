#!/usr/bin/env node

/**
 * Generate bcrypt password hash for DeployDoctor admin
 * 
 * Usage: node scripts/generate-password-hash.js YourPassword
 */

import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/generate-password-hash.js YourPassword');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters long');
  process.exit(1);
}

(async () => {
  console.log('Generating password hash...\n');
  
  const hash = await bcrypt.hash(password, 12);
  
  console.log('Password hash generated successfully!\n');
  console.log('Add this to your .env file:');
  console.log('━'.repeat(60));
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('━'.repeat(60));
  console.log('\nIMPORTANT: Keep this hash secret and never commit it to git!');
})();
