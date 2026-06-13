# patent-writer 项目总结

> 生成日期：2026-06-13
> 此文档用于 source-writer 新项目参考，记录了 patent-writer 的全部业务知识、架构决策和工程踩坑经验。

---

## 一、项目概述

**项目定位：** 专利文档编写辅助系统。用户通过对话方式，让 AI（Dify Agent）生成专利文档，结果以 Markdown 文档形式持久化，支持导出为 docx，并追踪 AI 回复中引用的知识库来源。

**技术栈：**
- 后端：Python 3.14 + FastAPI + SQLAlchemy（async）+ PostgreSQL
- 前端：React + TypeScript + Vite + Zustand
- 外部 AI：Dify Agent Chat API（SSE 流式）+ Dify Dataset API（知识库文件管理）

## 二、业务功能清单

### 2.1 对话管理
- 创建/删除会话（conversation）
- 会话列表（翻页 + 搜索）
- 会话标题自动生成（首条用户消息前 30 字）
- SSE 流式对话：用户消息 -> Dify Agent -> AI 回复实时推送

### 2.2 文档管理
- AI 回复自动生成 Document 实体
- 文档版本管理（version 字段自增）
- 文档导出为 .docx（markdown -> docx）

### 2.3 引用来源管理
- 从 Dify 返回的 retriever_resources 创建 Citation 记录
- 引用列表展示（来源名称、chunk 片段、相似度分数）
- 引用面板（CitationPanel）交互：点击查看详情
- 定位到原文（OnlyOffice 预览）

### 2.4 知识库管理
- 知识库配置（Dify 连接信息、索引模式、分片规则等）
- 文件上传（本地 + Dify 双写）
- 文件列表（分页 + 搜索 + enterprise 过滤）
- 文件下载（本地优先，兼容 Dify fallback）
- 文件删除（本地 + Dify 双删）

### 2.5 项目管理
- 项目空间（project_workspace）
- 客户企业信息（enterprise_info）
- 任务类型（task_type）

## 三、后端架构

### 3.1 分层结构

```
backend/app/
+-- api/              # FastAPI routers（编排层）
|   +-- conversations.py   会话 CRUD + SSE 流式端点
|   +-- knowledge.py       知识库配置 CRUD
|   +-- knowledge_files.py 文件上传/列表/下载/删除
|   +-- citations.py       引用 REST API
|   +-- documents.py       文档查阅/导出
|   +-- project_workspaces.py, task_types.py, enterprise_infos.py
+-- services/         # 业务逻辑层
|   +-- conversation_svc.py
|   +-- citation_svc.py          引用创建/查询
|   +-- document_svc.py          文档 CRUD
|   +-- llm_svc.py               Dify 聊天 API 高层封装
|   +-- export_svc.py            文档导出
|   +-- markdown_docx_svc.py     Markdown -> docx 转换
|   +-- onlyoffice_svc.py        OnlyOffice 集成
|   +-- project_workspace_svc.py
+-- models/           # SQLAlchemy ORM（7 个表）
|   +-- conversation.py
|   +-- message.py
|   +-- document.py
|   +-- citation.py
|   +-- knowledge_config.py
|   +-- knowledge_file.py
|   +-- project_workspace.py, enterprise_info.py, task_type.py
+-- schemas/          # Pydantic 序列化
+-- clients/          # 外部服务适配层
|   +-- dify_client.py     Dify Chat + Dataset + Retrieve API（三合一套件）
+-- core/
    +-- citation_parser.py    引用来源正则解析工具
    +-- prompt_templates.py   Dify Agent prompt 模板
```

### 3.2 SSE 流式端点（核心）

**路径：** `GET /conversations/{id}/stream?content=...`

**完整流程：**
1. 保存用户消息到 messages 表
2. 调用 Dify chat_messages_stream（SSE）
3. SSE 循环：content_delta -> 实时中转到前端
4. SSE 结束：拼全文 -> create Document -> create Message -> parse citations -> create Citation 记录 -> send done 事件

**所有写入在 SSE 结束后执行，在一个事务内完成。**

