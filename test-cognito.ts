/**
 * test-cognito.ts
 * ----------------
 * Local test script to verify CognitoService functionality end-to-end.
 * Run: npx ts-node test-cognito.ts
 */

import 'dotenv/config';
import { CognitoService } from './src/utils/cognitoService/cognito.service';
import readline from 'readline';

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

// Mock SecretsService since this is an isolated utility test
class MockSecretsService {
  private secrets = {
    cognito: {
      user_pool_id: process.env.AWS_COGNITO_USER_POOL_ID!,
      client_id: process.env.AWS_COGNITO_CLIENT_ID!,
      client_secret: process.env.AWS_COGNITO_CLIENT_SECRET || '',
    },
  };

  async getSecret(service: string, key: string) {
    return this.secrets[service][key];
  }
}

async function main() {
  console.log('\n🚀 Starting CognitoService Test Suite...\n');

  const cognito = new CognitoService();
  (cognito as any).secretService = new MockSecretsService();

  const email = process.env.TEST_USER_EMAIL || 'kunal.rewatkar@alchemytech.ca';
  const password = process.env.TEST_USER_PASSWORD || 'Pass@1234';
  let accessToken = '';

  try {
    console.log(`📩 Signing up user: ${email}`);
    await cognito.signUp(email, password);
    console.log('✅ Sign-up initiated. Check your email for a verification code.');

    const code = await ask('Enter verification code from email: ');
    await cognito.confirmSignUp(email, code.trim());
    console.log('✅ Email confirmed.\n');

    console.log('🔑 Attempting login...');
    const loginRes = await cognito.adminLogin(email, password);
    if (loginRes.challenge) {
      console.log(`⚠️ MFA required (${loginRes.challenge})`);

      const mfaCode = await ask('Enter MFA code from your Authenticator app: ');
      const mfaRes = await cognito.verifyMFA(email, loginRes.session, mfaCode.trim());
      accessToken = mfaRes.AuthenticationResult?.AccessToken;
      console.log('✅ MFA verified, login successful.\n');
    } else {
      accessToken = loginRes.AccessToken || loginRes?.AuthenticationResult?.AccessToken;
      console.log('✅ Logged in successfully.\n');
    }

    console.log('📲 Setting up software MFA...');
    const mfaSetup = await cognito.setupMFA(accessToken);
    console.log('🔑 MFA Secret Key:', mfaSetup.SecretCode);
    console.log('⚠️ Scan this secret in your Authenticator app.');
    const setupCode = await ask('Enter verification code from Authenticator: ');
    await cognito.confirmMFA(accessToken, setupCode.trim());
    console.log('✅ MFA successfully configured.\n');

    console.log('🔁 Testing forgot password...');
    await cognito.forgotPassword(email);
    const resetCode = await ask('Enter password reset code from email: ');
    const newPass = await ask('Enter new password: ');
    await cognito.confirmForgotPassword(email, resetCode.trim(), newPass.trim());
    console.log('✅ Password reset successful.\n');

    console.log('🚪 Performing global sign-out...');
    await cognito.globalSignOut(accessToken);
    console.log('✅ User signed out globally.\n');

    console.log('🎉 All CognitoService tests completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Error during test flow:', error.message || error);
  } finally {
    rl.close();
  }
}

main();
