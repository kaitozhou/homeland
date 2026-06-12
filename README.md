# 南京建邺区 3D 房产地图

Vite + React + TypeScript 前端项目，用高德 JS API 2.0 展示建邺区 3D 房产地图。

## 本地运行

```bash
npm install
npm run data:validate
npm run dev
```

高德配置从环境变量读取：

```bash
VITE_AMAP_KEY=...
VITE_AMAP_SECURITY_CODE=...
```

本地真实 key 放在 `.env.local`，该文件已被 `.gitignore` 的 `*.local` 规则忽略。

## 数据口径

- 基础地图数据位于 `public/data/jianye-real-estate.json`，保留少量 POI 和人工校验过的示例坐标。
- 建邺区小区候选目录位于 `public/data/jianye-communities-catalog.json` 和 `public/data/jianye-communities-catalog.csv`，当前以用户提供的《建邺区2010年后商品房清单.xlsx》为准，共 67 个商品房小区。
- 质量报告位于 `public/data/data-quality-report.json`。
- 候选目录口径为“2010 年后建成商品房小区”；公寓、安置房、回迁房、经济适用房、商铺、写字楼及清单外小区剔除。
- 小红书校准记录位于 `public/data/xhs-nanjing-community-calibration.json`；每个候选小区都有 `query.status` 与 `query.queried` 标识，完成一次小红书查询后才可从 `todo` 改为 `hit`、`no_hit`、`risk_blocked` 或 `partial`。
- 候选目录内置 `submarket`（片区）、`builtYear`、`publicBuildingType`（Excel 原始建筑类型）、`buildingForm`、`unitPrice` 字段；楼型、建成年份和参考均价优先使用 Excel 清单字段。
- `buildingForm` 仅在公开列表页或详情页明确提供洋房/小高层/高层等住宅形态时填写；未提供时必须为 `null`，并以 `buildingFormStatus` 标记为待补充，不从小区名称、价格、普通住宅等泛化信息中无依据推断。
- `submarket` 是弱化后的粗粒度板块标签，优先按公开板块/公开物业地址归并到江心洲、河西南部、奥体、河西中部、南湖、水西门、应天西路等片区；原始地址保留在 `address`。
- 地图弱化板块概念，不绘制板块边界、不做板块高亮；板块只作为小区信息和筛选字段。
- 小区坐标按需定位：选中小区后优先用高德 JS API `AMap.PlaceSearch` 检索小区 POI，并按名称、建邺区行政区、住宅类 POI 类型评分取最可信坐标；`AMap.Geocoder` 仅作为兜底。结果缓存到本地 `localStorage`。
- 链家/贝壳等详情页出现反自动化拦截时，不绕过反爬；字段不足的小区进入质量报告。
- 当前全量目录以聚汇数据公开分页和详情页为主，合并房天下可公开抓取的小区目录；房天下返回滑块验证时只记录可公开抓取部分。

## 校验

```bash
npm run data:validate
npm run lint
npm run build
```