### 3.3 API 端点速查

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/conversations | 创建会话 |
| GET | /api/v1/conversations | 会话列表（分页+搜索） |
| GET | /api/v1/conversations/{id} | 会话详情 |
| DELETE | /api/v1/conversations/{id} | 删除会话 |
| GET | /api/v1/conversations/{id}/messages | 消息列表 |
| POST | /api/v1/conversations/{id}/messages | 非流式发送消息 |
| GET | /api/v1/conversations/{id}/stream | **SSE 流式发送消息** |
| POST | /api/v1/knowledge/files/upload | 上传知识库文件 |
| GET | /api/v1/knowledge/files | 文件列表（分页+搜索） |
| GET | /api/v1/knowledge/files/{id}/download | 下载文件（支持 inline/attachment） |
| DELETE | /api/v1/knowledge/files/{id} | 删除文件 |
| GET | /api/v1/knowledge/configs | 知识库配置列表 |
| POST | /api/v1/knowledge/configs | 创建知识库配置 |
| PUT | /api/v1/knowledge/configs/{id} | 更新知识库配置 |

## 四、数据库模型详解

### 4.1 表结构速查

**9 张表，schema: patentwriter**

| 表名 | 核心字段 | 核心关系 | 备注 |
|------|---------|---------|------|
| conversations | id, title, project_workspace_id | 1:N -> messages, documents | 含冗余字段 enterprise/task |
| messages | id, conversation_id, role, content, document_id | N:1 -> conversations | document_id 指向 AI 回复文档 |
| documents | id, conversation_id, title, content_html, content_markdown, version | 1:N -> citations | 存 AI 回复内容，非知识库源文档 |
| citations | id, document_id, ref_mark, source_name, source_id, chunk_content, score | N:1 -> documents | 追踪回复中引用的知识库片段 |
| knowledge_configs | id, name, dify_base_url, dify_api_key, knowledge_id, 20+ 字段 | 1:N -> knowledge_files | 字段过多，含大量 process 配置 |
| knowledge_files | id, dify_document_id, knowledge_config_id, name, size, local_path | N:1 -> knowledge_configs | 上传到 Dify 的文件记录 |
| project_workspace | id, workspace_name, enterprise_info_id, task_type_id | 核心枢纽表 | 关联企业和任务类型 |
| enterprise_info | id, enterprise_name | 客户企业 | - |
| task_type | id, task_name, description, is_active | 任务类型 | - |

### 4.2 关键索引

```sql
-- conversations: id (PK), project_workspace_id, updated_at
-- messages: id (PK), conversation_id, created_at
-- documents: id (PK), conversation_id
-- citations: id (PK), document_id
-- knowledge_files: dify_document_id (UNIQUE), knowledge_config_id
```

## 五、前端架构

### 5.1 目录结构

```
frontend/src/
+-- components/
|   +-- chat/
|   |   +-- ChatView.tsx        # 聊天主界面（~300 行）
|   |   +-- ContentCard.tsx      # AI 回复卡片（多块消息渲染）
|   |   +-- DocumentCard.tsx     # 文档卡片
|   |   +-- FileAttachment.tsx   # AI 回复附件下载
|   |   +-- ThinkingCard.tsx     # AI 思考过程显示
|   +-- layout/
|   |   +-- CitationPanel.tsx    # 引用来源侧边栏面板
|   |   +-- Sidebar.tsx          # 会话列表侧边栏
|   |   +-- TopNav.tsx
|   +-- knowledge/
|   |   +-- KnowledgePage.tsx    # 知识库文件管理页面
|   +-- citation/
|   |   +-- CitationBadge.tsx
|   +-- project/
|       +-- ProjectWorkspaceModal.tsx
|       +-- ProjectWorkspacePage.tsx
+-- stores/
|   +-- conversationStore.ts   # 会话状态 + SSE 流式处理（~400 行）
|   +-- citationStore.ts       # 引用来源状态
|   +-- knowledgeStore.ts      # 知识库文件状态
|   +-- projectWorkspaceStore.ts
+-- hooks/
|   +-- useSSE.ts              # SSE 连接通用 hook
|   +-- useChatCitations.ts    # 引用来源解析（含正则）
|   +-- useCitationSync.ts
+-- services/                  # API 调用封装
+-- types/                     # TypeScript 类型定义
+-- utils/
    +-- citationParser.ts       # 引用文本正则解析
    +-- docxExport.ts
```

