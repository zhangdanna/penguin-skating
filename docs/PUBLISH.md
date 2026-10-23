# 发布指南（H5 + 微信小游戏）

本文只保留发布所需的步骤、命令和常见故障。玩法与关卡设计见 [../game.md](../game.md)。

## 0. 命令总览

| 目的 | 命令 |
|---|---|
| 安装依赖（首次） | `npm install` |
| 浏览器本地预览 | `npm run preview`，或 `node local-preview/server.js` |
| 构建 H5 | `npm run build:h5` → `dist-h5/` |
| 构建微信小游戏 | `npm run build:weapp` → `dist-weapp/` |
| 上传微信小游戏 | `npm run upload -- 1.0.1 "版本说明"` |
| 构建并上传 | `npm run release -- 1.0.1 "版本说明"` |
| 生成预览二维码 | `npm run preview -- 1.0.0 "预览说明"` |
| 回归测试 | `node --experimental-vm-modules tools/regression/run.mjs .` |

> 不带版本号时，`release` / `upload` 会读取 `package.json` 的 `version`。

---

## 1. H5 发布

### 1.1 构建

```bash
npm run build:h5
```

产出 `dist-h5/`，包含：

- `index.html`
- `game.js` 与 `js/**`
- `audio/**`、`images/**`
- `local-preview/` 适配层
- `server.js`（后缀兜底服务器）

### 1.2 本地运行

```bash
cd dist-h5
node server.js
# 打开 http://localhost:8080
```

`PORT=3000 node server.js` 可改端口。

> 必须用这个 `server.js`，不要直接用 `python -m http.server` 或普通静态托管。
> 源码里的 `import './js/...'` 没有 `.js` 后缀，微信小游戏会自动补，浏览器原生 ESM 不会；纯静态服务器会大量 404。

### 1.3 部署

任选一种：

1. **WorkBuddy「发布为应用」**
   - 目录：`dist-h5/`
   - 启动命令：`node server.js`
   - 语言：`node`
   - 发布后会得到公网 HTTPS 链接，手机浏览器/微信内可直接打开。
2. **自有服务器 / 容器**
   - 上传 `dist-h5/`，用 `node server.js` 启动，前面挂 Nginx/HTTPS。
3. **静态托管平台**
   - 需要平台支持“无扩展名路径回退到 `.js`”，否则会 404；不满足时请使用方案 1 或 2。

### 1.4 H5 能力边界

浏览器里没有真实的微信运行时：

- 登录、云存档、好友排行榜不可用；
- 分享是模拟的；
- 广告位不可用；
- 音频、触摸、`localStorage` 由适配层模拟。

适合做玩法预览、内测和投放落地页；正式商业化 H5 需要补自有账号、排行榜和广告 SDK。

---

## 2. 微信小游戏发布

### 2.1 前置条件

1. `project.config.json` 里的 `appid` 换成你的正式小游戏 AppID。
2. 首次执行 `npm install`。
3. 在微信公众平台下载上传密钥，保存为项目根目录的 `private.wx.key`（已在 `.gitignore` 中）。
4. 在微信公众平台配置 **小程序代码上传 IP 白名单**，加入当前机器的公网出口 IP。

### 2.2 本地调试

1. 打开微信开发者工具 → 导入项目 → 选择项目根目录（含 `game.json` 的那一层）。
2. 项目类型必须选 **小游戏**，不能选小程序。
3. 点「编译」进入主菜单；点「预览」用手机扫码真机测试。

如果提示「未找到 app.json」，说明项目类型选成了小程序：删除项目引用（不要删文件）后重新导入为小游戏。

### 2.3 构建与上传

```bash
# 只构建
npm run build:weapp

# 上传已构建的 dist-weapp
npm run upload -- 1.0.1 "修复若干问题"

# 构建 + 上传一步完成
npm run release -- 1.0.1 "修复若干问题"
```

也可以把 `dist-weapp/` 直接导入微信开发者工具，用右上角「上传」手动发布。

### 2.4 上传后

1. 打开 <https://mp.weixin.qq.com> → 管理 → 版本管理。
2. 找到刚上传的开发版本 → 选为体验版 → 生成体验二维码。
3. 真机全流程回归后 → 提交审核。
4. 审核通过 → 发布（首次必须全量发布）。

### 2.5 常见错误

| 错误 | 原因 | 处理 |
|---|---|---|
| `errCode: -10008 invalid ip: x.x.x.x` | 当前出口 IP 不在上传白名单 | 微信公众平台 → 开发 → 开发管理 → 开发设置 → 小程序代码上传 → IP 白名单，加入该 IP |
| `未找到 app.json` | 导入时选了小程序 | 重新导入为「小游戏」 |
| `未找到上传密钥 private.wx.key` | 未下载上传密钥 | 微信公众平台生成并保存到项目根目录 |
| `EBUSY: resource busy or locked, rmdir 'dist-weapp'` | 目录被微信开发者工具/资源管理器占用 | 构建脚本会自动清空复用；仍失败时关闭占用程序 |
| 上传包过大 | 主包超过 4MB | 检查是否把 `docs/tools/local-preview` 打进包；使用 `npm run build:weapp` 而不是直接上传项目根 |

### 2.6 配置项

- `project.config.json`：AppID、编译类型、基础库版本、包体排除项。
- `js/config.js`：激励视频广告位；留空会隐藏所有广告入口。
- `images/share-image.png`：分享卡片 PNG（建议 5:4；可用 `tools/gen-share-image.py` 重新生成）。
- `audio/bgm.wav`：内置背景音乐；放入 `audio/bgm.mp3` 会自动优先使用。

---

## 3. 目录约定

```
penguin-skating-game/
├── game.js / game.json          # 小游戏入口与配置
├── project.config.json          # 微信开发者工具配置
├── js/                          # 游戏源码
├── open-data/                   # 好友排行榜开放数据域
├── audio/ images/               # 运行时资源
├── local-preview/               # 浏览器预览适配层（不打包）
├── tools/                       # 构建、上传、生成、回归脚本（不打包）
├── docs/PUBLISH.md              # 本文
├── game.md                      # 玩法与关卡说明
└── README.md                    # 项目入口
```

`docs/`、`tools/`、`local-preview/` 只在开发期使用，构建脚本和 `packOptions.ignore` 都会排除。

---

## 4. 发布前 30 秒检查

- [ ] `npm run build:weapp` 成功，包体 < 4MB
- [ ] `project.config.json` 的 `appid` 是正式号
- [ ] `private.wx.key` 存在且未入库
- [ ] 上传 IP 已加入白名单
- [ ] 真机走通：主菜单 → 关卡 → 暂停 → 结算 → 返回菜单
- [ ] 无 `模拟` / `待实现` / `TODO` 用户文案
- [ ] 隐私授权弹窗正常，拒绝后核心玩法仍可玩
- [ ] 分享不绑定奖励
