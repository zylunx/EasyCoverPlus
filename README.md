# EasyCoverPlus

> DO U WANT



简单、优雅的封面图生成工具。纯客户端运行，保护您的隐私。

## 项目来源

> **修改声明（GNU AGPLv3 第 5 条）**：EasyCoverPlus 是基于 [EasyCover - AcoFork](https://github.com/afoim/easy_cover) 修改而来的版本。本项目已于 **2026-07-14** 对原项目进行修改，并继续扩展功能与使用体验。

原项目版权归 AcoFork 及原项目贡献者所有；EasyCoverPlus 新增修改的版权归相应贡献者所有。感谢原项目作者及贡献者的工作。

## 与原项目的主要区别

EasyCoverPlus 保留了原项目的多比例画布、图标选择、文字编辑、背景图片和静态导出能力，并在此基础上增加或调整了以下功能：

* **自动取色渐变背景**：新增“自动取色”背景类型，可从 Iconify 图标或用户上传图标的最终渲染结果中提取主色，并生成带可读性保护的同色系柔和渐变。
* **背景持续跟随图标**：启用自动取色后，更换图标或调整图标颜色会自动更新背景；切换回纯色或图片背景时仍保留原有设置。
* **文字透明度**：新增 `0%` 至 `100%` 的文字透明度调整，默认透明度为 `50%`，同时作用于左右文字及其描边。
* **文字自动适应**：新增文字自动缩放功能，长文字会在各自区域内自动缩小，减少溢出和重叠。
* **博客封面比例**：新增 `1200×630` 画布预设并设为默认，同时保留原项目已有的其他比例。
* **默认模板升级**：默认使用“B站 / 推荐”文字、Bilibili 图标、粉色自动渐变背景、中央玻璃容器、阴影与彩色光晕效果。
* **多格式导出**：除 PNG 外，新增 WebP 和 AVIF 导出；浏览器不支持相应编码格式时不会显示对应按钮。
* **可选图床上传**：支持 CloudFlare ImgBed（API Token / authCode），导出后可同时上传并返回链接；需密码解锁，配置仅存本机。
* **智能导出文件名**：导出文件名由左右文字自动拼接生成，并自动清理文件名非法字符。
* **导出兼容性处理**：规避跨域字体样式表导致的 `CSSStyleSheet.cssRules` 访问错误，提高浏览器端导出的稳定性。

## ✨ 特性

*   **纯客户端生成**：封面编辑与渲染均在浏览器完成；默认不上传服务器。可选图床上传会在你主动开启时将图片发送到你配置的图床。
*   **多比例支持**：支持 1200×630、1:1、16:9、21:9、4:3、2:1 等多种主流封面比例。
*   **丰富的图标库**：集成 Iconify，支持搜索和使用数万个图标。
*   **高度自定义**：
    *   **图标**：大小、旋转、颜色、阴影、容器形状（圆/方/圆角）、毛玻璃效果（高斯模糊 + 透明度）。
    *   **文字**：自定义内容、大小、颜色、透明度、描边和自动适应。
    *   **背景**：自动取色渐变、纯色背景、图片背景（支持缩放、旋转、平移、模糊）。
*   **智能排版**：自动居中布局，支持“适应”和“铺满”两种图片填充模式。
*   **纯净导出**：支持 PNG、WebP、AVIF，自动隐藏辅助线和标尺，并根据浏览器能力显示可用格式。
*   **可选图床上传**：导出时默认仅本地下载；解锁并配置 CloudFlare ImgBed 后，可同时上传并复制图片 URL。

## 🛠️ 技术栈

*   [Next.js](https://nextjs.org/) - React 框架
*   [Tailwind CSS](https://tailwindcss.com/) - 样式引擎
*   [Shadcn/ui](https://ui.shadcn.com/) - UI 组件库
*   [Zustand](https://github.com/pmndrs/zustand) - 状态管理
*   [Iconify](https://iconify.design/) - 图标方案
*   [html-to-image](https://github.com/bubkoo/html-to-image) - 图片生成

## 🚀 快速开始

1.  **克隆仓库**

```bash
git clone https://github.com/zylunx/EasyCoverPlus.git
cd EasyCoverPlus
```

2.  **安装依赖**

```bash
pnpm install
```

3.  **启动开发服务器**

```bash
pnpm dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可使用。

## 📖 使用指南

1.  **选择布局**：在左侧面板选择所需的图片比例（如 16:9）。
2.  **设置内容**：输入封面标题，调整文字大小和颜色。
3.  **添加图标**：点击图标选择器搜索并选择合适的图标，调整其样式和容器背景（支持毛玻璃效果）。
4.  **配置背景**：选择纯色背景或上传本地图片。使用“适应”或“铺满”按钮快速调整图片布局。
5.  **导出**：点击底部格式按钮保存图片。可选开启「同时上传到图床」获取在线链接。

## 🖼 可选图床上传（CloudFlare ImgBed）

本地优先：导出始终先下载到本地。若需要在线 URL：

1. 点击 **验证权限**，输入密码解锁（默认密码 `easycover-upload`，可用环境变量覆盖哈希）。
2. 打开图床设置，填写：
   - `baseUrl`：你的 ImgBed 站点地址
   - 认证方式：`API Token` 或 `authCode`
   - 对应密钥（仅保存在浏览器 `localStorage`）
3. 可用 **测试上传配置** 验证连通性。
4. 打开 **同时上传到图床**，再导出 PNG / WebP / AVIF。

成功后会自动复制链接，并保留最近 20 条历史上传记录。

### 部署密码哈希

前端使用 SHA-256 十六进制哈希做门禁（防君子不防小人）。覆盖默认密码：

```bash
# 计算哈希（Node 18+）
node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode('你的密码')).then(b=>console.log(Buffer.from(b).toString('hex')))"
```

```env
NEXT_PUBLIC_UPLOAD_PASSWORD_HASH=你的sha256十六进制
```

### 上传协议摘要

- `POST {baseUrl}/upload?returnFormat=full&uploadChannel=telegram&uploadFolder=EasyCoverPlus`
- `multipart/form-data` 字段名：`file`
- Token 模式：`Authorization: Bearer <token>`
- authCode 模式：query `authCode=<code>`
- 响应数组优先读取 `publicUrl` → `url` → `src`

> 注意：浏览器直传依赖图床实例的 CORS 配置；失败时可重试或仅保留本地文件。

## 📦 部署

本项目已配置为静态导出 (`output: 'export'`)，可轻松部署到任何静态托管服务。

### Vercel 部署

1.  Fork 本仓库。
2.  在 Vercel 中导入项目。
3.  Vercel 会自动识别 Next.js 项目。
4.  **重要**：确保构建命令为 `pnpm build` (默认)，输出目录默认为 `out` (Next.js 静态导出默认目录)。
    *   注：本项目已在 `next.config.ts` 中启用了 `output: 'export'`，Vercel 会自动处理，无需额外配置。

### GitHub Pages 部署

1.  构建项目：
    ```bash
    pnpm build
    ```
2.  将生成的 `out` 目录内容推送到 `gh-pages` 分支。

---

Original project by AcoFork. EasyCoverPlus modifications by project contributors.
