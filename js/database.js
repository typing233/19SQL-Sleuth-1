const DatabaseManager = {
    db: null,

    async init() {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        this.db = new SQL.Database();
        this.createSchema();
        this.insertData();
        return this.db;
    },

    createSchema() {
        this.db.run(`
            CREATE TABLE persons (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                gender TEXT CHECK(gender IN ('男','女')),
                age INTEGER,
                occupation TEXT,
                address TEXT,
                phone TEXT,
                relationship_notes TEXT
            );

            CREATE TABLE locations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                address TEXT,
                description TEXT
            );

            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                case_id INTEGER NOT NULL,
                event_time TEXT NOT NULL,
                location_id INTEGER REFERENCES locations(id),
                description TEXT,
                event_type TEXT CHECK(event_type IN ('犯罪','目击','活动','通讯','交易'))
            );

            CREATE TABLE evidence (
                id INTEGER PRIMARY KEY,
                case_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('物证','书证','电子数据','证人证言','鉴定意见')),
                description TEXT NOT NULL,
                found_location_id INTEGER REFERENCES locations(id),
                found_time TEXT,
                related_person_id INTEGER REFERENCES persons(id),
                is_red_herring INTEGER DEFAULT 0
            );

            CREATE TABLE communications (
                id INTEGER PRIMARY KEY,
                sender_id INTEGER REFERENCES persons(id),
                receiver_id INTEGER REFERENCES persons(id),
                comm_time TEXT NOT NULL,
                comm_type TEXT CHECK(comm_type IN ('电话','短信','邮件','微信')),
                duration_minutes INTEGER,
                content_summary TEXT
            );

            CREATE TABLE financial_records (
                id INTEGER PRIMARY KEY,
                person_id INTEGER REFERENCES persons(id),
                transaction_time TEXT NOT NULL,
                amount REAL NOT NULL,
                transaction_type TEXT CHECK(transaction_type IN ('转入','转出','现金取款','现金存款','购买')),
                counterparty TEXT,
                description TEXT
            );

            CREATE TABLE alibis (
                id INTEGER PRIMARY KEY,
                person_id INTEGER REFERENCES persons(id),
                case_id INTEGER NOT NULL,
                alibi_time_start TEXT,
                alibi_time_end TEXT,
                alibi_location TEXT,
                witness_id INTEGER REFERENCES persons(id),
                verified INTEGER DEFAULT 0
            );

            CREATE TABLE relationships (
                id INTEGER PRIMARY KEY,
                person1_id INTEGER REFERENCES persons(id),
                person2_id INTEGER REFERENCES persons(id),
                relationship_type TEXT,
                description TEXT,
                since_date TEXT
            );

            CREATE TABLE case_files (
                id INTEGER PRIMARY KEY,
                case_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                summary TEXT,
                victim_id INTEGER REFERENCES persons(id),
                crime_time_estimated TEXT,
                crime_location_id INTEGER REFERENCES locations(id),
                cause_of_death TEXT,
                status TEXT DEFAULT '调查中'
            );

            CREATE TABLE medical_records (
                id INTEGER PRIMARY KEY,
                person_id INTEGER REFERENCES persons(id),
                record_date TEXT,
                hospital TEXT,
                diagnosis TEXT,
                prescription TEXT,
                doctor_id INTEGER REFERENCES persons(id)
            );

            CREATE TABLE surveillance (
                id INTEGER PRIMARY KEY,
                location_id INTEGER REFERENCES locations(id),
                capture_time TEXT,
                person_id INTEGER REFERENCES persons(id),
                description TEXT,
                camera_id TEXT
            );
        `);
    },

    insertData() {
        // === PERSONS (25 people) ===
        this.db.run(`
            INSERT INTO persons VALUES
            (1, '陈雅琴', '女', 68, '退休企业家', '翡翠庄园别墅3号', '138-0001-0001', '翡翠庄园庄主，身家过亿'),
            (2, '陈伟明', '男', 42, '投资经理', '翡翠庄园别墅3号', '138-0001-0002', '陈雅琴长子，争夺遗产'),
            (3, '陈伟华', '男', 38, '自由画家', '城西艺术公寓B栋', '138-0001-0003', '陈雅琴次子，经济困难'),
            (4, '林美玲', '女', 40, '全职太太', '翡翠庄园别墅3号', '138-0001-0004', '陈伟明之妻，野心勃勃'),
            (5, '赵护士', '女', 35, '私人护士', '翡翠庄园别墅3号', '138-0001-0005', '照顾陈雅琴三年'),
            (6, '王管家', '男', 55, '管家', '翡翠庄园别墅3号', '138-0001-0006', '服务陈家20年'),
            (7, '刘律师', '男', 50, '律师', '中心城区法律大厦', '138-0001-0007', '陈家遗嘱执行人'),
            (8, '张德海', '男', 45, '码头仓库主管', '港口路88号', '138-0002-0001', '受害者，码头毒杀案'),
            (9, '李强', '男', 38, '仓库保安', '港口路附近出租屋', '138-0002-0002', '张德海下属'),
            (10, '周小燕', '女', 32, '会计', '城东花园小区', '138-0002-0003', '码头公司会计'),
            (11, '马海涛', '男', 48, '走私商人', '不详', '138-0002-0004', '有前科，与张德海有往来'),
            (12, '孙丽丽', '女', 28, '张德海情人', '滨江公寓', '138-0002-0005', '秘密关系'),
            (13, '吴胖子', '男', 50, '码头工人头目', '港口宿舍区', '138-0002-0006', '与张德海有矛盾'),
            (14, '黄医生', '男', 52, '主任医师', '市中心医院', '138-0003-0001', '医院投毒案关键人物'),
            (15, '杨护士长', '女', 45, '护士长', '医院宿舍', '138-0003-0002', '内科护士长'),
            (16, '钱进', '男', 35, '药剂师', '城南药城', '138-0003-0003', '医院药房负责人'),
            (17, '郑小梅', '女', 26, '实习护士', '大学宿舍', '138-0003-0004', '刚入职三个月'),
            (18, '何建国', '男', 60, '退休干部', '市中心医院住院部', '138-0003-0005', '第一位受害者'),
            (19, '徐阿姨', '女', 58, '退休教师', '市中心医院住院部', '138-0003-0006', '第二位受害者'),
            (20, '冯院长', '男', 56, '院长', '医院行政楼', '138-0003-0007', '试图压制事件'),
            (21, '陈雅琴外甥女', '女', 30, '记者', '城中公寓', '138-0001-0008', '调查翡翠庄园'),
            (22, '老张', '男', 62, '退休码头工人', '港口路', '138-0002-0007', '目击证人'),
            (23, '快递员小李', '男', 24, '快递员', '不详', '138-0003-0008', '送过可疑包裹'),
            (24, '保险经纪人', '男', 44, '保险公司', '金融大厦', '138-0001-0009', '处理陈家保单'),
            (25, '毒理专家', '男', 47, '法医', '市公安局', '138-0003-0009', '参与鉴定');
        `);

        // === LOCATIONS (12 locations) ===
        this.db.run(`
            INSERT INTO locations VALUES
            (1, '翡翠庄园别墅3号', '住宅', '翡翠庄园内', '陈雅琴私人别墅，三层建筑'),
            (2, '翡翠庄园花园', '户外', '翡翠庄园内', '庄园中心花园，有监控'),
            (3, '港口18号仓库', '仓库', '港口路88号', '张德海管理的仓库'),
            (4, '码头办公室', '办公', '港口路90号', '码头行政办公区域'),
            (5, '市中心医院内科', '医院', '人民路100号', '住院部三楼内科病房'),
            (6, '医院药房', '医院', '人民路100号', '一楼药房'),
            (7, '城西茶楼', '餐饮', '城西路55号', '常见会面地点'),
            (8, '滨江公园', '户外', '滨江路', '靠近码头区域'),
            (9, '法律事务所', '办公', '中心城区法律大厦5楼', '刘律师工作地点'),
            (10, '翡翠庄园门卫室', '安保', '翡翠庄园入口', '进出登记处'),
            (11, '医院停车场', '户外', '人民路100号后方', '地下停车场'),
            (12, '港口码头区', '工业', '港口路', '货运码头');
        `);

        // === CASE FILES (3 cases) ===
        this.db.run(`
            INSERT INTO case_files VALUES
            (1, 1, '翡翠庄园谋杀案', '富豪陈雅琴在家中被发现死亡，初判为心脏病发作，但毒理检测发现异常', 1, '2024-03-15 22:00-23:00', 1, '氰化物中毒伪装心脏病发', '调查中'),
            (2, 2, '码头仓库毒杀案', '仓库主管张德海在巡查仓库时中毒身亡，现场有异常化学品痕迹', 8, '2024-03-18 20:30-21:30', 3, '有机磷中毒', '调查中'),
            (3, 3, '医院连环投毒案', '市中心医院内科病房两名患者在一周内相继死亡，疑似药物被掺入毒物', 18, '2024-03-10 至 2024-03-17', 5, '药物超量与毒物复合', '调查中');
        `);

        // === EVENTS (30 events) ===
        this.db.run(`
            INSERT INTO events VALUES
            (1, 1, '2024-03-15 18:00', 1, '陈雅琴在家中用晚餐，赵护士在场', '活动'),
            (2, 1, '2024-03-15 19:30', 1, '陈伟明与林美玲到访翡翠庄园', '活动'),
            (3, 1, '2024-03-15 20:00', 1, '全家在客厅喝茶聊天', '活动'),
            (4, 1, '2024-03-15 21:30', 1, '陈雅琴称身体不适回房休息', '活动'),
            (5, 1, '2024-03-15 22:45', 1, '赵护士发现陈雅琴倒在卧室地板上', '犯罪'),
            (6, 1, '2024-03-15 23:10', 1, '急救人员到达，确认死亡', '犯罪'),
            (7, 1, '2024-03-14 10:00', 9, '林美玲在刘律师事务所询问遗嘱内容', '活动'),
            (8, 1, '2024-03-13 15:00', 7, '陈伟华在茶楼与不明人士会面', '活动'),
            (9, 2, '2024-03-18 19:00', 3, '张德海独自进入18号仓库巡查', '活动'),
            (10, 2, '2024-03-18 20:00', 3, '仓库监控显示有人从后门进入', '目击'),
            (11, 2, '2024-03-18 21:15', 3, '李强发现张德海倒在仓库内', '犯罪'),
            (12, 2, '2024-03-18 17:30', 4, '周小燕与张德海在办公室发生争执', '活动'),
            (13, 2, '2024-03-17 22:00', 8, '马海涛在滨江公园与张德海密会', '活动'),
            (14, 2, '2024-03-18 18:30', 12, '老张在码头区看到可疑车辆', '目击'),
            (15, 3, '2024-03-10 06:00', 5, '何建国在输液后出现严重不适', '犯罪'),
            (16, 3, '2024-03-10 07:30', 5, '何建国经抢救无效死亡', '犯罪'),
            (17, 3, '2024-03-17 05:30', 5, '徐阿姨在服药后昏迷', '犯罪'),
            (18, 3, '2024-03-17 09:00', 5, '徐阿姨死亡', '犯罪'),
            (19, 3, '2024-03-09 23:00', 6, '药房门禁记录显示钱进深夜进入', '活动'),
            (20, 3, '2024-03-16 22:30', 6, '药房门禁记录显示钱进再次深夜进入', '活动'),
            (21, 1, '2024-03-10 09:00', 9, '陈雅琴修改遗嘱，大幅削减陈伟明继承份额', '交易'),
            (22, 1, '2024-03-15 14:00', 1, '快递送达一个包裹给赵护士', '活动'),
            (23, 2, '2024-03-16 10:00', 4, '周小燕发现账目有大额资金缺口', '活动'),
            (24, 2, '2024-03-18 15:00', 3, '有人在仓库放置了化学品容器', '活动'),
            (25, 3, '2024-03-08 14:00', 5, '黄医生给何建国更改了用药方案', '活动'),
            (26, 3, '2024-03-15 16:00', 5, '黄医生给徐阿姨调整了用药剂量', '活动'),
            (27, 1, '2024-03-15 20:30', 1, '林美玲独自去厨房泡茶', '活动'),
            (28, 2, '2024-03-18 19:45', 12, '吴胖子在码头区与工人喝酒', '活动'),
            (29, 3, '2024-03-11 10:00', 5, '冯院长指示不要对外公布何建国死因', '活动'),
            (30, 1, '2024-03-12 11:00', 7, '陈伟明在茶楼与保险经纪人见面', '交易');
        `);

        // === EVIDENCE (28 items) ===
        this.db.run(`
            INSERT INTO evidence VALUES
            (1, 1, '鉴定意见', '死者体内检出微量氰化钾', 1, '2024-03-16 10:00', 1, 0),
            (2, 1, '物证', '死者茶杯中残留异常物质', 1, '2024-03-16 08:00', NULL, 0),
            (3, 1, '物证', '厨房垃圾桶发现可疑粉末包装残片', 1, '2024-03-16 09:00', NULL, 0),
            (4, 1, '电子数据', '林美玲手机搜索记录含"氰化物 致死量 无色无味"', NULL, '2024-03-17 14:00', 4, 0),
            (5, 1, '书证', '陈雅琴新遗嘱：80%遗产给慈善基金', 9, '2024-03-10', 1, 0),
            (6, 1, '物证', '陈伟华画室发现有毒颜料（砷化物）', NULL, '2024-03-17', 3, 1),
            (7, 1, '证人证言', '王管家证实林美玲当晚独自去厨房超过10分钟', 1, '2024-03-16', 6, 0),
            (8, 1, '电子数据', '门卫监控显示陈伟华当晚未进入庄园', 10, '2024-03-15', NULL, 0),
            (9, 2, '鉴定意见', '死者体内检出高浓度有机磷农药成分', 3, '2024-03-19 10:00', 8, 0),
            (10, 2, '物证', '仓库发现半空农药瓶，瓶上有指纹', 3, '2024-03-19 08:00', NULL, 0),
            (11, 2, '电子数据', '仓库后门监控模糊影像，身材与周小燕相似', 3, '2024-03-18 20:00', NULL, 0),
            (12, 2, '物证', '张德海办公桌发现威胁信：还钱否则后果自负', 4, '2024-03-19', 8, 1),
            (13, 2, '书证', '公司账目显示张德海挪用公款180万元', 4, '2024-03-19', 10, 0),
            (14, 2, '证人证言', '老张证实18:30看到一辆深色轿车停在仓库后方', 12, '2024-03-19', 22, 0),
            (15, 2, '物证', '农药瓶上指纹鉴定为周小燕', 3, '2024-03-20', 10, 0),
            (16, 2, '电子数据', '周小燕购买同型号农药的网购记录', NULL, '2024-03-20', 10, 0),
            (17, 3, '鉴定意见', '何建国输液袋中检出超量钾离子', 5, '2024-03-11', 18, 0),
            (18, 3, '鉴定意见', '徐阿姨药物中被掺入了过量强心苷', 5, '2024-03-18', 19, 0),
            (19, 3, '电子数据', '药房门禁系统记录钱进非工作时间两次进入', 6, '2024-03-20', 16, 0),
            (20, 3, '物证', '钱进储物柜发现浓缩氯化钾溶液', 6, '2024-03-21', 16, 0),
            (21, 3, '书证', '黄医生开具的用药调整单存在违规操作', 5, '2024-03-20', 14, 1),
            (22, 3, '证人证言', '郑小梅证实钱进曾在深夜进入病房取药瓶', 5, '2024-03-20', 17, 0),
            (23, 3, '电子数据', '钱进与一个境外赌博网站有频繁交易记录', NULL, '2024-03-21', 16, 0),
            (24, 3, '书证', '何建国家属曾向医院索赔但被驳回', 5, '2024-03-12', 18, 1),
            (25, 1, '证人证言', '赵护士称当晚茶水由林美玲亲自端给陈雅琴', 1, '2024-03-16', 5, 0),
            (26, 2, '物证', '吴胖子身上有与张德海打架留下的伤痕', NULL, '2024-03-19', 13, 1),
            (27, 3, '证人证言', '杨护士长确认何建国和徐阿姨都是钱进负责配药', 5, '2024-03-20', 15, 0),
            (28, 1, '书证', '保险公司记录陈伟明为陈雅琴投保2000万意外险', NULL, '2024-03-17', 2, 0);
        `);

        // === COMMUNICATIONS (25 records) ===
        this.db.run(`
            INSERT INTO communications VALUES
            (1, 4, 7, '2024-03-14 09:30', '电话', 15, '林美玲询问遗嘱修改的法律效力'),
            (2, 2, 4, '2024-03-14 12:00', '微信', NULL, '陈伟明: 老太婆真改遗嘱了？'),
            (3, 4, 2, '2024-03-14 12:05', '微信', NULL, '林美玲: 是的 80%给慈善 我们只剩10%'),
            (4, 4, 2, '2024-03-14 12:10', '微信', NULL, '陈伟明: 必须在公证前阻止'),
            (5, 2, 24, '2024-03-12 14:00', '电话', 20, '讨论保险理赔条件和金额'),
            (6, 3, 1, '2024-03-13 10:00', '电话', 5, '陈伟华向母亲借钱被拒'),
            (7, 11, 8, '2024-03-17 20:00', '电话', 8, '马海涛催促张德海交付货物'),
            (8, 10, 8, '2024-03-18 16:00', '短信', NULL, '周小燕: 账上少了180万 必须给我解释'),
            (9, 8, 10, '2024-03-18 16:30', '短信', NULL, '张德海: 你少管闲事 否则一起完蛋'),
            (10, 10, 12, '2024-03-18 17:00', '电话', 3, '周小燕向孙丽丽确认张德海行踪'),
            (11, 16, 14, '2024-03-09 21:00', '微信', NULL, '钱进: 黄主任 何建国的药我按新方案配好了'),
            (12, 14, 16, '2024-03-09 21:10', '微信', NULL, '黄医生: 好的 注意剂量'),
            (13, 16, 20, '2024-03-11 08:00', '电话', 5, '钱进向冯院长汇报何建国死亡'),
            (14, 20, 15, '2024-03-11 08:30', '电话', 3, '冯院长指示杨护士长控制消息'),
            (15, 4, 2, '2024-03-15 13:00', '微信', NULL, '林美玲: 今晚去庄园 最后的机会'),
            (16, 2, 4, '2024-03-15 13:05', '微信', NULL, '陈伟明: 劝不动就算了别冲动'),
            (17, 4, 2, '2024-03-15 13:10', '微信', NULL, '林美玲: 我自有办法'),
            (18, 10, 9, '2024-03-18 19:30', '电话', 2, '周小燕确认张德海是否在仓库'),
            (19, 13, 8, '2024-03-16 12:00', '短信', NULL, '吴胖子: 你欠兄弟们的工钱该结了'),
            (20, 8, 13, '2024-03-16 12:30', '短信', NULL, '张德海: 月底结 别催'),
            (21, 16, 11, '2024-03-15 23:00', '微信', NULL, '钱进与境外号码通话记录(疑似赌博代理)'),
            (22, 5, 21, '2024-03-16 11:00', '电话', 10, '赵护士向陈雅琴外甥女透露陈家内部纠纷'),
            (23, 21, 7, '2024-03-16 14:00', '电话', 8, '外甥女向刘律师确认遗嘱内容'),
            (24, 17, 15, '2024-03-17 06:00', '电话', 3, '郑小梅紧急通知杨护士长徐阿姨出事'),
            (25, 11, 10, '2024-03-18 14:00', '电话', 5, '马海涛向周小燕打听张德海资金状况');
        `);

        // === FINANCIAL RECORDS (22 records) ===
        this.db.run(`
            INSERT INTO financial_records VALUES
            (1, 2, '2024-03-12 10:00', 500000, '转出', '永安保险公司', '为陈雅琴缴纳高额意外险保费'),
            (2, 4, '2024-03-13 14:00', 3500, '购买', '化工试剂网店', '网购"实验用氰化钾样品"'),
            (3, 3, '2024-03-01 09:00', -80000, '转出', '债务人张某', '偿还赌债'),
            (4, 3, '2024-03-05 16:00', -50000, '转出', '高利贷', '偿还借款利息'),
            (5, 8, '2024-03-01 09:00', 1800000, '转出', '离岸账户', '转移公司资金'),
            (6, 10, '2024-03-14 11:00', 800, '购买', '农资店', '购买有机磷农药'),
            (7, 10, '2024-03-17 09:00', 200, '购买', '五金店', '购买防护手套和口罩'),
            (8, 16, '2024-03-01 23:00', -30000, '转出', '境外赌博网站', '网络赌博充值'),
            (9, 16, '2024-03-05 22:00', -50000, '转出', '境外赌博网站', '网络赌博充值'),
            (10, 16, '2024-03-08 21:00', -45000, '转出', '境外赌博网站', '网络赌博充值'),
            (11, 16, '2024-03-12 20:00', -80000, '转出', '境外赌博网站', '网络赌博充值'),
            (12, 11, '2024-03-10 10:00', 500000, '转入', '张德海私人账户', '非法交易款项'),
            (13, 1, '2024-03-10 15:00', 5000000, '转出', '阳光慈善基金', '慈善捐款'),
            (14, 20, '2024-03-12 09:00', 200000, '转入', '医药公司', '疑似回扣款项'),
            (15, 14, '2024-03-08 10:00', 150000, '转入', '医药代表', '药品推广费'),
            (16, 4, '2024-03-10 08:00', 2000, '购买', '医学书店', '购买《毒理学手册》'),
            (17, 2, '2024-03-11 15:00', 100000, '转出', '私人侦探事务所', '调查费用'),
            (18, 12, '2024-03-15 10:00', 50000, '转入', '张德海', '给孙丽丽的生活费'),
            (19, 16, '2024-03-14 19:00', 100000, '现金取款', NULL, '大额现金提取'),
            (20, 13, '2024-03-15 09:00', -15000, '转出', '张德海', '归还借款'),
            (21, 10, '2024-03-18 12:00', 5000, '现金取款', NULL, '取现'),
            (22, 9, '2024-03-18 16:00', 20000, '转入', '张德海', '预付工资');
        `);

        // === ALIBIS (18 records) ===
        this.db.run(`
            INSERT INTO alibis VALUES
            (1, 2, 1, '2024-03-15 19:30', '2024-03-15 23:00', '翡翠庄园别墅3号', 4, 1),
            (2, 3, 1, '2024-03-15 19:00', '2024-03-16 01:00', '城西酒吧', NULL, 0),
            (3, 4, 1, '2024-03-15 19:30', '2024-03-15 23:00', '翡翠庄园别墅3号', 2, 1),
            (4, 5, 1, '2024-03-15 18:00', '2024-03-15 22:40', '翡翠庄园别墅3号', 6, 1),
            (5, 6, 1, '2024-03-15 17:00', '2024-03-15 23:30', '翡翠庄园别墅3号', 5, 1),
            (6, 9, 2, '2024-03-18 18:00', '2024-03-18 21:00', '仓库门卫室', NULL, 1),
            (7, 10, 2, '2024-03-18 18:00', '2024-03-18 22:00', '城东花园小区', NULL, 0),
            (8, 11, 2, '2024-03-18 19:00', '2024-03-18 22:00', '某酒店', NULL, 0),
            (9, 13, 2, '2024-03-18 19:00', '2024-03-18 22:30', '码头区工棚', 22, 1),
            (10, 14, 3, '2024-03-10 00:00', '2024-03-10 08:00', '家中', 15, 0),
            (11, 16, 3, '2024-03-09 22:00', '2024-03-10 02:00', '医院药房/值班室', NULL, 0),
            (12, 17, 3, '2024-03-10 00:00', '2024-03-10 06:00', '护士值班室', 15, 1),
            (13, 15, 3, '2024-03-10 00:00', '2024-03-10 06:00', '护士值班室', 17, 1),
            (14, 16, 3, '2024-03-16 21:00', '2024-03-17 01:00', '不详', NULL, 0),
            (15, 12, 2, '2024-03-18 19:00', '2024-03-18 23:00', '滨江公寓', NULL, 0),
            (16, 22, 2, '2024-03-18 18:00', '2024-03-18 19:00', '码头区', NULL, 1),
            (17, 4, 1, '2024-03-15 20:20', '2024-03-15 20:35', '翡翠庄园厨房', NULL, 0),
            (18, 10, 2, '2024-03-18 19:30', '2024-03-18 20:15', '港口18号仓库附近', NULL, 0);
        `);

        // === RELATIONSHIPS (15 records) ===
        this.db.run(`
            INSERT INTO relationships VALUES
            (1, 1, 2, '母子', '陈雅琴是陈伟明的母亲', '1982'),
            (2, 1, 3, '母子', '陈雅琴是陈伟华的母亲', '1986'),
            (3, 2, 4, '夫妻', '陈伟明与林美玲是夫妻', '2010'),
            (4, 1, 5, '雇佣', '陈雅琴雇佣赵护士为私人护士', '2021'),
            (5, 1, 6, '雇佣', '陈雅琴雇佣王管家', '2004'),
            (6, 8, 12, '情人', '张德海与孙丽丽是秘密情人关系', '2023'),
            (7, 8, 10, '同事', '张德海是周小燕的上级', '2019'),
            (8, 8, 13, '矛盾', '吴胖子因工钱问题与张德海有纠纷', '2024'),
            (9, 8, 11, '交易', '张德海帮马海涛在码头周转货物', '2022'),
            (10, 14, 16, '同事', '黄医生经常指定钱进配药', '2020'),
            (11, 15, 17, '上下级', '杨护士长是郑小梅的直属上级', '2024'),
            (12, 18, 19, '病友', '何建国和徐阿姨同住一个病房', '2024-03'),
            (13, 1, 21, '亲属', '陈雅琴外甥女', '1994'),
            (14, 16, 20, '利益', '冯院长为钱进的违规操作提供庇护', '2022'),
            (15, 10, 8, '仇恨', '周小燕因张德海挪用公款威胁她顶罪而怀恨', '2024-03');
        `);

        // === MEDICAL RECORDS (10 records) ===
        this.db.run(`
            INSERT INTO medical_records VALUES
            (1, 1, '2024-03-01', '市中心医院', '高血压、轻度心律不齐', '降压药、抗凝血剂', 14),
            (2, 18, '2024-03-05', '市中心医院', '慢性肾功能不全', '利尿剂、维生素D', 14),
            (3, 19, '2024-03-12', '市中心医院', '心力衰竭', '强心苷类药物、利尿剂', 14),
            (4, 1, '2024-03-08', '市中心医院', '复查，病情稳定', '维持原方案', 14),
            (5, 16, '2024-02-20', '市精神卫生中心', '焦虑症', '抗焦虑药物', NULL),
            (6, 18, '2024-03-08', '市中心医院', '调整用药方案', '新增钾补充剂(高剂量)', 14),
            (7, 19, '2024-03-15', '市中心医院', '调整强心苷剂量', '剂量提高50%', 14),
            (8, 8, '2024-03-10', '港口诊所', '胃炎', '胃药', NULL),
            (9, 3, '2024-02-15', '市精神卫生中心', '抑郁症', '抗抑郁药物', NULL),
            (10, 4, '2024-03-05', '私立医院', '体检正常', NULL, NULL);
        `);

        // === SURVEILLANCE (18 records) ===
        this.db.run(`
            INSERT INTO surveillance VALUES
            (1, 10, '2024-03-15 19:25', 2, '陈伟明驾车进入庄园', 'CAM-GATE-01'),
            (2, 10, '2024-03-15 19:25', 4, '林美玲随车进入庄园', 'CAM-GATE-01'),
            (3, 2, '2024-03-15 20:25', 4, '林美玲从主屋走向厨房方向', 'CAM-GARDEN-02'),
            (4, 2, '2024-03-15 20:35', 4, '林美玲从厨房方向返回主屋', 'CAM-GARDEN-02'),
            (5, 10, '2024-03-15 23:20', 2, '陈伟明驾车离开庄园', 'CAM-GATE-01'),
            (6, 10, '2024-03-15 23:20', 4, '林美玲随车离开庄园', 'CAM-GATE-01'),
            (7, 10, '2024-03-15 00:00', 3, '当日陈伟华无进出记录', 'CAM-GATE-01'),
            (8, 3, '2024-03-18 19:00', 8, '张德海步行进入18号仓库', 'CAM-DOCK-03'),
            (9, 3, '2024-03-18 19:55', NULL, '仓库后门有模糊人影进入（身材中等偏瘦）', 'CAM-DOCK-04'),
            (10, 3, '2024-03-18 20:50', NULL, '仓库后门模糊人影离开', 'CAM-DOCK-04'),
            (11, 12, '2024-03-18 18:30', NULL, '一辆深色本田雅阁停在仓库后方', 'CAM-DOCK-05'),
            (12, 12, '2024-03-18 20:55', NULL, '深色本田雅阁驶离', 'CAM-DOCK-05'),
            (13, 5, '2024-03-09 23:05', 16, '钱进刷卡进入药房', 'CAM-HOSP-01'),
            (14, 5, '2024-03-09 23:45', 16, '钱进离开药房', 'CAM-HOSP-01'),
            (15, 5, '2024-03-16 22:35', 16, '钱进刷卡进入药房', 'CAM-HOSP-01'),
            (16, 5, '2024-03-16 23:20', 16, '钱进携带物品离开药房', 'CAM-HOSP-01'),
            (17, 5, '2024-03-16 23:40', 16, '钱进进入内科病房区域', 'CAM-HOSP-02'),
            (18, 5, '2024-03-16 23:55', 16, '钱进离开内科病房区域', 'CAM-HOSP-02');
        `);
    },

    _stripStrings(sql) {
        return sql.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    },

    _isReadOnly(sql) {
        const stripped = this._stripStrings(sql);
        const upper = stripped.toUpperCase();

        const dmlKeywords = [
            'INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'UPSERT'
        ];
        const ddlKeywords = [
            'DROP', 'CREATE', 'ALTER', 'ATTACH', 'DETACH',
            'PRAGMA', 'VACUUM', 'REINDEX', 'GRANT', 'REVOKE',
            'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE'
        ];

        const allForbidden = [...dmlKeywords, ...ddlKeywords];
        for (const kw of allForbidden) {
            const regex = new RegExp(`\\b${kw}\\b`);
            if (regex.test(upper)) {
                return { safe: false, keyword: kw };
            }
        }
        return { safe: true };
    },

    executeQuery(sql) {
        const trimmed = sql.trim().replace(/;+$/, '').trim();

        if (!trimmed) {
            throw new Error('请输入SQL查询语句。');
        }

        if (trimmed.includes(';')) {
            const parts = trimmed.split(';').filter(s => s.trim());
            if (parts.length > 1) {
                throw new Error('安全限制：不允许执行多条语句。\n请每次只执行一条 SELECT 查询。');
            }
        }

        const upper = this._stripStrings(trimmed).toUpperCase().trim();
        const firstWord = upper.split(/\s+/)[0];
        if (firstWord !== 'SELECT' && firstWord !== 'WITH' && firstWord !== 'EXPLAIN') {
            throw new Error(`安全限制：不允许执行 ${firstWord} 操作。\n本游戏只允许使用 SELECT 查询来调查案件。`);
        }

        const readCheck = this._isReadOnly(trimmed);
        if (!readCheck.safe) {
            throw new Error(`安全限制：不允许执行 ${readCheck.keyword} 操作。\n本游戏只允许使用 SELECT 查询来调查案件。`);
        }

        if (firstWord === 'WITH') {
            const strippedUpper = upper;
            const afterCTE = strippedUpper.replace(/WITH\s+.+?\)\s*/gs, '');
            const cteBody = strippedUpper.split(/\)\s*(?=SELECT\b|INSERT\b|UPDATE\b|DELETE\b)/);
            const lastPart = cteBody[cteBody.length - 1].trim();
            const mainOp = lastPart.split(/\s+/)[0];
            if (mainOp && mainOp !== 'SELECT' && mainOp !== '') {
                throw new Error(`安全限制：WITH 子句只能配合 SELECT 使用。\n检测到不允许的操作: ${mainOp}`);
            }
        }

        try {
            const changesBefore = this.db.getRowsModified();
            const results = this.db.exec(trimmed);
            const changesAfter = this.db.getRowsModified();

            if (changesAfter !== changesBefore) {
                throw new Error('安全限制：该语句试图修改数据，已被阻止。');
            }

            if (results.length === 0) {
                return { columns: [], values: [], rowCount: 0 };
            }
            return {
                columns: results[0].columns,
                values: results[0].values,
                rowCount: results[0].values.length
            };
        } catch (e) {
            if (e.message.includes('安全限制')) {
                throw e;
            }
            let msg = e.message;
            let help = '';

            if (msg.includes('no such table')) {
                const table = msg.match(/no such table: (\w+)/)?.[1];
                help = `表 "${table}" 不存在。\n可用的表：persons, locations, events, evidence, communications, financial_records, alibis, relationships, case_files, medical_records, surveillance\n使用 SELECT name FROM sqlite_master WHERE type='table'; 查看所有表。`;
            } else if (msg.includes('no such column')) {
                help = '列名不存在。请先用 SELECT * FROM 表名 LIMIT 1; 查看表的列名。';
            } else if (msg.includes('syntax error') || msg.includes('near')) {
                help = 'SQL语法错误。请检查关键字拼写、括号匹配和引号使用。';
            } else if (msg.includes('ambiguous column')) {
                help = '列名不明确，多个表含有同名列。请使用 表名.列名 格式指定。';
            }

            throw new Error(`查询错误：${msg}${help ? '\n\n💡 提示：' + help : ''}`);
        }
    },

    getTableInfo() {
        const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        const info = {};
        if (tables.length > 0) {
            tables[0].values.forEach(([tableName]) => {
                const pragma = this.db.exec(`PRAGMA table_info(${tableName})`);
                if (pragma.length > 0) {
                    info[tableName] = pragma[0].values.map(row => ({
                        cid: row[0],
                        name: row[1],
                        type: row[2],
                        notNull: row[3],
                        defaultValue: row[4],
                        pk: row[5]
                    }));
                }
            });
        }
        return info;
    },

    getRecordCount() {
        const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        let total = 0;
        if (tables.length > 0) {
            tables[0].values.forEach(([tableName]) => {
                const count = this.db.exec(`SELECT COUNT(*) FROM ${tableName}`);
                if (count.length > 0) {
                    total += count[0].values[0][0];
                }
            });
        }
        return total;
    }
};
