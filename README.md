# STREAKFIT v0.39.1 账号入口修正版

面向初学者的规则驱动健身原型：图文计划、动作要点、逐组记录、学习与恢复。不以连续打卡、训练量或身体数字奖励用户。

本版加入安全答案一致性、同口径实际记录证据、每侧剂量、独立预览工作区、多页保存冲突检测、本机恢复副本和主动反馈。旧版本保留。真实邮件短信、真实手机、教练与真人验收仍未完成，不能宣称除视频外已全部就绪。

- Node >=22，无第三方运行依赖；`npm start` 默认3000端口，可用PORT覆盖。
- 静态部署须保留assets/modules与beta-tools.js；`python scripts/build-pages.py --output PATH`，英文加`--language en`。
- `python scripts/build-preview.py` 生成内嵌图解、字体与帮助工具的独立HTML。
- `npm test` 包含保留的原测试，当前并非全绿；原有fixture/helper未改。当前规则另有11项专项。检查报告披露全部通过、失败和未运行事项。
- 首次设置5屏，安全前置。数据和恢复副本仅本机、未加密；身体/照片默认关闭，体重趋势默认收起。照片/身体不参与训练推荐或XP。
- v0.39.0首次复制旧预览数据后独立保存，不改旧版；版本间之后不会自动合并。换设备或切版本前导出JSON。副本最多3份/工作区，清理网站数据会删除本机副本。
- `account-config.json enabled:true`、`registrationEnabled:false`、`phoneEnabled:false`。既有账号可登录与同步；发信服务配置前明确显示注册暂未开放，不向内测用户承诺验证码可送达。密码/凭据只在安全环境设置中配置。
- 视频和部分动作图仍待补，AI静态图不替代现场指导或医疗判断。后台/锁屏提醒无准时保证。

[本轮检查](docs/BETA-READINESS-V0390.md) · [执行验收清单](docs/BETA-ACCEPTANCE-V0390.md) · [旧测试逐项审计](docs/beta/legacy-test-audit.md) · [使用说明](使用说明.txt)

## 账号入口修正

恢复 v0.39.0 图文界面，新访客先选择注册、登录或游客体验；基础资料仅在选择游客/建立新账号计划后开始，保留五步设置。账号入口位于顶部。原网址为 https://blueboy-bot.github.io/workspace-streakfit/preview/supabase-connected/ 。

邮箱发信待项目所有者在 Supabase 填写 Gmail SMTP（smtp.gmail.com:465、完整邮箱、Google 应用专用密码、同一发信地址）。不要把密码提交到仓库或聊天。保存自定义 SMTP 后再更新确认/找回模板以包含 {{ .Token }}，检查真实送达并开放注册。原默认邮件服务不允许本项目修改模板，该限制已实测确认。
