# STREAKFIT 产品与实现方案

定位：把运动、饮食、睡眠转成可完成的每日小任务，借鉴 Duolingo 的学习路径和即时反馈。
目标用户：想建立规律、每次可投入 15–30 分钟的健身初学者。

## V1 范围与验收

| 功能 | 正式 MVP 验收 | 当前原型 |
|---|---|---|
| Onboarding | 目标、经验、地点、器械、时间与频率生成可执行计划 | 保存目标、地点、时间、频率；仅固定入门课 |
| 今日任务 | 训练日/恢复日、营养、饮水、睡眠；跨日生成任务 | 手动选择恢复，浏览器每日记录 |
| Workout Logger | 动作、重量、次数、组数、休息，允许纠错 | 固定三个动作，各两组，支持撤回 |
| 动作教学 | 授权的短视频、关键提示、替代动作 | 文字提示；视频未接入 |
| XP / Streak | 服务端幂等记分，时区结算，可恢复记录 | 浏览器本地重算 XP；当天至少一项完成计连续 |
| 数据持久化 | 登录与跨设备同步 | localStorage，仅当前浏览器 |

首发不包含 AI 自动调节、食品数据库、体态识别、联赛、订阅或穿戴设备。
核心闭环：填写偏好 → 获得计划 → 查看今日任务 → 学习动作 → 记录完成 → 即时 XP → 次日继续。
关键指标：首次任务完成率、7 日留存、每周计划完成率；不以体重变化或长时使用为留存目标。

## 页面与交互

今日：欢迎语、真实连续天数、等级、主训练入口、四类任务、每日经验和周历。
路线：当前阶段、每周日程、训练/恢复节点；后续阶段清晰标注未开放。
训练：动作提示、教学、组记录与撤回、休息计时；完成回到今日。
课堂：动作搜索、短视频、提示与替代动作。
成长：个人习惯历史、力量趋势、成就；排行榜只比较行为。
设置：偏好、单位、时区、通知、数据导出/删除。

## 计划和激励规则

训练或恢复 30 XP；饮食两项 20；饮水 15；睡眠 15；四类全完成奖励 20，共 100。
同一日期同一任务只记一次；撤回后重算，不靠点击累计。每 100 XP 一个等级。
恢复与训练不叠加奖励。正式版连续打卡采用完成至少一项计划行为，提供柔性提醒和休息保护。
饮水和睡眠是可调整的个人目标，不是统一处方。疼痛时停止训练，持续疼痛或伤病咨询专业人士。
视频需要内容授权和教练审核；不使用未授权视频冒充自己的教程。

## 技术栈

当前：Node.js >=22 原生 HTTP 服务 + HTML/CSS/JavaScript；无依赖，验证产品流程。
正式版建议：Expo / React Native + TypeScript，Supabase Auth / PostgreSQL / Storage；视频 CDN。
先实现规则生成的训练模板，积累实际数据后再接入 AI。健康记录使用 RLS 隔离，明确同意、导出与删除。
密钥仅在服务端；原型没有账户、后端或 AI 调用。需要真实视频资源和审核后才满足正式 MVP。

## 数据结构

- profiles(user_id PK, timezone, goal, experience, location, equipment, days_per_week, minutes, created_at)
- exercises(id PK, name, cues, equipment, difficulty, video_url, license_reference)
- plans(id PK, user_id FK, version, start_date, status)
- plan_days(id PK, plan_id FK, local_date, kind training/recovery, duration)
- plan_exercises(id PK, plan_day_id FK, exercise_id FK, position, target_sets, target_reps)
- workout_sessions(id PK, user_id FK, plan_day_id FK, started_at, finished_at)
- workout_sets(id PK, session_id FK, exercise_id FK, set_index, reps, weight_kg, UNIQUE session/exercise/index)
- daily_logs(user_id FK, local_date, protein_done, vegetables_done, water_ml, sleep_minutes, recovery_done, PK user/date)
- xp_events(id PK, user_id FK, local_date, source, points, UNIQUE user/date/source)

数据库以用户时区确定任务日期；XP 更新在事务中进行，变更训练模板保留版本和历史。
正式版不把浏览器提供的 XP 当可信来源。视频和敏感健康数据分开授权。

## 发布路线

1. 用户试用交互原型，验证每日任务是否清楚、是否愿意次日回来。
2. 实现账户、RLS 与数据库；替换本地持久化，完成真实计划及组数/次数/重量记录。
3. 接入授权动作视频和教练审核；测试时区切换、断网恢复、撤回和重复提交。
4. 小规模测试留存与安全反馈，再决定 AI Coach 和 PRO 商业化。

订阅价格暂为待验证假设；不在原型中提供虚假购买或 AI 能力。

## 第二版实现进度

已实现完整基础问卷、按频率生成两周训练/恢复路线、器械模板选择、逐组重量次数与感受记录、实际历史驱动的 +1 次建议、训练容量与个人体重历史。手机底部导航已加入。原型仍使用浏览器本地存储，后续阶段未开放，视频教学尚无素材。
