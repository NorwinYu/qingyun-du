# 青云渡 · 部署说明

本项目是纯静态站点：`index.html` + `dist/game.js`，没有后端、没有环境变量，非常适合 GitHub Pages。

> 仓库名建议用 **`qingyun-du`**（英文名 *Qingyun Crossing*），不要再用 `xiuxian-game`。

## 1. 推送到 GitHub

在项目目录执行（把 `<你的用户名>` 换成实际账号）：

```bash
git init -b main
git add -A
git commit -m "feat: 青云渡 v1.0.0"
git remote add origin https://github.com/<你的用户名>/qingyun-du.git
git push -u origin main
```

如果仓库还没创建，先在 GitHub 上新建一个空的 `qingyun-du` 仓库，不要勾选 README / .gitignore / License，避免首推冲突。

## 2. 推荐方式：GitHub Actions 自动部署

仓库内已经包含 [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)。每次推送到 `main` 时，它会：

1. `npm ci` 安装依赖；
2. `npm test` 跑 30 项回归测试；
3. `npm run build` 重新构建 `dist/game.js`；
4. 只把 `index.html`、`favicon.svg`、`dist/` 和社交预览图打包为 Pages 站点；
5. 通过 `actions/deploy-pages` 发布。

### 首次启用

1. 打开仓库 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送一次代码，或在 **Actions** 页手动运行 `Deploy GitHub Pages`。
4. 等待绿色勾后访问：

```text
https://<你的用户名>.github.io/qingyun-du/
```

例如本项目的默认地址：<https://norwinyu.github.io/qingyun-du/>

### 权限

工作流已声明所需权限：

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

如果部署步骤报 `Resource not accessible by integration`，检查仓库 **Settings → Actions → General → Workflow permissions** 是否允许读写，并确认 Pages 的 Source 已切到 GitHub Actions。

## 3. 备选方式：从分支直接发布

仓库里已经提交了构建产物 `dist/game.js`，因此也可以完全不跑 Actions：

1. **Settings → Pages → Source** 选择 **Deploy from a branch**。
2. 分支选 `main`，目录选 **/(root)**。
3. 保存后等待发布。

这种方式首次部署最省事，但每次改源码都要在本地 `npm run build` 并提交新的 `dist/game.js`。两种方式不要同时启用，Pages 只会保留一种 Source。

## 4. 部署内容

```text
_site/
├── index.html
├── favicon.svg
├── dist/game.js
└── docs/screenshots/social.jpg   # Open Graph 预览图
```

`src/`、`tests/`、`node_modules/` 不会上传到站点。游戏没有使用绝对路径，因此放在 `/<仓库名>/` 子路径下也能正常工作。

## 5. 地址与文案

如果 GitHub 用户名不是 `NorwinYu`，需要同步替换以下位置：

| 位置 | 内容 |
| --- | --- |
| `README.md` | 顶部“在线试玩”徽章链接 |
| `docs/deployment.md` | 本文示例地址 |
| `package.json` | 如需发布 npm 包，`name` 已为 `qingyun-du` |

游戏内标题、菜单与存档键不依赖域名，无需修改。

## 6. 常见问题

### 打开是黑屏 / 一直“正在开辟山河”

- 确认浏览器支持 **WebGL2**（Chrome / Edge / Safari 新版本）。
- 打开开发者工具 Console，看是否有 `dist/game.js` 404。
- 如果用了分支发布，确认 `dist/game.js` 已经提交。
- 首次加载需要下载约 1.3 MB 的脚本，网络慢时请等待。

### 页面 404

- 确认 Pages 的 Source 与分支设置正确。
- 项目站点地址一定带仓库名：`https://<用户名>.github.io/qingyun-du/`，不是根域名。
- Actions 部署失败时，旧版本可能仍在线上；到 Actions 页看失败日志。

### 更新后还是旧版本

浏览器会缓存 `dist/game.js`。强制刷新（macOS `Cmd + Shift + R`）或在链接后加 `?v=2` 验证。如果长期需要，可在构建产物名中加入哈希。

### 存档不见了

`localStorage` 按“协议 + 域名 + 端口”隔离：

- `http://localhost:8123` 的存档不会出现在 `https://norwinyu.github.io`；
- 从 `http://` 换到 `https://`、或换端口，也会读不到旧档。

这是浏览器安全策略，不是游戏 bug。正式游玩建议固定使用 Pages 地址。

### 能不能用自己的域名

可以。在 **Settings → Pages → Custom domain** 填写域名并配置 CNAME；随后在仓库根目录添加 `CNAME` 文件（或在 Pages 设置中自动生成）。游戏本身不需要改动。

## 7. 本地验证部署产物

部署前可以本地模拟“只有静态文件”的环境：

```bash
npm run build
mkdir -p /tmp/qingyun-site
cp index.html favicon.svg /tmp/qingyun-site/
cp -r dist /tmp/qingyun-site/
cd /tmp/qingyun-site && python3 -m http.server 8080
```

打开 <http://127.0.0.1:8080/>，确认没有依赖仓库里的其他文件。
