# Firebase 连接说明（Authentication + Firestore）

应用已接入 **Firebase Authentication** 与 **Firestore Database**。按下面步骤在控制台开通并核对配置即可使用。

## 1. 在 Firebase 控制台需要做的事

### Authentication（身份验证）
1. 打开 [Firebase Console](https://console.firebase.google.com/) → 选择你的项目（或新建项目）。
2. 左侧点击 **Authentication**。
3. 在「Sign-in method」里启用 **电子邮件/密码**（Email/Password），保存。

### Firestore Database（数据库）
1. 同一项目下，左侧点击 **Firestore Database**。
2. 点击「创建数据库」；可选「测试模式」先跑通，之后再改安全规则。
3. 选一个区域（如 `us-central1`）并确认。

## 2. 你需要提供/核对的配置

如果用的就是当前项目 **gatorguide**，且 `services/config.ts` 里已经填好了 `projectId: 'gatorguide'` 等，一般**不用再提供别的**，只要上面两步在控制台做完即可。

如果要用**你自己的 Firebase 项目**，请提供下面任一方式之一：

### 方式 A：直接改代码（`services/config.ts`）

把 `API_CONFIG.firebase` 换成你项目里的值：

- 打开 Firebase 控制台 → **项目设置**（齿轮）→ **你的应用**（或「添加应用」选 Web）。
- 复制 `apiKey`、`authDomain`、`projectId`、`storageBucket`、`messagingSenderId`、`appId` 填进 `config.ts` 的 `firebase` 对象。

### 方式 B：用环境变量（推荐，避免把密钥提交到 Git）

在项目根目录建 `.env`（不要提交到 Git），例如：

```env
# 使用真实 Firebase（默认已开启）
EXPO_PUBLIC_USE_STUB_DATA=false

# 若用自己项目，替换为你在 Firebase 控制台看到的配置
EXPO_PUBLIC_FIREBASE_API_KEY=你的apiKey
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=你的项目.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=你的项目ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=你的项目.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=数字
EXPO_PUBLIC_FIREBASE_APP_ID=1:数字:web:xxx
```

未设置的项会使用 `config.ts` 里的默认值（当前为 gatorguide 项目）。

## 3. Android / iOS 原生构建：配置文件

Expo 已配置为使用 Firebase 原生配置文件（`app.json` 中已指定路径），你只需从控制台下载并放到项目根目录（与 `app.json` 同级）：

| 平台   | 在 Firebase 控制台操作 | 下载后的文件名           | 放置位置 |
|--------|------------------------|--------------------------|----------|
| Android | 项目设置 → GatorGuide Android App → 下载 **google-services.json** | `google-services.json` | 项目根目录（Front-end 下） |
| iOS     | 项目设置 → GatorGuide iOS App → 下载 **GoogleService-Info.plist** | `GoogleService-Info.plist` | 项目根目录（Front-end 下） |

- **Android**：包名需为 `com.mobiledevelopment.gatorguide`（已与 `app.json` 一致）。若使用 Google 登录等，还需在控制台该应用下「添加指纹」填写 SHA-1/SHA-256。
- **iOS**：Bundle ID 需为 `com.mobiledevelopment.gatorguide`（已与 `app.json` 一致）。发布前可在控制台填写 App Store ID、团队 ID。

### 生成 iOS 工程（需 macOS）

- **Windows**：本机无法生成 `ios/` 目录。可用两种方式之一：
  1. **在 Mac 上生成**：把本项目拷到 Mac，在 `Front-end` 目录执行  
     `npm run prebuild:ios` 或 `npx expo prebuild --platform ios`，会生成 `ios/` 并自动带入 `GoogleService-Info.plist`。之后用 Xcode 打开 `ios/*.xcworkspace` 编译运行。
  2. **不占 Mac，用云端构建**：安装 [EAS CLI](https://docs.expo.dev/build/setup/) 后执行  
     `eas build --platform ios --profile preview`（或你的 profile），在 Expo 云端用 Mac 构建 IPA，无需本机有 Xcode。

- **macOS**：在 `Front-end` 目录执行 `npm run prebuild:ios` 或 `npx expo prebuild --platform ios`，再用 Xcode 打开 `ios/` 下的工程即可。

当前 `app.json` 已配置 `ios.bundleIdentifier: "com.mobiledevelopment.gatorguide"` 和 `ios.googleServicesFile: "./GoogleService-Info.plist"`，`GoogleService-Info.plist` 已放在项目根目录，在 Mac 上执行一次 prebuild 即可。

## 4. 如何确认已连上

- **Authentication**：在应用里注册/登录，Firebase Console → Authentication → Users 里应出现对应用户。
- **Firestore**：完成一次「个人资料」设置并提交，Console → Firestore → `users` 集合下应有对应用户文档。

## 5. 仅本地调试、不想连 Firebase 时

在 `.env` 里设置：

```env
EXPO_PUBLIC_USE_STUB_DATA=true
```

应用会使用本地模拟数据，不初始化 Firebase。
