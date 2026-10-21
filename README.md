# STREAKFIT v0.39.0 内测候选版

面向初学者的规则驱动健身原型：图文计划、动作要点、逐组记录、学习与恢复。不以连续打卡、训练量或身体数字奖励用户。

本版加入安全答案一致性、同口径实际记录证据、每侧剂量、独立预览工作区、多页保存冲突检测、本机恢复副本和主动反馈。旧版本保留。账号同步/真实邮件短信、真实手机、教练与真人验收仍未完成，不能宣称除视频外已全部就绪。

- Node >=22，无第三方运行依赖；`npm start` 默认3000端口，可用PORT覆盖。
- 静态部署须保留assets/modules与beta-tools.js；`python scripts/build-pages.py --output PATH`，英文加`--language en`。
- `python scripts/build-preview.py` 生成内嵌图解、字体与帮助工具的独立HTML。
- `npm test` 包含保留的原测试，当前并非全绿；原有fixture/helper未改。当前规则另有11项专项。检查报告披露全部通过、失败和未运行事项。
- 首次设置5屏，安全前置。数据和恢复副本仅本机、未加密；身体/照片默认关闭，体重趋势默认收起。照片/身体不参与训练推荐或XP。
- v0.39.0首次复制旧预览数据后独立保存，不改旧版；版本间之后不会自动合并。换设备或切版本前导出JSON。副本最多3份/工作区，清理网站数据会删除本机副本。
- `account-config.json enabled:false`。数据库与账号代码已准备并本地验证，不能代替真实Supabase/OTP/RLS部署验证。密码/凭据只在安全环境设置中配置。
- 视频和部分动作图仍待补，AI静态图不替代现场指导或医疗判断。后台/锁屏提醒无准时保证。

[本轮检查](docs/BETA-READINESS-V0390.md) · [执行验收清单](docs/BETA-ACCEPTANCE-V0390.md) · [旧测试逐项审计](docs/beta/legacy-test-audit.md) · [使用说明](使用说明.txt)
