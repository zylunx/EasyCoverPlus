---
alwaysApply: true
scene: git_message
---

在此处编写规则，自定义 AI 生成提交信息的风格。
生成 commit message 时，必须使用以下格式：

## 标题行
<type>: <简短概述>（不超过50字符）

## 变更列表
- <type>: <具体变更点1>
- <type>: <具体变更点2>

## Type 可选值
feat, fix, style, refactor, perf, test, docs, chore, ci

## 示例
feat: 新增博客封面功能

- feat: 新增主色调自动提取
- style: 优化归档页样式
- fix: 修复缩进格式问题

除特定术语和必须词条外，其他内容都必须符合中文语法规则。