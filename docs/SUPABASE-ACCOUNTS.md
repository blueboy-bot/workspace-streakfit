# STREAKFIT 账号接入 · v0.31.0 待发布

正式网站仍是 v0.30.5。本版账号数据库、Auth Hook 和 Edge 注册函数已部署到用户确认的新 Supabase 项目；邮件 SMTP 和短信供应商尚未配置，真实收码和跨设备登录尚未验证。`account-config.json` 中 `enabled:false` 是发布保护，不能仅把它改为 true 就声称注册可用。

## 项目与权限

项目地址：`https://pqnkhbtbjukxlqpcwynv.supabase.co`。前端只放 Publishable key；不放 service_role、secret key 或数据库密码。提供的公开 key 已加入 `account-config.json`。项目名称 Streakfit，状态 ACTIVE_HEALTHY；公开 key 从新项目管理接口读取并确认类型为 publishable。管理令牌已通过 API 验证，无需重复提供。

后续如需在新环境部署，在 [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens) 创建管理令牌，把值填写到 Codex 环境设置中声明的 `SUPABASE_ACCESS_TOKEN`，保存并发布环境配置。不要发到聊天或提交到 GitHub。这个令牌用于部署数据库、函数及 Auth 配置；它不是网页配置。

当前已保存但尚未应用的新项目网络草稿要求：`api.supabase.com`、`pqnkhbtbjukxlqpcwynv.supabase.co`，以及原有 GitHub Pages/GitHub API 目标。保存草稿不代表运行环境已经获得这些访问权限。

## Supabase 设置步骤

步骤1–4及网站URL、6位OTP和禁止自动确认已完成。下一步处理步骤6–7；邮件SMTP配置后才能修改免费项目的邮件验证码模板。Phone保持关闭，配置供应商后再启用，避免向用户展示不可用的短信注册。

1. 在项目 **SQL Editor** 执行 [数据库迁移](../supabase/migrations/202610090001_accounts.sql)。它建立私有注册凭据、每账号数据表、读取 RLS 和带版本校验的写入函数。迁移可重复执行。
2. 在 **Authentication → Hooks → Before User Created** 选择 Postgres 函数 `public.streakfit_before_user_created` 并启用。函数地址为 `pg-functions://postgres/public/streakfit_before_user_created`。**必须启用 Hook**，否则有人可直接调用 Supabase 注册 API 绕过“三个相同数字”的附加限制。项目不使用其他注册入口。
3. 在 Auth 密码设置中，把最短长度设为 **11**，要求大写、小写、数字和符号。前端及 Edge Function 同时验证规则；密码最多72 UTF-8字节，符合提供方 bcrypt 限制。`111`、`2222` 禁止，`123` 允许。
4. 部署 `supabase/functions/streakfit-account/index.ts`。官方 CLI 命令：`supabase functions deploy streakfit-account --project-ref pqnkhbtbjukxlqpcwynv --use-api`，从仓库根目录执行。`supabase/config.toml` 关闭平台 JWT 门禁，以允许尚未登录的用户注册；修改密码请求由函数自己向 Auth 验证用户 token。函数只在服务器使用 Supabase 提供的 `SUPABASE_ANON_KEY` 与 `SUPABASE_SERVICE_ROLE_KEY`，不能拷贝到网页。函数默认允许网站来源 `https://blueboy-bot.github.io`，可通过服务器变量 `STREAKFIT_ALLOWED_ORIGINS` 扩展，用逗号分隔。
5. 开启 **Email** 和 **Phone** 注册，并开启邮箱与手机验证，关闭两者的自动确认。手机号采用国际格式，例如 `+1…`、`+86…`。
6. 在 **Authentication → Email / SMTP Settings** 接入自己的邮件供应商。Supabase 默认发信仅适合受限测试，不能据此认为所有顾客都能收到邮件。在 Confirm signup 与 Reset password 模板中显示 `{{ .Token }}`，提供 **6位数字验证码**。界面使用验证码而非邮件跳转链接。
7. 在 **Authentication → Phone / SMS Provider** 接入 Supabase 支持的短信供应商，填写供应商凭据和发送号码/服务ID。发送地区、号码资格和短信费用由供应商账户决定。网页不得包含供应商凭据。OTP长度需为 **6位**。
8. Auth 网站 URL 设置为 `https://blueboy-bot.github.io/workspace-streakfit/`。完成上面设置后再把前端 `enabled` 改为 true，构建并发布 GitHub Pages。前端和数据库后端分别部署。

