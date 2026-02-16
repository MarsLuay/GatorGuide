# 在 Windows 上一键构建 iOS（无需 Mac）

已配置 **EAS Build**，用 Expo 云端 Mac 机帮你打 iOS 包，本机不需要 Xcode。

## 一步到位

**必须先进入前端项目目录**，再执行：

```bash
cd GatorGuideV2\Front-end
npm run eas:ios
```

或直接（在 Front-end 目录下）：

```bash
npx eas build --platform ios --profile preview
```

- **首次**：会提示用浏览器登录 Expo 账号（没有就 [expo.dev](https://expo.dev) 注册一个）。
- **登录后**：自动上传代码与 `GoogleService-Info.plist`，在云端生成 iOS 工程并打包，完成后给下载链接（或扫码安装）。

## 已为你做好的配置

| 项 | 说明 |
|----|------|
| `eas.json` | 已添加 `preview` 配置，iOS 使用你的 Bundle ID 和 Firebase 配置 |
| `GoogleService-Info.plist` | 已在项目根目录，构建时会自动打进 iOS 包 |
| `npm run eas:ios` | 等同于上面那条 `eas build` 命令 |

构建完成后，在 [expo.dev](https://expo.dev) 登录 → Your projects → 当前项目 → Builds 里可查看或下载 IPA。
