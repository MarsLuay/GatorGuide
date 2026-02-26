# Authentication 配置说明（注册 / 登录 / 忘记密码）

当前应用已实现**注册、登录、忘记密码、登出、删除账号、游客**等完整流程，并已对接 Firebase Authentication。你只需要在 Firebase 控制台完成下面配置即可使用。

---

## 一、你需要提供 / 在 Firebase 控制台完成的事项

### 1. 启用「电子邮件/密码」登录方式（必做）

1. 打开 [Firebase Console](https://console.firebase.google.com/) → 选择项目 **GatorGuide**（或你的项目）。
2. 左侧点击 **Authentication**。
3. 打开 **Sign-in method** 标签。
4. 找到 **Email/Password**，点击进入。
5. 开启 **Enable**（启用），
   - **Email/Password** 勾选启用（用于注册 + 登录）；
   - **Email link (passwordless sign-in)** 勾选启用（用于无密码邮件链接登录，可选）。
6. 保存。

完成后，应用内的**注册**（createUserWithEmailAndPassword）和**登录**（signInWithEmailAndPassword）即可正常使用。

### 2. 忘记密码邮件（可选定制）

- 默认：Firebase 会使用系统模板发送密码重置邮件，**无需你提供内容**即可使用。
- 若要自定义邮件内容、发件人名称等：
  1. Authentication → **Templates**。
  2. 选择 **Password reset**，可修改：
     - 发件人名称（Sender name）
     - 邮件主题（Subject）
     - 邮件正文（Body，可包含 `%LINK%` 等变量）
     - 可选：自定义操作链接（Action URL），例如指向你的网站或 App 深链。

不修改也可以，用默认模板即可。

### 3. 授权域名（若做 Web 版或自定义链接）

- 若只做 **Android / iOS 原生**：一般不需要额外配置授权域名。
- 若做 **Web** 或使用**自定义密码重置链接**：
  1. Authentication → **Settings** → **Authorized domains**。
  2. 确保你的 Web 域名或自定义链接域名在列表中；本地调试可保留 `localhost`。

---

## 二、当前已实现的功能（无需你再提供逻辑）

| 功能           | 说明 |
|----------------|------|
| **注册**       | 邮箱 + 密码（≥6 位）+ 姓名，写入 Firebase Auth，姓名写入 displayName；可选合并游客数据。 |
| **登录**       | 邮箱 + 密码，成功后拉取 Firestore 用户资料并跳转首页/资料页。 |
| **忘记密码**   | 输入邮箱，调用 `sendPasswordResetEmail`，成功后提示「去邮箱查收」。 |
| **登出**       | 调用 Firebase signOut，并清空本地状态与 AsyncStorage。 |
| **删除账号**   | 删除 Firestore/Storage 该用户全部数据后，再删除 Firebase Auth 账号。 |
| **游客**       | 本地游客身份，无 Firebase 账号。 |
| **错误提示**   | 对 `auth/invalid-email`、`user-not-found`、`wrong-password`、`email-already-in-use`、`weak-password`、`too-many-requests` 等做了友好提示。 |

前端页面与多语言 key（中/英等）已接好，只要 Firebase 按上面开通即可。

---

## 三、手机端 Google / Microsoft 登录（OAuth）

应用在 **Web** 上使用弹窗登录；在 **iOS/Android** 上通过浏览器 OAuth 重定向回 App 完成登录。

### 前置条件

- 使用 **Development Build** 或正式包（不能用 Expo Go，否则无法处理 `gatorguide://auth` 回跳）。
- 在 Firebase 控制台已启用 **Google** 和/或 **Microsoft** 登录方式。

### Google（手机端）

**重要**：Expo Go 不支持 Google 登录。必须使用**开发构建**（`npx expo run:ios` 或 `npx expo run:android`）。

1. **获取 Web Client ID**  
   Firebase Console → Authentication → Sign-in method → Google → 复制「Web SDK 配置」里的 **Web client ID**。

2. **配置环境变量**  
   ```bash
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=你的_Google_Web_Client_ID
   ```

3. **运行开发构建**  
   ```bash
   npx expo prebuild --clean
   npx expo run:ios
   ```
   或 Android：`npx expo run:android`

4. **Android：添加 SHA-1**  
   在 Firebase Console 的 Android 应用设置中添加 debug/release 的 SHA-1 指纹。

### Microsoft（手机端）

1. **Azure 应用注册**  
   [Azure Portal](https://portal.azure.com/) → Azure Active Directory → App registrations → New registration → 记下 **Application (client) ID**。

2. **配置环境变量**  
   ```bash
   EXPO_PUBLIC_MICROSOFT_CLIENT_ID=你的_Azure_Application_Client_ID
   ```

3. **重定向 URI**  
   在应用注册 → Authentication → **Redirect URIs** 中添加：
   - `gatorguide://auth`  
   或你的实际 scheme（需与 `app.json` 中 `expo.scheme` 一致）。

### 说明

- 未设置上述环境变量时，在手机端点击 Google/Microsoft 会提示「未配置」。
- Web 端仍使用弹窗登录，无需这些配置。
- 若 OAuth 后无法回到 App，请确认使用 Development Build 且 scheme / 重定向 URI 与 Google/Azure 中配置一致。

---

## 四、邮件链接登录（无密码）

应用已支持**通过邮件链接登录**（Firebase Email Link Auth）：用户输入邮箱后点击「通过邮件链接登录」，收到邮件后点击链接即可登录，无需密码。

### 前置条件

1. Firebase Console → Authentication → Sign-in method → 启用 **Email link (passwordless sign-in)**。
2. 授权域名：确保 `gatorguide.firebaseapp.com` 在 Authorized domains 中（默认已有）。
3. **Android**：已配置 intent filter 捕获 `https://gatorguide.firebaseapp.com/__/auth/links`。
4. **iOS**：已配置 Associated Domains `applinks:gatorguide.firebaseapp.com`（需重新 prebuild）。

### 使用说明

- 同一设备：发送链接后，用户在同一设备上点击链接即可自动完成登录。
- 不同设备：用户在不同设备上点击链接时，会跳转到登录页，输入邮箱后点击「完成登录」即可。

### 点击链接后显示「The operation is not valid」的排查

若点击邮件中的登录链接后，在浏览器中看到 **"The operation is not valid"**，请按以下顺序检查：

1. **重新发送链接（优先尝试）**  
   Firebase 邮件链接为**一次性**且通常 **1 小时内有效**。若已点击过或超时，原链接会失效。
   - 回到应用登录页 → 输入邮箱 → 点击「通过邮件链接登录」
   - 查收新邮件（含垃圾邮件文件夹）→ **尽快**点击新链接（建议 30 分钟内）

2. **API 密钥配置（最常见根因）**  
   Firebase 邮件链接会在浏览器中调用 `identitytoolkit` API，若 API 密钥配置不当会显示此错误。
   - 打开 [Google Cloud Console](https://console.cloud.google.com/) → 选择项目 **gatorguide**
   - **APIs & Services** → **Credentials** → 找到 **Browser key (auto created by Firebase)**
   - **API 限制**：确保已勾选 **Identity Toolkit API**（若只勾选 Cloud Datastore 会报错）
   - **应用限制**：若设为「网站」，在 **Website restrictions** 中添加：
     - `https://gatorguide.firebaseapp.com/*`
     - `http://localhost:*`（本地调试时）
   - 保存后**等待 5–10 分钟**再重试

3. **清除缓存后重试**  
   浏览器可能缓存了错误响应。尝试：无痕/隐私模式打开链接，或清除该站点缓存。

4. **临时方案：改用邮箱+密码**  
   若邮件链接持续失败，可改用「注册」或「登录」：用邮箱+密码创建账号或登录，无需点击邮件链接。

---

## 五、可选增强（需要时再说）

若你后续需要，可以再补：

- **邮箱验证**：注册后发验证邮件（`sendEmailVerification`），并在某些操作前检查 `emailVerified`。（已实现）
- **登录按钮 loading**：提交时显示转圈，防止重复点击。
- **密码重置链接跳回 App**：在 Firebase 模板里配置 Action URL 为你的 App 深链（需配合 `expo linking` 等）。
- **其他登录方式**：如 Apple 登录，需在 Firebase 启用对应 Sign-in method，并在应用内接 SDK。

---

## 六、总结：你「必须」提供的信息

- **不需要**再提供任何代码或密钥（Firebase 配置已在 `config.ts` / `.env` 中）。
- **需要**你在 Firebase 控制台完成：
  1. **Authentication → Sign-in method → Email/Password → Enable**。

完成上述一步后，注册、登录、忘记密码等即可全面可用。若你要做邮箱验证或自定义重置邮件，再按「三、可选增强」或控制台里的 Templates / Authorized domains 配置即可。
