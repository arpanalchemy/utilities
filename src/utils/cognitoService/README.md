# 🧩 CognitoService (NestJS + AWS Cognito Integration)

## 📘 Overview

This service provides a **complete authentication and user management layer** built over **AWS Cognito** for NestJS apps.
It supports both **User-level** and **Admin-level** operations — Sign-up, Login, MFA, Password reset, Token refresh, and User attribute management.

Copy this file to:

```
src/utils/cognitoService/cognito.service.ts
```

Then import wherever needed:

```ts
import { CognitoService } from 'src/utils/cognitoService/cognito.service';
```

---

## ⚙️ Setup

### 1️⃣ Install Dependencies

```bash
npm install @aws-sdk/client-cognito-identity-provider crypto
```

### 2️⃣ Add Environment Variables

Create `.env`:

```bash
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

AWS_COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
AWS_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx  # Optional
```

> 💡 If your Cognito App Client doesn’t use a secret, leave `AWS_COGNITO_CLIENT_SECRET` empty.

---

## 🧱 IAM Permissions

Ensure your IAM role or user has:

```json
{
  "Effect": "Allow",
  "Action": [
    "cognito-idp:*"
  ],
  "Resource": "*"
}
```

---

## 🧩 Using CognitoService in Your Code

### Import and Initialize

```ts
import { CognitoService } from 'src/utils/cognitoService/cognito.service';
const cognito = new CognitoService();
```

---

## 👤 User Operations

### 📝 1. Sign Up

```ts
await cognito.signUp('user@example.com', 'Pass@123');
```

* Registers a user and sends a verification code to their email.

---

### 📩 2. Confirm Sign-Up

```ts
await cognito.confirmSignUp('user@example.com', '123456');
```

* Confirms user using the 6-digit code sent by Cognito.

---

### 🔐 3. Login (Supports MFA)

```ts
const result = await cognito.adminLogin('user@example.com', 'Pass@123');
console.log(result);
```

* Returns `AuthenticationResult` with tokens if success.
* If MFA required, returns `{ challenge: "SOFTWARE_TOKEN_MFA", session }`.

---

### 🧾 4. Forgot Password

```ts
await cognito.forgotPassword('user@example.com');
```

* Sends reset code to user’s email.

---

### 🔁 5. Confirm Forgot Password

```ts
await cognito.confirmForgotPassword('user@example.com', '123456', 'NewPass@123');
```

* Confirms password reset with code.

---

### ♻️ 6. Refresh Token

```ts
await cognito.refreshToken('<REFRESH_TOKEN>');
```

* Refreshes expired tokens using the refresh token.

---

### ✏️ 7. Update User Attributes

```ts
await cognito.updateUserAttributes('user@example.com', { name: 'Viral Sachde' });
```

* Updates user profile fields like `name`, `phone_number`, etc.

---

### 👋 8. Logout (Global)

```ts
await cognito.globalSignOut('<ACCESS_TOKEN>');
```

* Logs user out from all devices.

---

## 👑 Admin Operations

### 🧑‍💼 1. Admin Create User

```ts
await cognito.adminCreateUser('employee@example.com', 'Temp@123', true);
```

* Creates user directly in pool, optionally verifies email.

---

### ✅ 2. Admin Confirm User

```ts
await cognito.adminConfirmSignUp('employee@example.com');
```

* Confirms pending user manually (no email code needed).

---

### 🔒 3. Set User Password

```ts
await cognito.setPassword('employee@example.com', 'Secure@123');
```

* Assigns permanent password for a user.

---

### 🧠 4. Get User Info

```ts
const data = await cognito.getUser('employee@example.com');
console.log(data);
```

* Retrieves full user attributes.

---

## 🔐 Multi-Factor Authentication (MFA)

### Step 1 — Setup MFA Secret

```ts
const secret = await cognito.setupMFA('<ACCESS_TOKEN>');
console.log(secret);
```

* Returns a `SecretCode` — use it to show a QR for Authenticator apps.

