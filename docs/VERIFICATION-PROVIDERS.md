# 验证码服务配置进度

用户已确认：暂时没有邮件、短信服务账户；没有自有域名；手机号需覆盖加拿大/美国和中国大陆。

## 邮件：Resend SMTP

1. 注册 https://resend.com ，准备自己控制的发信域名。GitHub Pages的 `blueboy-bot.github.io` 不属于用户可管理DNS的域名，不能用于验证发信所有权。
2. 在Resend添加域名，按供应商页面给出的DNS记录完成验证。网站可以继续使用GitHub Pages，不必迁移。
3. 创建发送邮件用的API key，仅填到Supabase SMTP的密码字段，不发在聊天、不放网页或GitHub。
4. 在 https://supabase.com/dashboard/project/pqnkhbtbjukxlqpcwynv/auth/smtp 配置SMTP。优先使用Resend当前控制台显示的参数；常用参数：Host `smtp.resend.com`、Port `465`、Username `resend`、Password为发送API key。From使用已经验证的自有域名邮箱，Sender name为 `STREAKFIT`。
5. 保存后，修改注册确认及重置密码模板，显示 `{{ .Token }}`。服务器OTP已设置6位。当前免费默认发信服务不允许改模板；不能把默认服务当成顾客邮件服务。
6. 用户指定实际测试邮箱后，验证注册、重发、错误/过期验证码、找回、登录及同步；不要未经授权给任意地址发测试邮件。

Supabase官方说明：https://supabase.com/docs/guides/auth/auth-smtp 。Supabase默认邮件只允许向组织成员发信，正式顾客需自定义SMTP。Resend官方接入说明：https://resend.com/docs/send-with-supabase-smtp 。供应商价格和配额以其页面为准。

## 短信：按国家验证

- 北美建议先评估Supabase原生支持的Twilio；申请账户后核对号码/服务、发信资格和费用，再配置Supabase Phone提供方。
- 对中国大陆 `+86`，付费前确认供应商是否允许该验证码用途、所需发信资质/模板及实际送达。尚未验证Twilio对该项目的发送资格，不能承诺一个配置覆盖所有地区。
- 如果采用腾讯云或阿里云大陆短信服务，需增加Supabase Send SMS Hook或受控服务器发送接口，当前版本没有这些适配。供应商审核通过后再开发并测试，不能把凭据写进客户端。
- Supabase项目当前Phone关闭，自动确认关闭、OTP为6位；供应商配置与测试通过后再开启。
- 国际手机号保留区号，分别验证 `+1` 和 `+86` 的注册、重发及找回。短信通常按发送计费，试用账户也可能只允许已验证的收件号码。

官方提供方说明：https://supabase.com/docs/guides/auth/phone-login 。验证两种渠道完成前，前端 `account-config.json` 的 `enabled` 保持 `false`，不发布可用注册入口。

## 云环境

管理API已可访问。新项目公开域名 `pqnkhbtbjukxlqpcwynv.supabase.co` 已加到环境草稿，需要在Codex环境设置保存并发布后才能从当前环境测试公开接口。后端部署记录在 `ACCOUNTS-DEPLOYMENT.json`，进度在 `ACCOUNTS-PROGRESS.md`。
