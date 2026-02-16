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
   - 若不需要「邮箱链接登录」，可只启用「Email/Password」。
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

1. **获取 Web Client ID**  
   Firebase Console → Authentication → Sign-in method → Google → 复制「Web SDK 配置」里的 **Web client ID**。

2. **配置环境变量**  
   在项目根目录 `.env` 或 EAS 环境变量中设置：
   ```bash
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=你的_Google_Web_Client_ID
   ```

3. **配置重定向 URI（必做，且只能用 HTTPS）**  
   Google 的 **Web 应用** 客户端只接受 HTTPS 重定向 URI，**不能**填 `gatorguide://auth`（会报 “must end with a public top-level domain”）。应用在手机上已改为使用 **Expo Auth Proxy**，重定向 URI 为 HTTPS。  
   - 在手机上运行一次应用（开发模式），在 Metro/终端里会打印：`[Auth] Add this URL to Google Cloud → Authorized redirect URIs: https://...`  
   - [Google Cloud Console](https://console.cloud.google.com/) → 你的项目 → **APIs & Services** → **Credentials** → 打开 **Web client** → **Authorized redirect URIs**。  
   - 若之前误加了 `gatorguide://auth`，请**删掉**。  
   - 点击 **Add URI**，粘贴上面打印的 `https://...` 地址（形如 `https://auth.expo.io/@你的用户名/gator-guide`），保存。

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

## 四、可选增强（需要时再说）

若你后续需要，可以再补：

- **邮箱验证**：注册后发验证邮件（`sendEmailVerification`），并在某些操作前检查 `emailVerified`。
- **登录按钮 loading**：提交时显示转圈，防止重复点击。
- **密码重置链接跳回 App**：在 Firebase 模板里配置 Action URL 为你的 App 深链（需配合 `expo linking` 等）。
- **其他登录方式**：如 Apple 登录，需在 Firebase 启用对应 Sign-in method，并在应用内接 SDK。

---

## 五、总结：你「必须」提供的信息

- **不需要**再提供任何代码或密钥（Firebase 配置已在 `config.ts` / `.env` 中）。
- **需要**你在 Firebase 控制台完成：
  1. **Authentication → Sign-in method → Email/Password → Enable**。

完成上述一步后，注册、登录、忘记密码等即可全面可用。若你要做邮箱验证或自定义重置邮件，再按「三、可选增强」或控制台里的 Templates / Authorized domains 配置即可。
