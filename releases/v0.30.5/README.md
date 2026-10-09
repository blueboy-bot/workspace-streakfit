# STREAKFIT v0.30.5

- 体重输入可选、不奖励XP，趋势默认收起，主动展开查看。
- GitHub Pages仓库子目录路径修正；应用页面、模块、文字教学与图标可在首次缓存成功后离线使用。
- 缓存更新等待当前窗口关闭；不完整更新不替代可用版本。

## 文件

[下载转发ZIP](STREAKFIT-v0.30.5.zip) · [HTML](STREAKFIT-v0.30.5.html) · [网站源文件ZIP](STREAKFIT-v0.30.5-website.zip)

打开文件后点击Raw或下载按钮。转发包解压后用浏览器打开HTML。PWA安装需要网站版的HTTPS地址，单文件HTML不提供PWA安装。

发布分支已准备为 gh-pages；[Pages设置](https://github.com/blueboy-bot/workspace-streakfit/settings/pages)选择 Deploy from a branch → gh-pages → / (root)。保存并等待GitHub报告部署成功。上传分支不代表网站已启用。

旧预览/HTML的个人记录不会随软件文件转发或跨网址自动迁移。请在旧版导出完整JSON，再到新网址预览并确认恢复。

76项相关功能测试通过，5组静态网站真实Chromium测试（手机/桌面、根目录/仓库子目录及缓存更新），以及2组npm服务器测试通过。实际HTTPS站点仍需开启Pages后复测。

详细步骤：[GitHub Pages与迁移说明](GITHUB-PAGES.md)。
