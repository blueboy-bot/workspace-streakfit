# 原有测试与当前规则差异逐项审计

原有测试、fixture和helper均保留，没有修改定义或通过门槛。原测试仍失败；下面不是“自动通过”或跳过列表。当前规则另有可失败的专项与浏览器检查。

- `all previously illustrated movements have an audit outcome and unapproved leg curl is visibly withheld`：旧断言要求legcurl等保持占位，v0.38.12已按审核接入新图；原审核记录保留。
- `cardio stays stable without completion evidence and deloads within budget`：旧断言要求日期推进触发轻重切换或减量；现日历只显示排期，不自动改变难度。
- `first-time questions put personal measurements after training preferences`：旧设置次序包含已删除的年龄/体重等问题；现已是安全在前的5屏。
- `fourth calendar week deloads targets and custom values remain priority`：旧断言要求日期推进触发轻重切换或减量；现日历只显示排期，不自动改变难度。
- `future day opens its own cycle and does not create completion history`：旧断言要求第4周deload=true且进入后立即存在记录按钮；两项均为已撤销的行为。
- `future edits stay local to that date and survive reload`：前面的日期隔离、替换、刷新断言通过；最后要求其他日期因第4周自动变2组，与现规则冲突。
- `future recovery day explains light activity instead of exposing ineffective specialty controls`：旧断言要求立即存在添加控件；现先显示图文总览，点明确编辑入口后可添加。
- `normal readiness reduces sets and obvious fatigue proposes recovery without credit`：旧断言要求逐动作统一减一组；现先省略重复辅助，再按时间与实际记录调整。
- `progression uses actual prior sets and requires every set to be easy`：旧断言要求预填次数从8自动变9；现规则只提示可尝试，不自动加难。新专项验证实际值沿用、同负重稳定组证据。
- `route displays all 28 days and a deload phase`：旧28日同时展示及日历减量标签；现4周切换、每周7日，不以日期自动加量。
- `same upper-body pattern rotates heavy volume and light exposures`：旧断言要求日期推进触发轻重切换或减量；现日历只显示排期，不自动改变难度。
- `time experience equipment and deload preserve valid shoulder doses`：旧断言要求日期推进触发轻重切换或减量；现日历只显示排期，不自动改变难度。
- `today summary uses actual targets, restoration status and mobility units`：旧汇总文案已改成图文卡；本轮另外修正每侧目标与实际活动度剂量，并专项验证。

## 新增的11个安全fixture冲突

这些原测试以`state.safety={status:"ready"}`代替完整安全答案。新运行时要求两项明确为no；旧样本未提供答案，因此后续训练或负重断言被正确阻止。未改成默认安全放行。新增专项使用完整安全答案，验证实际预填、暂停、疼痛、额外组与XP、刷新保存。仍需后续维护者按正式需求审议旧测试，不应把本轮报告读成全套全绿。

- `a two-week gap clears old load suggestions without changing records or targets`
- `assistance machines require the actual assistance setting after a gap`
- `missing load remains unknown; recorded zero assistance remains explicit`
- `newly recorded actual values can be reused after restarting`
- `old pain continues to block starting; updated feedback does not auto-resume`
- `only incomplete target sets start another automatic rest; extra sets remain recordable`
- `ordinary feedback cannot silently resume a manually paused session`
- `recent actual values remain convenient and are not silently increased`
- `recommended set count never caps actual strength logs or increases XP`
- `returning users reassess recent old loads but can reuse newly confirmed logs`
- `today imports an arrived planned date before presenting exactly the same target as the recorder`
