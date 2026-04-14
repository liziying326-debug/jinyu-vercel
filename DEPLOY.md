# Vercel 全栈部署说明

## 项目结构

```
jinyu-2026-vercel/
├── api/                    # Vercel Serverless API
│   ├── data/              # JSON 数据文件（持久化）
│   ├── products.js        # 产品 API
│   ├── categories.js      # 分类 API
│   ├── i18n/[lang].js     # 翻译 API
│   └── auth/login.js      # 登录 API
├── *.html                 # 前端页面
├── api.js                 # 前端 API 客户端
├── vercel.json            # Vercel 配置
└── package.json
```

## 部署步骤

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 登录 Vercel

```bash
vercel login
```

### 3. 部署

```bash
cd jinyu-2026-vercel
vercel --prod
```

### 4. 获取域名

部署完成后，Vercel 会提供域名：
- `https://jinyu-website-xxxxx.vercel.app`

## 功能特性

- ✅ 前后端一体部署
- ✅ 产品增删改查
- ✅ 分类管理
- ✅ 多语言翻译
- ✅ 后台登录
- ✅ 数据持久化（JSON 文件）

## 后台管理

访问：`https://你的域名/admin.html`
- 用户名：admin
- 密码：admin123

## 注意事项

1. **数据持久化**：Vercel Serverless 函数是 Stateless 的，每次部署后数据会重置。如需持久化，需要连接外部数据库（如 MongoDB Atlas、Supabase）。

2. **图片存储**：当前图片使用 Base64 或外部 URL。如需上传功能，需要配置外部存储（如 Cloudinary、AWS S3）。

3. **免费额度**：
   - 函数调用：100万次/月
   - 带宽：100GB/月
   - 构建时间：6000分钟/月

## 升级到生产环境

如需数据持久化，建议：
1. 使用 Vercel KV 或 Upstash Redis 缓存数据
2. 使用 MongoDB Atlas 存储数据
3. 使用 Cloudinary 存储图片
