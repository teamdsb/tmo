# 商品三级规格 ECS 发布记录（2026-09-21）

## 发布结果

功能提交为 `7840e72`，通过 `14ba54e` 合并到 main；线上运行的 main 代码版本为 `f5e3a2bb07d9b55f8d8d80c8ce0d989bb4a47871`。后续发布记录提交只修改文档。更新时间为北京时间 2026-09-21 16:22。

后台地址为 https://admin.yunhuhui.com.cn，API 地址为 https://yunhuhui.com.cn。此次更新 commerce、gateway-bff 和 admin 静态资源。支付容器因旧 Podman 容器依赖需要重建，但逐项校验保留原镜像 ID 与全部环境变量；identity 容器未重建。小程序代码随功能合入 main，本记录仅覆盖 ECS 服务发布。

## 发布目录与备份

ECS 的原 `/opt/tmo` 含未提交运维修改，未执行覆盖式 pull/reset。发布使用干净 Git archive，目录为 `/opt/tmo-releases/f5e3a2bb07d9b55f8d8d80c8ce0d989bb4a47871`，`/opt/tmo-releases/current` 指向该目录。

发布前备份保存在 `/opt/tmo-backups/product-specs-f5e3a2b`：包含 commerce 数据库 custom dump、旧 admin、媒体目录、原容器 inspect 和环境文件。包含密钥的文件权限为 0600，父目录为 0700，不应输出其内容。旧镜像保留为 `localhost/tmo/commerce:rollback-pre-f5e3a2b` 与 `localhost/tmo/gateway-bff:rollback-pre-f5e3a2b`。原支付镜像保留为 `localhost/tmo/payment:preserved-f5e3a2b`。旧的停止状态支付回滚容器在移除依赖前保存了完整 inspect 和 `historical-container-pre-f5e3a2b` 镜像。

## 本次方法

服务器只有约 2 GB 可用空间，因此在本机从合并后的 main 运行 Linux amd64、CGO_DISABLED Go 构建，并构建真实模式 admin；上传源码、二进制与静态文件后核对 SHA-256。ECS 镜像基于已存在的运行时镜像，仅替换业务二进制，避免在服务器生成大型 Go 构建层。

生产数据库已包含 00024，本次只在单一事务中应用 00025 的 Up 部分创建 product_export_jobs，不重放旧迁移中的历史数据回填。部署配置从正在运行容器的环境、端口、挂载和身份生成，存于发布目录的私有 runtime-compose.json。容器切换后必须核对实际镜像 revision，再发布 admin。静态资源先写入带哈希文件，HTML 用原子替换；保留旧哈希文件供已有浏览器会话继续访问。

注意服务器 Podman Compose 1.0.6：当旧 commerce 有依赖容器时，force-recreate 内部可能失败但外层返回 0。仅检查命令退出码或 /health 不足以证明新版本上线。此次先恢复旧 admin，再保存并移除已停止的历史依赖容器，按 payment → commerce 的顺序停掉旧实例，再按 commerce → payment 的顺序恢复；payment 使用原镜像/配置。必须同时检查实际容器 revision、服务 ready 和新增接口响应。

Nginx 以独立用户直接读取 /opt/tmo/data/media。导出目录需可遍历、工作簿与错误报告需可读取；本次增加了针对该部署方式的文件权限回归测试。

## 验收证据

合并后本机真实 PostgreSQL 下 Commerce、共享包和网关测试通过；小程序 45 个测试套件、315 项测试通过；admin 类型检查和生产构建通过。

线上 4 个服务的 health/ready、bootstrap、商品目录和 admin 页面均为 200；匿名 POST /admin/products/export-jobs 返回 401，确认新路由已部署并保持鉴权。通过队列创建了一次仅匹配随机不存在关键字的空结果部署验证任务，ID 为 `31925e51-f665-4668-afd5-36ab2439ffcf`：SUCCEEDED、0 行；公网下载为 200，6280 字节，确认包含六列三级名称/值及 Product ID、SKU ID、Product Status。该任务不修改商品或订单；部署前后商品 11 条、订单 63 条。

可检查 `/var/www/tmo-admin/version.json`、发布目录 deployment.json，以及实际镜像 `org.opencontainers.image.revision`。容器启动与重建详细日志保存在备份目录的私有 deploy.log/repair.log，可能包含运行参数，不应直接粘贴到公开日志。

## 回滚

备份目录 rollback-compose.json 包含原 commerce/网关镜像与保留的支付配置，文件不可公开。按依赖顺序重建服务后核对实际镜像，再从备份 admin-web.tar.gz 恢复静态页面，执行 prod-ecs-smoke.sh。新增 product_export_jobs 表是加法迁移，应用回滚时保留它；不要为了应用回滚恢复整库并丢失发布后的业务记录。数据库 dump 用于独立的灾难恢复流程。
