# 学术风格个人主页

## 项目概述
这是一个专为学术人员设计的个人主页模板，采用现代瑞士设计风格，注重内容的专业性和可读性。

## 设计特色
- **学术蓝主色调**：体现专业性和权威感
- **清晰的排版层级**：使用衬线体（Lora）用于标题，无衬线体（Inter）用于正文
- **响应式设计**：完美适配桌面、平板和移动设备
- **无障碍访问**：支持键盘导航和屏幕阅读器

## 文件结构
```
/
├── index.html          # 主页面文件
├── styles/
│   └── main.css       # 样式文件
├── scripts/
│   └── main.js        # 交互脚本
└── README.md          # 项目说明
```

## 自定义指南

### 1. 个人信息修改
在 `index.html` 中修改以下内容：
- 姓名和头衔（`.profile-name`, `.profile-title`）
- 个人简介（`.profile-description`）
- 学术链接（`.social-links` 部分）
- 联系方式（`#contact` 部分）

### 2. 研究领域调整
在 `research-grid` 部分：
- 修改研究领域标题和描述
- 更新关键词标签（`.keyword-tag`）

### 3. 学术成果管理
在 `publications-list` 部分：
- 添加或删除论文卡片（`.publication-card`）
- 修改论文标题、作者、期刊信息
- 更新PDF、代码、DOI链接

### 4. 项目作品展示
在 `projects-grid` 部分：
- 添加或删除项目卡片（`.project-card`）
- 更新项目描述、技术栈（`.tech-tag`）
- 添加项目链接

### 5. 样式定制
在 `styles/main.css` 中可以调整：
- 色彩方案（CSS变量）
- 字体大小和行高
- 间距和布局
- 动画效果

## 部署说明

### 本地预览
1. 下载所有文件到本地文件夹
2. 双击 `index.html` 在浏览器中打开
3. 或者使用本地服务器：
   ```bash
   # 使用Python
   python -m http.server 8000
   
   # 使用Node.js
   npx serve .
   ```

### 在线部署
可以部署到以下平台：
- **GitHub Pages**：将文件推送到GitHub仓库，开启Pages功能
- **Netlify**：拖拽文件夹到Netlify部署
- **Vercel**：连接GitHub仓库自动部署
- **个人服务器**：上传文件到网站根目录

## 浏览器支持
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 技术特性
- **现代CSS**：使用CSS Grid、Flexbox、CSS变量
- **原生JavaScript**：无外部依赖，代码简洁
- **性能优化**：图片懒加载、事件节流、动画优化
- **SEO友好**：语义化HTML、适当的meta标签

## 可访问性
- 遵循WCAG 2.1 AA标准
- 支持键盘导航
- 适当的颜色对比度
- 语义化HTML结构
- 屏幕阅读器友好

## 许可证
本项目基于MIT许可证，允许自由使用和修改。

## 更新日志
- **v1.0.0** (2025-11-11)：初始版本发布
  - 完整的学术风格设计
  - 响应式布局
  - 交互功能
  - 无障碍访问支持

## 贡献
欢迎提交Issues和Pull Requests来改进这个项目。

## 联系方式
如有问题或建议，请通过以下方式联系：
- 提交GitHub Issue
- 发送邮件反馈