### 5.2 状态管理

使用 Zustand 进行状态管理，主要 store：

- **conversationStore：** 会话列表 + 当前会话消息 + SSE 流式状态（isStreaming, streamPhase）
- **citationStore：** 当前 AI 回复的引用来源列表 + 选中的引用 ID
- **knowledgeStore：** 知识库文件列表 + 上传状态 + 分页

## 六、Dify 集成细节（踩坑记录）

### 6.1 客户端架构

当前 patent-writer 使用一个 DifyClient 类处理三种 API：

| API 类型 | 方法 | 用途 |
|----------|------|------|
| Chat | chat_messages / chat_messages_stream | SSE 流式对话 |
| Dataset | create_document_by_file | 文件上传 |
| Dataset | append_metadata | 文件元数据 |
| Knowledge | retrieve | 知识库检索（未使用） |
| Admin | get_message | 获取消息详情（含检索来源） |

### 6.2 SSE 流式关键经验

**Dify 版本行为差异：**
- Dify 不同版本，retriever_resources 可能出现在不同位置；有时在 SSE message_end 的 retriever_resources 字段，有时需要额外调 GET /messages/{id} 获取
- 当前实现做了三层降级：(1) SSE message_end 的 retriever_resources -> (2) GET /messages/{id} 的 retriever_resources -> (3) 正则解析正文

**SSE 事件类型：**
- agent_message / message：增量文本（delta answer）
- message_end：对话结束，含 conversation_id, message_id
- error：Dify 返回的错误

**超时处理：**
- 连接超时 10s
- 读取超时 600s（10 分钟）
- 写超时 60s
- 前端额外 600s 兜底超时
- 20s 心跳保活

**前端渲染节流：** 50ms 间隔，避免频繁 setState 导致 React 重渲染卡顿

### 6.3 文件上传关键经验

**API Key 区分：**
- App API Key（DIFY_API_KEY）：用于 Chat API（对话）、Dataset Retrieve API（检索）
- Dataset API Key（DIFY_KNOWLEDGE_API_KEY）：用于 Dataset API（文件上传、元数据管理）
- 如果未设置 DIFY_KNOWLEDGE_API_KEY，当前代码会 fallback 使用 DIFY_API_KEY

**中文文件名处理：**
- 通过 `quote_fields=False` 参数上传，避免中文文件名被编码
- 下载时通过 RFC 5987（Content-Disposition: filename*=UTF-8"xxx"）处理中文文件名

**元数据 API：**
- 上传成功后通过 POST /v1/datasets/{id}/documents/metadata 设置 company 元数据
- 元数据字段需先查询 /v1/datasets/{id}/metadata 获取字段 ID
- 元数据设置失败不会中断主流程（只记录日志）

### 6.4 Dify 配置字段详解

knowledge_config 表的配置字段可直接映射到 Dify 上传 API 的参数：

| 字段 | 对应 Dify API 参数 | 说明 |
|------|------------------|------|
| indexing_technique | data.indexing_technique | economy / high_quality |
| process_rule_mode | data.process_rule.mode | automatic / hierarchical |
| pre_remove_extra_spaces | data.process_rule.rules.pre_processing_rules[0].enabled | - |
| pre_remove_urls_emails | data.process_rule.rules.pre_processing_rules[1].enabled | - |
| segment_separator | data.process_rule.rules.segmentation.separator | - |
| segment_max_tokens | data.process_rule.rules.segmentation.max_tokens | - |
| parent_mode | data.process_rule.rules.parent_mode | paragraph / full_doc |
| doc_form | data.doc_form | hierarchical_model |
| doc_language | data.doc_language | Chinese Simplified |
| embedding_model | data.embedding_model | high_quality 模式需要 |
| embedding_model_provider | data.embedding_model_provider | high_quality 模式需要 |

