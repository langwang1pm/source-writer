# source-writer 设计文档

> 基于 patent-writer 项目经验沉淀与重构设计
> 最终更新：2026-06-13

---

## 一、项目定位

**source-writer** 是一个 AI 辅助文档编写系统。用户通过对话方式与 AI（Dify Agent）交互，系统将 AI 生成的文档内容持久化存储，支持在线编辑与导出。面向 PGX 服务器单机部署场景。

### 核心功能

- **对话式文档生成**：用户与 AI 多轮对话，AI 生成文档内容（支持多卡片回复）
- **文档在线编辑**：Markdown 分屏编辑器，支持编辑/保存/版本管理
- **知识库文件管理**：上传文件到 Dify 知识库，按企业归属管理
- **引用来源追踪**：AI 回复中引用的知识库片段可追溯

---

## 二、技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | Python 3.14 + FastAPI + SQLAlchemy (async) | PostgreSQL async 驱动 asyncpg |
| 前端 | React + TypeScript + Vite + Zustand | 状态管理使用 Zustand |
| 外部 AI | Dify Agent Chat API (SSE 流式) + Dataset API | 不接入新 AI 服务 |
| 部署 | Docker Compose + nginx | 支持 ARM (buildx) + 离线模式 |

---

## 三、部署架构

### 3.1 PGX 服务器概览

独立已有服务：PostgreSQL 独立实例（:5432）、Dify（独立部署）、OnlyOffice（开发阶段复用 patent-writer Compose 遗留）

source-writer Docker Compose 包含：
- nginx（:80）统一入口
- backend（FastAPI，不暴露端口）
- frontend（构建后的静态文件）
- onlyoffice（不暴露端口，仅内部网络访问）

文件持久化：/data/source-writer/uploads（bind mount volume）

### 3.2 nginx 路由规则

