 # ============================================
 # source-writer backend  —  Python FastAPI
 # 多阶段构建，产物约 180MB
 # ============================================

 # ---------- 依赖安装阶段 ----------
FROM python:3.13-slim AS builder

WORKDIR /app

 # asyncpg 等 C 扩展在 ARM64 (aarch64) 上无预编译 wheel，需安装编译工具
 # 使用阿里云镜像加速 apt-get（PGX 服务器位于中国网络环境）
 RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null; \
     sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null; \
     apt-get update && apt-get install -y --no-install-recommends \
     gcc \
     libc6-dev \
     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
     --trusted-host pypi.tuna.tsinghua.edu.cn

 # ---------- 最终运行阶段 ----------
 FROM python:3.13-slim

 WORKDIR /app

 # 只复制已安装的包，不保留源代码外的构建缓存
 COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
 COPY --from=builder /usr/local/bin /usr/local/bin

 # 复制应用代码
 COPY . .

 # 创建非 root 用户
 RUN useradd --create-home --shell /bin/bash appuser \
     && chown -R appuser:appuser /app

 # 预建上传目录（volume 挂载点需存在且可写）
 RUN mkdir -p /app/uploads \
     && chown -R appuser:appuser /app/uploads

 USER appuser

 EXPOSE 8002

 CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--timeout-keep-alive", "300"]