## 七、已知问题与设计缺陷

### 7.1 语义混淆（核心问题）

1. **Document 表名**：存储的是 AI 回复内容，不是知识库源文档，与 Dify SDK 的 document 概念冲突
2. **Message.document_id**：指向 AI 回复文档，字段名误导
3. **knowledge_file.dify_document_id**：Dify 侧也叫 document，与本地 Document 含义完全不同
4. **knowledge_config 字段过多**：20+ 字段平铺，大部分只在文件上传时用一次，应改用 JSONB
5. **conversation 含冗余字段**：enterprise_info_id 和 task_type_id 从 project_workspace 冗余过来

### 7.2 架构缺陷

1. **SSE 流式逻辑内联**：stream_message 函数 ~250 行，未拆分为独立 service
2. **引用来源双源冲突**：后端 parse retriever_resources + 前端正则解析，互相覆盖
3. **dify_client 三合一套件**：Chat、Dataset、Knowledge API 耦合在一个类中
4. **knowledge_files.py 职责过重**：~500 行，混合上传、列表、下载、元数据管理
5. **前端 SSE 管理在 store 中**：conversationStore 的 sendMessage 方法含完整 SSE 处理逻辑，耦合了网络通信和状态管理
6. **引用来源权威性不明确**：后端 citations 表和前端正则解析两个来源，无单一源约定

### 7.3 功能不完整

1. **文档编辑**：文档生成后不支持在线编辑（仅有预览和 docx 导出）
2. **Dify 配置测试**：test_knowledge_config 接口是 mock 实现，未真正调用 Dify health API
3. **文件 indexing 状态同步**：上传到 Dify 后，indexing 状态变化依赖前端轮询，没有 Webhook
4. **多轮对话**：当前每次都是新对话，未持久化 Dify 的 conversation_id
5. **引用来源定位到原文**：定位功能不稳定，source_id 字段可能为空

## 八、部署与环境

### 8.1 启动方式

**后端（端口 8002）：**
```bash
cd backend
venv/Scripts/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

**前端（端口 3000）：**
```bash
cd frontend
npm run dev
```

### 8.2 数据库
- PostgreSQL，schema: patentwriter
- 3 个 migration 文件（001: local_path 字段追加, 002: 时区修复, 003: 消息文档回填）
- 使用 asyncpg 适配 SQLAlchemy async

### 8.3 环境变量（.env）
- DIFY_BASE_URL：Dify 服务地址
- DIFY_API_KEY：Dify App API Key
- DIFY_KNOWLEDGE_API_KEY：Dify Dataset API Key（可选）
- DIFY_KHOWNLEDGE_ID：知识库 ID
- DATABASE_URL：PostgreSQL 连接串
- UPLOAD_DIR：本地文件上传目录

## 九、数据迁移注意事项

### 9.1 现有数据量预估
- conversations：20-50 条
- messages：50-200 条
- documents：20-50 条
- citations：50-200 条
- knowledge_configs：1-3 条
- knowledge_files：10-50 条

### 9.2 迁移关键点
1. Document 表（AI 回复文档）-> response_doc：content_html/markdown 保留
2. citation 表 -> source_ref：ref_mark 改为 ordinal，source_id 映射到 uploaded_file_id
3. knowledge_config -> knowledge_source + knowledge_source_config：20+ 字段拆分
4. conversation -> session：移除冗余字段，project_workspace_id 改为 workspace_id
5. 时区修复：当前所有 created_at/updated_at 字段已 +8 修复（migration 002）

---

## 附录：引用关系总览

```
project_workspace (workspace)
  +-- enterprise_info (client_enterprise)
  +-- task_type (task_type)
  +-- conversation (session)
       +-- message (chat_message)
       |    +-- document (response_doc)
       |         +-- citation (source_ref)
       +-- knowledge_config (knowledge_source)
            +-- knowledge_file (uploaded_file)
```

括号内是 source-writer 中的新命名。