---

### Step 2 — Confirm MFA Setup

```ts
await cognito.confirmMFA('<ACCESS_TOKEN>', '<CODE_FROM_APP>');
```

* Verifies user’s authenticator code.

---

### Step 3 — Verify MFA During Login

If `adminLogin()` returns MFA challenge:

```ts
await cognito.verifyMFA('user@example.com', '<SESSION>', '<CODE_FROM_APP>');
```

* Confirms MFA and returns tokens.

---

## 🧩 MFA Types Supported

| Type             | Description                           | Setup                               |
| ---------------- | ------------------------------------- | ----------------------------------- |
| **TOTP**         | Authenticator app-based 6-digit codes | Preferred                           |
| **SMS MFA**      | OTP sent to phone                     | Requires verified phone             |
| **Adaptive MFA** | Risk-based                            | Enable in Cognito Advanced Security |

---

## 🧰 Example: End-to-End Flow (Signup → Verify → Login → MFA)

```ts
const cognito = new CognitoService();

// 1. User Sign Up
await cognito.signUp('user@example.com', 'Pass@123');

// 2. Confirm email manually using verification code
await cognito.confirmSignUp('user@example.com', '123456');

// 3. Login
const res = await cognito.adminLogin('user@example.com', 'Pass@123');

// 4. If MFA required
if (res.challenge) {
  await cognito.verifyMFA('user@example.com', res.session, '654321');
}
```

---

## 🧱 Environment Reference

| Variable                    | Description                          | Example                |
| --------------------------- | ------------------------------------ | ---------------------- |
| `AWS_REGION`                | AWS region of Cognito pool           | `ap-south-1`           |
| `AWS_ACCESS_KEY_ID`         | IAM access key                       | `AKIAxxxxxxxx`         |
| `AWS_SECRET_ACCESS_KEY`     | IAM secret key                       | `xxxxxxxxxxxxxxxxxxxx` |
| `AWS_COGNITO_USER_POOL_ID`  | Cognito user pool ID                 | `ap-south-1_ABC123`    |
| `AWS_COGNITO_CLIENT_ID`     | Cognito app client ID                | `1h2j3k4l5m6n7o8p9q`   |
| `AWS_COGNITO_CLIENT_SECRET` | Cognito app client secret (optional) | `xxxxxxxxxxxxxxxxxx`   |

---

## 🧠 Roles Overview

| Role      | Can Do                                                    | Cannot Do                           |
| --------- | --------------------------------------------------------- | ----------------------------------- |
| **User**  | Sign up, verify, login, logout, reset password, setup MFA | Cannot create or manage other users |
| **Admin** | Create, confirm, update, delete, and reset users          | —                                   |

---

## 🧩 Security Notes

* Never expose `CLIENT_SECRET` to the frontend.
* Always store tokens in **HTTP-only cookies** or secure storage.
* Use **TOTP MFA** over SMS to avoid SMS delivery issues.
* Monitor Cognito logs using **CloudWatch**.
* For enterprise: enable **Advanced Security + Triggers**.

---

## 🧪 Quick Test File

Create `test-cognito.ts`:

```ts
import 'dotenv/config';
import { CognitoService } from './src/utils/cognitoService/cognito.service';

(async () => {
  const cognito = new CognitoService();
  try {
    const signup = await cognito.signUp('test@example.com', 'Pass@123');
    console.log('✅ Signup:', signup);

    const login = await cognito.adminLogin('test@example.com', 'Pass@123');
    console.log('✅ Login:', login);
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
```

Run:

```bash
ts-node test-cognito.ts
```

---

## ✅ Production Checklist

* [x] IAM credentials configured
* [x] Cognito User Pool + App Client created
* [x] App Client secret disabled for public apps
* [x] MFA enabled (TOTP recommended)
* [x] `.env` configured
* [x] Service tested locally
* [x] CloudWatch logging enabled

---

**Now this service is fully production-ready, plug-and-play, and works across any NestJS project.**
