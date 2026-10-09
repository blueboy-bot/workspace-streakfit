# GitHub Pages 发布与测试

发布分支：`gh-pages`，目录：`/ (root)`。该分支仅包含当前构建的静态应用，不包含浏览器中的个人记录。

## 开启网站

在仓库 Settings → Pages → Build and deployment 中选择：

- Source：Deploy from a branch
- Branch：gh-pages
- Folder：/ (root)

保存后查看 Pages 显示的实际网址和部署状态。预期项目网址为 https://blueboy-bot.github.io/workspace-streakfit/，只有部署成功后才能使用；上传分支本身不等于网站已发布。如果私有仓库所用套餐不支持 Pages，需要支持 Pages 的套餐或其他托管平台；不要为部署擅自公开仓库。

## 安装与离线使用

先在线打开 HTTPS 网站一次，等浏览器完成应用缓存。支持的桌面/Android 浏览器可使用“安装应用”；iPhone 在 Safari 分享菜单选择“添加到主屏幕”。网页不强制出现安装提示。

首次未缓存前无法离线打开。应用页面、核心文字教学、记录与本地图标可离线使用；远程教学视频不预缓存，云同步和可靠锁屏提醒不在本次功能中。

每次发布都需要同步更新应用版本和 `sw.js` 中的缓存版本。新缓存安装成功后等待当前应用窗口关闭，重新打开后启用。新缓存下载失败时继续保留现有可用版本，不中断当前训练输入。

## 原有记录迁移

浏览器存储按网址分开。旧 HTML/预览站点的数据不会自动进入新的 HTTPS 网站。先在旧版数据追踪中导出完整 JSON，在新站点读取备份、查看预览并确认恢复。恢复前副本仅保存在当前浏览器，可用应用备份另行保存。不要把含训练记录或照片的个人 JSON 提交到 GitHub。

## 重建与验证

运行 `python scripts/build-pages.py` 生成静态站点；运行 `node scripts/verify-pwa.cjs` 在真实 Chromium 中测试手机/桌面、根目录/仓库子目录、备份恢复和离线重开。需要 Playwright 和 Chromium；本云环境已提供。

正式站点发布后，可通过 `STREAKFIT_URL=https://blueboy-bot.github.io/workspace-streakfit/ node scripts/verify-pwa.cjs` 复测实际 HTTPS 站点。这些测试的本地运行使用受信任的 localhost 环境，不等同于已经验证线上部署。
