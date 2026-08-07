# 鹬一把 Birdle 🐦

猜北京地区鸟类的 Wordle 式小游戏，灵感来自 [CSGO 弗一把](https://github.com/shnlfriberg/csgofriberg)。

## 玩法

输入鸟名，系统按 **目 / 科 / 体长 / 翼展 / 居留类型 / 栖息地 / 食性 / 保护等级 / 是否中国特有** 逐项给出对比反馈：

- 🟩 绿色 —— 该属性与答案完全一致
- 🟨 黄色 —— 接近（数值相差 ≤20%、集合有交集、保护等级相邻）
- ↑↓ 箭头 —— 数值/等级型属性提示答案更高或更低

保护等级体系可在**设置**中切换（主界面右上角 ⚙）：IUCN 红色名录（LC/NT/VU/EN/CR，默认）或中国国家重点保护（一级/二级/三有/未列入），对新开的对局生效。

**8 次机会**内猜出目标鸟即获胜；随时可以「看答案」——对局立即结束并揭晓，记为失败。

三个难度（答案池累计制，按在北京的罕见程度划分）：

- **简单**：100 种北京常见鸟，适合所有人
- **普通**：200 种（简单池 + 季节性/郊区常见鸟），适合观鸟入门者
- **困难**：全部 435 种（含北京罕见种和迷鸟记录），北京观鸟爱好者挑战

答案由服务端保管，猜完才揭晓；战绩（场次 / 胜率 / 猜测分布 / 连胜）按浏览器本地匿名 ID 记账，无需登录。

## 联机对战（BO3/BO5）

主界面「🆚 联机对战」进入大厅：

1. **创建房间**：选 BO3/BO5 + 难度 + 保护等级体系，生成 5 位房间码
2. **加入房间**：输入房间码加入；满 2 人后自动成为观战者（只看不能猜）
3. **对战**：每局两人猜**同一只鸟**，各自 8 次机会，谁先猜中谁赢该局；都未猜中则流局。先拿到过半局分（BO3 需 2 局、BO5 需 3 局）者赢整场
4. **防窥屏**：对手的猜测只显示颜色块矩阵，不显示鸟名
5. **断线处理**：30 秒内重连自动恢复身份和猜测历史；超时判负，对手直接获胜

实时通信用 Socket.IO，与单机 HTTP API 共用同一端口。房间状态存内存（`RoomStore` 接口预留 Redis 扩展位），全员离开 5 分钟后自动销毁。环境变量：服务端 `CLIENT_ORIGIN`（CORS 白名单，默认 `http://localhost:5173`）、`PORT`；前端 `VITE_SERVER_URL`（默认同源，开发时 `.env.local` 指向 `http://localhost:3001`）。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + TypeScript + Zustand + Socket.IO Client |
| 后端 | Node.js + Express + Socket.IO + TypeScript |
| 数据库 | SQLite（Node 内置 `node:sqlite`，零原生依赖） |
| 测试 | Vitest |

## 快速开始

环境要求：Node.js ≥ 22.5（`node:sqlite`）、pnpm。

```bash
pnpm install
pnpm dev        # server: 3001, client: 5173（vite 代理 /api → 3001）
```

访问 http://localhost:5173 。

常用命令：

```bash
pnpm test       # 运行服务端对比逻辑单测
pnpm build      # 编译前后端
pnpm start      # 生产模式启动（server 托管 client/dist）
```

## 项目结构

```
client/src
├── api.ts            # fetch 封装
├── socket.ts         # Socket.IO 单例
├── store.ts          # 单机对局/主题/设置（Zustand）
├── mpStore.ts        # 联机对战状态（Zustand）
├── components/       # GuessGrid / SearchBox / BirdCard / mp/Lobby / mp/MpRoom / ...
└── App.tsx           # 视图切换（home/game/lobby/mproom/stats/settings）

server/src
├── data/birds.json # 鸟类数据集（435 种北京鸟类，含难度与国保标注）
├── game/           # compare.ts 属性对比 / session.ts 单机对局会话与难度池
├── mp/             # 联机对战：store.ts 存储抽象 / room.ts 房间规则 / gateway.ts Socket.IO 事件
├── db.ts           # SQLite 战绩
└── index.ts        # Express 路由 + Socket.IO 接线
```

## API

| 端点 | 说明 |
|---|---|
| `GET /api/birds/search?q=&difficulty=` | 按中文名/拼音/学名模糊搜索（仅返回名称；可限定难度池） |
| `POST /api/game/start` | 开局 `{difficulty: easy/normal/hard, guestId, conservation?: iucn/china}` |
| `POST /api/game/:id/guess` | 提交猜测 `{birdId, guestId}`，返回逐属性反馈 |
| `POST /api/game/:id/reveal` | 看答案：对局结束并揭晓，记为负场 |
| `GET /api/stats?guestId=` | 个人战绩 |

## 鸟类数据

数据集为 **435 种北京地区有野生分布记录**的鸟类（依据《北京鸟类名录》主体，不含纯逃逸/放生归化种与分类存疑记录），字段包括分类（目/科）、体长、翼展、居留类型（按北京状况）、栖息地、食性、IUCN 等级、中国保护等级（2021 国家重点名录 + 2023 三有名录）、是否中国特有，难度按在北京的罕见程度标注（easy 100 / normal 100 / hard 235）。欢迎补充和纠错——直接在 issue 中提出即可。