| 路径 | 转发目标 |
|---|---|
| / | frontend 静态文件 |
| /api/* | backend（:8002） |
| /files/* | 上传文件目录（volume） |
| /onlyoffice/* | onlyoffice（Docker 内部网络） |

### 3.3 PostgreSQL

- **不纳入 Docker Compose**
- 连接 PGX 已有 PostgreSQL 实例
- 新建 `sourcewriter` schema，与 patent-writer 的 `patentwriter` schema 共存
- 使用独立端口 5432（共享实例）

### 3.4 ARM 架构与部署模式

- 开发环境：本地 x86，直接启动服务
- 构建部署：`docker buildx` 产出 `linux/arm64` 镜像
- 联网模式：PGX 上 `docker compose up -d`（在线拉取镜像）
- 离线模式：联网环境 `docker save` -> tar -> PGX 上 `docker load` -> `docker compose up -d`

### 3.5 环境变量

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname?options=-csearch_path=sourcewriter

DIFY_BASE_URL=https://dify.example.com
DIFY_APP_API_KEY=app-xxx
DIFY_DATASET_API_KEY=dataset-xxx
DIFY_DATASET_ID=xxx

DIFY_INDEXING_TECHNIQUE=high_quality
DIFY_PROCESS_RULE_MODE=automatic

UPLOAD_DIR=/data/source-writer/uploads
```

---

## 四、数据库设计（9 张表）

### 4.1 新旧命名映射

| 旧表/字段（patent-writer） | 新表/字段（source-writer） | 说明 |
|---|---|---|
| enterprise_info | client_enterprise | 语义修正 |
| project_workspace | workspace | 简化命名 |
| conversation | session | 通用会话概念 |
| message | chat_message | 只存用户消息 |
| document | response_doc | 语义修正：AI 生成的回复 |
| citation | source_ref | 引用来源更精确 |
| citation.ref_mark | ordinal（int） | 前端计算展示样式 |
| knowledge_config | 移除 -> 环境变量 | 不再建表 |
| knowledge_file | uploaded_file | 明确为用户上传文件 |
| （无） | message_block | 新增：AI 回复多卡片支持 |
| （无） | response_doc_version | 未来扩展，暂不建表 |

### 4.2 领域模型 ER 图

erDiagram
    client_enterprise ||--o{ workspace : "has"
    task_type ||--o{ workspace : "has"
    client_enterprise ||--o{ uploaded_file : "owns"

    workspace ||--o{ session : "has"
    session ||--o{ chat_message : "has"

    chat_message ||--o{ message_block : "produces"
    chat_message ||--o| response_doc : "may produce"

    response_doc ||--o{ source_ref : "references"
    message_block ||--o{ source_ref : "contains"

    uploaded_file ||--o{ source_ref : "referenced_by"

### 4.3 逐表设计

通用字段（每张表均有）：
- id（UUID PK）
- created_at（timestamptz, NOT NULL）
- updated_at（timestamptz, 业务需要时加）
- deleted_at（timestamptz, 可空 -> 软删除）

#### client_enterprise（客户企业）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| name | varchar(255) | NOT NULL, UNIQUE | 企业名称 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| deleted_at | timestamptz | 可空 | 软删除 |

说明：名称字典。通过系统 UI 做增删改查，不再手动维护数据库。

#### task_type（任务类型）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| name | varchar(100) | NOT NULL, UNIQUE | 任务类型名称 |
| description | text | 可空 | 类型说明 |
| is_active | boolean | NOT NULL, DEFAULT true | 是否启用 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| deleted_at | timestamptz | 可空 | 软删除 |

说明：通过 UI 做增删改查。is_active 用于停用任务类型。

#### workspace（项目空间）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| name | varchar(255) | NOT NULL | 项目空间名称 |
| client_enterprise_id | UUID | FK -> client_enterprise.id, NOT NULL | 所属企业 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| deleted_at | timestamptz | 可空 | 软删除 |

说明：一个 workspace 绑定一个企业。任务类型不在 workspace 层约束。

#### uploaded_file（上传文件）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| client_enterprise_id | UUID | FK -> client_enterprise.id, NOT NULL | 所属企业 |
| dify_document_id | varchar(255) | UNIQUE | Dify 侧文档 ID |
| file_name | varchar(500) | NOT NULL | 文件名（含扩展名） |
| file_size | bigint | NOT NULL | 文件大小（字节） |
| mime_type | varchar(100) | 可空 | MIME 类型 |
| local_path | varchar(1000) | 可空 | 本地存储路径 |
| status | varchar(20) | NOT NULL, DEFAULT pending | 索引状态 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| deleted_at | timestamptz | 可空 | 软删除 |

说明：本地按企业分目录。Dify 同一知识库，通过元数据 company 区分。
重复文件检测返回 409。文件列表按企业过滤（跨 workspace 共享）。

#### session（会话）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| workspace_id | UUID | FK -> workspace.id, NOT NULL | 所属项目空间 |
| title | varchar(500) | 可空 | 会话标题（自动生成） |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| deleted_at | timestamptz | 可空 | 软删除 |

说明：创建时无需选择任务类型。title 由首条消息前 30 字自动生成。

#### chat_message（聊天消息）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| session_id | UUID | FK -> session.id, NOT NULL | 所属会话 |
| task_type_id | UUID | FK -> task_type.id, 可空 | 任务类型（支持切换） |
| content | text | NOT NULL | 用户消息内容 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| deleted_at | timestamptz | 可空 | 软删除 |

说明：只存用户消息。task_type_id 支持会话内切换任务类型。

#### message_block（AI 回复块）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| session_id | UUID | FK -> session.id, NOT NULL | 所属会话 |
| user_message_id | UUID | FK -> chat_message.id, NOT NULL | 对应提问 |
| card_ordinal | int | NOT NULL | 卡片序号（从 1 开始） |
| block_type | varchar(20) | NOT NULL | think / answer |
| content | text | NOT NULL | 原始内容（含引用标记） |
| ordinal | int | NOT NULL | 块顺序号 |
| created_at | timestamptz | NOT NULL | 创建时间 |

说明：一个提问 -> N 条 message_block。卡片完整后立即写入（流式写入），不等 SSE 结束。

#### response_doc（AI 回复文档）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| session_id | UUID | FK -> session.id, NOT NULL | 所属会话 |
| chat_message_id | UUID | FK -> chat_message.id, NOT NULL | 触发消息 |
| title | varchar(500) | 可空 | 文档标题 |
| body_markdown | text | 可空 | 干净 Markdown（无引用标记） |
| body_html | text | 可空 | 干净 HTML（无引用标记） |
| revision | int | NOT NULL, DEFAULT 1 | 版本号 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| deleted_at | timestamptz | 可空 | 软删除 |

说明：SSE 结束后生成，去除所有引用标记。revision>1 显示版本标记。

#### source_ref（引用来源）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | 主键 |
| response_doc_id | UUID | FK -> response_doc.id, NOT NULL | 关联文档 |
| message_block_id | UUID | FK -> message_block.id, 可空 | 所在回复块 |
| card_ordinal | int | NOT NULL | 所在卡片序号 |
| ordinal | int | NOT NULL | 引用序号（1, 2, 3...） |
| source_name | varchar(500) | NOT NULL | 来源文件名 |
| dify_document_id | varchar(255) | 可空 | Dify 侧文档 ID |
| uploaded_file_id | UUID | FK -> uploaded_file.id, 可空 | 本地文件记录 |
| chunk_id | varchar(255) | 可空 | Dify chunk ID |
| snippet | text | 可空 | 引用文本片段 |
| relevance_score | float | 可空 | 相似度分数 |
| char_position | int | 可空 | 文档中字符位置 |

说明：卡片完整后后端解析写入。dify_document_id + uploaded_file_id 双字段保留。
后端 source_ref 是唯一权威引用数据源。

### 4.4 索引概览

| 表 | 索引字段 |
|---|---|
| client_enterprise | name (UNIQUE) |
| task_type | name (UNIQUE) |
| workspace | client_enterprise_id |
| uploaded_file | dify_document_id (UNIQUE), client_enterprise_id |
| session | workspace_id, updated_at DESC |
| chat_message | session_id, created_at ASC |
| message_block | user_message_id, card_ordinal ASC, ordinal ASC |
| response_doc | session_id, created_at DESC |
| source_ref | response_doc_id, card_ordinal ASC |

---

## 五、核心业务流设计

### 5.1 SSE 流式对话

#### 整体阶段

| 阶段 | 说明 | 写入内容 | 前端行为 |
|---|---|---|---|
| A | 用户发送消息 | chat_message | 展示用户消息 |
| B | SSE 流式循环转发 delta | 无 | 拼入卡片，临时解析引用 |
| C | 单卡片完整 | message_block + source_ref | 引用面板更新为正式数据 |
| D | SSE 结束 | response_doc | 显示 done，可进入文档页 |

#### 阶段 A：用户发送消息

```
前端 POST /api/v1/sessions/{id}/messages
  body: { content, task_type_id? }

后端：
  1. 校验 session 存在
  2. 创建 chat_message（role=user, content, task_type_id）
  3. 返回 { message_id, session_id }
```

#### 阶段 B：SSE 流式循环

```
前端 GET /api/v1/sessions/{id}/stream?user_message_id=xxx

后端 StreamService.stream_chat():
  1. 调用 DifyClient.chat_messages_stream()
  2. 事件循环：
     agent_thought -> delta text -> 透传前端 -> 拼入 think 区域
     agent_message -> delta text -> 透传前端 -> 拼入 answer 区域
     message_end -> 触发阶段 D
     error -> 向前端发送 error 事件
  3. 50ms 渲染节流，避免 React 频繁 setState
```

#### 阶段 C：卡片完成后端处理

```
卡片完整条件：收到下一个 agent_thought 或 message_end

后端：
  1. 正则解析卡片内容中的 【引用来源：xxx】
  2. 写入 message_block（card_ordinal, block_type, content, ordinal）
  3. 写入 source_ref（每条引用一条）
  4. 发送 citation_update { card_ordinal, refs: [...] }

前端：替换该卡片引用面板的临时数据为正式数据
```

#### 阶段 D：SSE 结束后处理

```
后端 StreamService.on_message_end():
  1. 拼接全部卡片内容
  2. 去除所有 【引用来源：xxx】标记 -> body_markdown
  3. Markdown -> HTML 渲染 -> body_html
  4. 创建 response_doc（revision=1）
  5. 回填 source_ref.response_doc_id
  6. 发送 done { message_id, doc_id, revision }

前端：清除临时引用状态，文档卡片显示入口
```

#### 引用来源权威规则

```
后端 source_ref = 唯一权威数据源
前端临时解析 = 过渡展示，不写入 store，SSE 结束后清空
每张卡片完成 -> 后端 citation_update 覆盖前端临时数据
```

#### 异常处理

SSE 中途断开：已写入的 message_block + source_ref 保留，response_doc 不生成。
用户刷新后可见部分回复，可重新提问。

### 5.2 知识库文件上传

流程：
1. 用户选择文件 -> 前端检测同名文件 -> 可重名提示
2. POST /api/v1/uploaded-files (multipart)
3. 后端校验（类型白名单、大小上限）
4. 保存本地 ${UPLOAD_DIR}/{enterprise_id}/{file_id}/original.xxx
5. 上传 Dify Dataset API -> 获取 dify_document_id
6. 标注元数据 company = enterprise_id
7. 写入 uploaded_file（status=pending）
8. 返回文件记录 -> 前端 prepend 到列表

- 重复文件：前后端双重检测，返回 409 不可覆盖（方案 B）
- 状态同步：前端每 5s 轮询，后端查询 Dify 索引状态更新 status

### 5.3 文档编辑/保存

流程：
1. 聊天界面点击文档卡片 -> 文档预览/编辑页
2. 加载 response_doc（body_markdown + body_html）
3. Markdown 分屏编辑（左编辑 + 右预览）
4. 保存 PUT /api/v1/response-docs/{id}
   -> 更新 body_markdown / body_html / revision += 1
5. 导出 docx GET /api/v1/response-docs/{id}/export
   - 入口：聊天消息卡片 + 文档页工具栏

文档卡片显示规则：
- revision = 1 -> 无标记（初始版本）
- revision > 1 -> "v{revision} 已编辑"

---

## 六、API 路由设计（草案）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/v1/enterprises | 创建企业 |
| GET | /api/v1/enterprises | 企业列表 |
| PUT | /api/v1/enterprises/{id} | 更新企业 |
| DELETE | /api/v1/enterprises/{id} | 删除企业 |
| POST | /api/v1/task-types | 创建任务类型 |
| GET | /api/v1/task-types | 任务类型列表 |
| PUT | /api/v1/task-types/{id} | 更新任务类型 |
| DELETE | /api/v1/task-types/{id} | 删除任务类型 |
| POST | /api/v1/workspaces | 创建项目空间 |
| GET | /api/v1/workspaces | 项目空间列表 |
| GET | /api/v1/workspaces/{id} | 项目空间详情 |
| PUT | /api/v1/workspaces/{id} | 更新项目空间 |
| DELETE | /api/v1/workspaces/{id} | 删除项目空间 |
| POST | /api/v1/sessions | 创建会话 |
| GET | /api/v1/sessions | 会话列表 |
| GET | /api/v1/sessions/{id} | 会话详情 |
| DELETE | /api/v1/sessions/{id} | 删除会话 |
| POST | /api/v1/sessions/{id}/messages | 发送消息 |
| GET | /api/v1/sessions/{id}/stream | SSE 流式对话 |
| POST | /api/v1/uploaded-files | 上传文件 |
| GET | /api/v1/uploaded-files | 文件列表 |
| GET | /api/v1/uploaded-files/{id}/download | 下载文件 |
| DELETE | /api/v1/uploaded-files/{id} | 删除文件 |
| GET | /api/v1/response-docs/{id} | 文档详情 |
| PUT | /api/v1/response-docs/{id} | 编辑保存 |
| GET | /api/v1/response-docs/{id}/export | 导出 docx |
| GET | /api/v1/response-docs/{id}/source-refs | 引用列表 |

---

## 七、未来扩展

### 7.1 文档历史版本

response_doc_version 表（暂不建表，预留设计）：
- id（UUID PK）
- response_doc_id（FK -> response_doc.id）
- revision（int）
- title / body_markdown / body_html
- created_at

编辑保存前将当前版本推入此表，支持版本查看与回滚。

### 7.2 文件存储抽象

定义 FileStorage 抽象接口（Protocol），当前实现本地文件系统。
后续可替换为 MinIO/S3 实现，不修改业务代码。

---

## 八、开发环境

### 8.1 本地启动

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

cd frontend
npm run dev
```

### 8.2 依赖服务

| 服务 | 地址 |
|---|---|
| PostgreSQL | {PGX_HOST}:5432, schema=sourcewriter |
| Dify | {PGX_HOST}:{DIFY_PORT} |
| OnlyOffice | 复用 patent-writer Compose 中的 onlyoffice |