邮箱 SMTP、短信供应商、域名验证及发送号码需要用户在供应商账户中配置。没有配置时不能发送真实验证码，本版没有伪造收码成功。

## 已实现行为

- 邮箱/手机与用户自选密码注册；验证码验证、重发、登录、找回与修改密码。
- 注册密码在服务器检查；一次性注册凭据配合 Before User Created Hook 阻止直接注册绕过检查。密码修改走服务器检查入口；Supabase原始修改密码API只能执行提供方自带规则，没有自定义重复数字检查，因此不能声称此限制覆盖所有第三方直接API操作。
- 数据用 Supabase UUID 隔离，浏览器访客仍用 `streakfit-v1`，账号用 `streakfit-v1:<UUID>`。首次登录明确选择导入访客记录或建立新的计划。访客原始记录保留。
- 资料、计划、训练组、学习、XP及身体感受同步；可选进度照仅留本机，JSON完整备份含照片。
- 成功写入本机后才排队上传；网络失败显示待同步。全记录文档使用递增版本作原子校验；同时修改会提示选择，覆盖前存本机副本。JSONB键顺序变化不会构成冲突。
- 退出账号不删除未上传记录；再次登录同一账号可同步。切换账号重置当天视图、计时和弹窗；浏览器标签页之间变更账号会重新载入自己的空间。
- Auth token单独保存，训练 JSON/CSV 与云文档不包含密码或token。RLS不允许直接修改表，只允许本人读取和受控RPC写入。

## 验证与发布门槛

当前通过：全量Node测试191项（含账号规则/接口契约/同步与18,144配置训练矩阵）；本地 PostgreSQL WASM 引擎运行真实 SQL，验证 RLS、验证状态、Hook凭据及版本冲突；真实 Chromium 手机点击测试，提供方响应使用模拟；原有PWA安装外壳、离线、备份恢复及更新等待流程。

真实部署已验证：数据库迁移执行成功；注册函数 ACTIVE v1；Hook及密码策略管理接口回读一致；真实PostgreSQL通过15项事务检查，覆盖RLS、验证状态、版本冲突、注册凭据与Hook权限。临时数据全部回滚，最终用户、云文档和注册凭据均为0。检查SQL见 `scripts/verify-accounts-remote.sql`；管理数据库角色不能切换为 `supabase_auth_admin`，因此Hook权限通过目录查询验证，Hook逻辑由事务测试验证。

尚未验证：公开项目域名上的真实Auth/Edge调用、邮件与短信送达、实际账号跨设备登录同步。新项目域名需要在环境设置保存并发布后才能从当前云环境访问。数据库事务测试和模拟HTTP不能替代端到端发码测试。

发布前需使用用户指定的真实邮箱、手机完成两种注册与找回，并实际核对两个账号不能读写对方记录、云端同步与离线冲突。验证前保留 `enabled:false`，正式网站不展示可用注册的假象。

开发验证命令：

```sh
node --test test/accounts.test.mjs test/app.test.mjs test/onboarding-wizard.test.mjs test/persistence-integrity.test.mjs test/foundation.test.mjs
python scripts/build-pages.py --output /workspace/streakfit-preview/accounts-preview
node scripts/verify-accounts-browser.cjs
STREAKFIT_DIST=/workspace/streakfit-preview/accounts-preview node scripts/verify-pwa.cjs
```

SQL检查使用独立的开发辅助依赖，避免修改应用依赖或锁文件：

```sh
npm install --cache /workspace/streakfit-preview/npm-cache --prefix /workspace/streakfit-preview/account-test-tools @electric-sql/pglite --no-audit --no-fund
PGLITE_MODULE_PATH=/workspace/streakfit-preview/account-test-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-accounts-sql.mjs
```

SQL检查中的 `auth.users`、`auth.uid()` 和角色是 Supabase 环境的测试替身；运行的是 PostgreSQL引擎，不是在线Supabase服务。本次真实部署使用Supabase官方Management API，multipart上传方式与官方CLI实现一致；CLI当前版本在只读HOME下无法创建配置目录，因此未使用它部署。管理令牌仅通过环境注入，未写入代码或证据。

用户尚无发码服务或域名，北美/中国大陆覆盖的建议与配置步骤见 [验证码服务配置](VERIFICATION-PROVIDERS.md)。
