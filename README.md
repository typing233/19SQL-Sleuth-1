# SQL侦探 - 数据库谜案推理游戏

一个基于浏览器端SQLite的SQL推理解谜游戏。玩家通过编写SQL查询语句调查三起相互关联的谋杀案件，找出真凶、证据链和作案动机。

## 快速开始（一键部署）

### 方式一：直接打开（最简单）

```bash
# 直接用浏览器打开 index.html 即可运行
# macOS
open index.html
# Linux
xdg-open index.html
# Windows
start index.html
```

> 注意：部分浏览器可能因CORS限制无法加载sql.js的WASM文件。如遇此问题，请使用方式二。

### 方式二：本地HTTP服务器

```bash
# 使用 npx（无需全局安装）
npx http-server . -p 8080 -o

# 或使用 Python
python3 -m http.server 8080

# 或使用 npm scripts
npm install
npm start
```

访问 http://localhost:8080

### 方式三：Docker部署

```bash
docker run -d -p 8080:80 -v $(pwd):/usr/share/nginx/html:ro nginx:alpine
```

### 方式四：静态托管

将整个项目目录上传到任意静态文件托管服务即可：
- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages
- 任何支持静态文件的Web服务器

## 项目结构

```
sql-sleuth/
├── index.html              # 主页面入口
├── css/
│   └── style.css           # 响应式样式
├── js/
│   ├── app.js              # 应用初始化
│   ├── database.js         # SQLite数据库管理（schema + 数据）
│   ├── cases.js            # 案件定义与答案验证逻辑
│   └── ui.js               # UI交互组件
├── tests/
│   ├── test.html           # 浏览器端测试（打开即运行）
│   └── test.js             # Node.js命令行测试
├── scripts/
│   └── init-db.js          # 数据初始化与导出脚本
├── assets/                 # 导出的SQL文件等资源
├── package.json
└── README.md
```

## 游戏特性

### 三起案件
1. **翡翠庄园谋杀案** - 富豪毒杀，遗产纠纷
2. **码头仓库毒杀案** - 职场灭口，财务黑幕
3. **医院连环投毒案** - 赌债驱动，药物篡改

### 数据特点
- 11张关联表，150+条记录
- 完整的线索链（时间线、通讯、财务、监控）
- 4条伪线索干扰
- 三案间人物/证据交叉干扰
- 未验证的不在场证明

### 功能完备
- **SQL编辑器**：语法高亮、Ctrl+Enter执行、Tab缩进、格式化
- **安全执行**：仅允许SELECT，清晰中文错误提示
- **结果展示**：表格渲染、行数统计、执行耗时
- **ER图查看**：ASCII关系图、表结构详情、约束信息
- **查询历史**：最近50条记录，点击可回填
- **提示系统**：4级渐进提示，按需解锁
- **进度保存**：localStorage持久化，刷新不丢失
- **答案验证**：凶手+证据SQL+动机三重校验
- **响应式布局**：适配桌面/平板/手机

## 运行测试

```bash
# Node.js 命令行测试
npm test

# 浏览器测试
# 用浏览器打开 tests/test.html
```

测试覆盖：
- 数据库初始化（表数量、记录数）
- 安全性（8种攻击向量被阻止）
- 有效查询执行
- 错误提示质量
- 答案验证逻辑（正确/错误）
- 数据完整性（伪线索、时间线、跨案件关联）

## 技术栈

- **前端**：纯HTML/CSS/JavaScript，零框架依赖
- **数据库**：sql.js（SQLite编译为WebAssembly）
- **存储**：localStorage进度持久化
- **部署**：纯静态文件，任意HTTP服务器均可

## 数据库Schema概览

| 表名 | 说明 | 记录数 |
|------|------|--------|
| persons | 人物信息 | 25 |
| locations | 地点信息 | 12 |
| case_files | 案件档案 | 3 |
| events | 事件时间线 | 30 |
| evidence | 证据 | 28 |
| communications | 通讯记录 | 25 |
| financial_records | 财务记录 | 22 |
| alibis | 不在场证明 | 18 |
| relationships | 人物关系 | 15 |
| medical_records | 医疗记录 | 10 |
| surveillance | 监控录像 | 18 |

## 答案格式

每个案件提交需要：
1. **凶手姓名**：准确的角色全名
2. **关键证据SQL**：一条能揭示关键证据的SELECT查询
3. **作案动机**：简要说明动机（需包含关键词）

系统会验证：
- 凶手身份是否正确
- SQL是否能执行并返回相关证据
- 动机分析是否触及核心原因
