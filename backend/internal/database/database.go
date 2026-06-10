package database

import (
	"database/sql"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func InitDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	if err := createTables(db); err != nil {
		return nil, err
	}

	return db, nil
}

func createTables(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		real_name TEXT NOT NULL,
		role TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS account_applications (
		id TEXT PRIMARY KEY,
		application_no TEXT UNIQUE NOT NULL,
		applicant_name TEXT NOT NULL,
		id_card TEXT NOT NULL,
		address TEXT NOT NULL,
		phone TEXT NOT NULL,
		water_usage_type TEXT DEFAULT '居民用水',
		status TEXT NOT NULL DEFAULT '待派发',
		current_handler TEXT,
		created_by TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		due_date DATE,
		version INTEGER DEFAULT 1,
		exception_reason TEXT,
		material_status TEXT DEFAULT '待审核',
		meter_no TEXT,
		installation_addr TEXT,
		review_remark TEXT,
		FOREIGN KEY (created_by) REFERENCES users(id),
		FOREIGN KEY (current_handler) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_app_status ON account_applications(status);
	CREATE INDEX IF NOT EXISTS idx_app_due_date ON account_applications(due_date);
	CREATE INDEX IF NOT EXISTS idx_app_handler ON account_applications(current_handler);
	CREATE INDEX IF NOT EXISTS idx_app_creator ON account_applications(created_by);

	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		file_name TEXT NOT NULL,
		file_type TEXT,
		file_size INTEGER DEFAULT 0,
		uploaded_by TEXT NOT NULL,
		uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE,
		FOREIGN KEY (uploaded_by) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_attach_app ON attachments(application_id);

	CREATE TABLE IF NOT EXISTS processing_records (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		node_name TEXT NOT NULL,
		operator TEXT NOT NULL,
		previous_status TEXT NOT NULL,
		new_status TEXT NOT NULL,
		action TEXT NOT NULL,
		remark TEXT,
		exception_reason TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE,
		FOREIGN KEY (operator) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_record_app ON processing_records(application_id);
	CREATE INDEX IF NOT EXISTS idx_record_time ON processing_records(created_at);

	CREATE TABLE IF NOT EXISTS audit_remarks (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		operator TEXT NOT NULL,
		remark TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE,
		FOREIGN KEY (operator) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_remark_app ON audit_remarks(application_id);

	CREATE TABLE IF NOT EXISTS exception_reasons (
		id TEXT PRIMARY KEY,
		application_id TEXT NOT NULL,
		reason_type TEXT NOT NULL,
		description TEXT NOT NULL,
		reported_by TEXT NOT NULL,
		resolved INTEGER DEFAULT 0,
		resolved_by TEXT,
		resolved_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE,
		FOREIGN KEY (reported_by) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_exc_app ON exception_reasons(application_id);

	CREATE TABLE IF NOT EXISTS batch_results (
		id TEXT PRIMARY KEY,
		batch_no TEXT NOT NULL,
		action TEXT NOT NULL,
		operator TEXT NOT NULL,
		application_id TEXT NOT NULL,
		application_no TEXT NOT NULL,
		success INTEGER NOT NULL DEFAULT 0,
		previous_status TEXT,
		new_status TEXT,
		reason TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (operator) REFERENCES users(id),
		FOREIGN KEY (application_id) REFERENCES account_applications(id)
	);

	CREATE INDEX IF NOT EXISTS idx_batch_no ON batch_results(batch_no);
	CREATE INDEX IF NOT EXISTS idx_batch_operator ON batch_results(operator);
	CREATE INDEX IF NOT EXISTS idx_batch_app ON batch_results(application_id);
	CREATE INDEX IF NOT EXISTS idx_batch_time ON batch_results(created_at);
	`

	_, err := db.Exec(schema)
	return err
}

func SeedDemoData(db *sql.DB) error {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count > 0 {
		return nil
	}

	users := []struct {
		ID       string
		Username string
		Password string
		RealName string
		Role     string
	}{
		{"u001", "window1", "123456", "张窗口", "window_staff"},
		{"u002", "window2", "123456", "李窗口", "window_staff"},
		{"u003", "meter1", "123456", "王主管", "meter_supervisor"},
		{"u004", "meter2", "123456", "赵抄表", "meter_supervisor"},
		{"u005", "manager1", "123456", "钱经理", "business_manager"},
	}

	for _, u := range users {
		_, err := db.Exec(`
			INSERT INTO users (id, username, password, real_name, role)
			VALUES (?, ?, ?, ?, ?)
		`, u.ID, u.Username, u.Password, u.RealName, u.Role)
		if err != nil {
			return err
		}
	}

	applications := []struct {
		ID              string
		ApplicationNo   string
		ApplicantName   string
		IDCard          string
		Address         string
		Phone           string
		WaterUsageType  string
		Status          string
		CurrentHandler  *string
		CreatedBy       string
		DueDate         string
		ExceptionReason *string
		MaterialStatus  string
		MeterNo         *string
	}{
		{
			"app001", "KH20250601000001", "陈小明", "310101199001011234",
			"上海市浦东新区张江路888号", "13800138001", "居民用水",
			"待派发", nil, "u001",
			time.Now().AddDate(0, 0, 5).Format("2006-01-02"),
			nil, "待审核", nil,
		},
		{
			"app002", "KH20250602000002", "刘小红", "310101199202022345",
			"上海市徐汇区衡山路123号", "13800138002", "居民用水",
			"处理中", strPtr("u003"), "u001",
			time.Now().AddDate(0, 0, 2).Format("2006-01-02"),
			nil, "审核通过", strPtr("SB-2025-06001"),
		},
		{
			"app003", "KH20250603000003", "周大伟", "310101198503033456",
			"上海市静安区南京西路999号", "13800138003", "商业用水",
			"处理中", strPtr("u003"), "u002",
			time.Now().AddDate(0, 0, -2).Format("2006-01-02"),
			strPtr("用户身份证复印件模糊，需要补充清晰材料"), "退回补正", nil,
		},
		{
			"app004", "KH20250604000004", "吴美丽", "310101199304044567",
			"上海市杨浦区五角场万达广场", "13800138004", "商业用水",
			"处理中", strPtr("u003"), "u001",
			time.Now().AddDate(0, 0, -5).Format("2006-01-02"),
			strPtr("装表现场与地址不符，待核实"), "审核通过", strPtr("SB-2025-06004"),
		},
		{
			"app005", "KH20250605000005", "郑建国", "310101197005055678",
			"上海市虹口区四川北路1688号", "13800138005", "居民用水",
			"已关闭", nil, "u002",
			time.Now().AddDate(0, 0, -10).Format("2006-01-02"),
			nil, "审核通过", strPtr("SB-2025-06005"),
		},
		{
			"app006", "KH20250606000006", "孙丽华", "310101198806066789",
			"上海市长宁区中山公园龙之梦", "13800138006", "商业用水",
			"待派发", nil, "u001",
			time.Now().AddDate(0, 0, 1).Format("2006-01-02"),
			nil, "待审核", nil,
		},
		{
			"app007", "KH20250607000007", "钱卫东", "310101197507077890",
			"上海市普陀区长寿路1118号", "13800138007", "居民用水",
			"处理中", strPtr("u004"), "u002",
			time.Now().AddDate(0, 0, -1).Format("2006-01-02"),
			nil, "审核通过", nil,
		},
		{
			"app008", "KH20250608000008", "冯秀兰", "310101196508088901",
			"上海市宝山区共富新村", "13800138008", "居民用水",
			"处理中", strPtr("u004"), "u001",
			time.Now().AddDate(0, 0, 3).Format("2006-01-02"),
			strPtr("房产证未提供，需补充"), "退回补正", nil,
		},
		{
			"app009", "KH20250609000009", "蒋志强", "310101199009099012",
			"上海市闵行区莘庄地铁站南广场", "13800138009", "居民用水",
			"已关闭", nil, "u002",
			time.Now().AddDate(0, 0, -15).Format("2006-01-02"),
			nil, "审核通过", strPtr("SB-2025-06009"),
		},
		{
			"app010", "KH20250610000010", "韩雪梅", "310101199510100123",
			"上海市松江区大学城文汇路", "13800138010", "居民用水",
			"待派发", nil, "u001",
			time.Now().AddDate(0, 0, 7).Format("2006-01-02"),
			nil, "待审核", nil,
		},
		{
			"app011", "KH20250611000011", "杨海涛", "310101198211111234",
			"上海市嘉定区安亭汽车城", "13800138011", "工业用水",
			"处理中", strPtr("u003"), "u002",
			time.Now().AddDate(0, 0, -3).Format("2006-01-02"),
			nil, "审核通过", strPtr("SB-2025-06011"),
		},
		{
			"app012", "KH20250612000012", "朱晓燕", "310101199112122345",
			"上海市青浦区朱家角古镇", "13800138012", "居民用水",
			"处理中", strPtr("u004"), "u001",
			time.Now().AddDate(0, 0, -7).Format("2006-01-02"),
			strPtr("装表位置存在争议，需用户确认"), "审核通过", strPtr("SB-2025-06012"),
		},
	}

	for _, a := range applications {
		handlerVal := ""
		if a.CurrentHandler != nil {
			handlerVal = *a.CurrentHandler
		}
		excVal := ""
		if a.ExceptionReason != nil {
			excVal = *a.ExceptionReason
		}
		meterVal := ""
		if a.MeterNo != nil {
			meterVal = *a.MeterNo
		}

		_, err := db.Exec(`
			INSERT INTO account_applications 
			(id, application_no, applicant_name, id_card, address, phone, water_usage_type,
			 status, current_handler, created_by, due_date, exception_reason, material_status, meter_no,
			 created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		`, a.ID, a.ApplicationNo, a.ApplicantName, a.IDCard, a.Address, a.Phone,
			a.WaterUsageType, a.Status, handlerVal, a.CreatedBy, a.DueDate, excVal, a.MaterialStatus, meterVal)
		if err != nil {
			return err
		}
	}

	records := []struct {
		ID              string
		ApplicationID   string
		NodeName        string
		Operator        string
		PreviousStatus  string
		NewStatus       string
		Action          string
		Remark          *string
		ExceptionReason *string
	}{
		{"r001", "app001", "用户开户", "u001", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r002", "app002", "用户开户", "u001", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r003", "app002", "资料审核", "u003", "待派发", "处理中", "dispatch", strPtr("派发给王主管处理"), nil},
		{"r004", "app002", "资料审核", "u003", "处理中", "处理中", "material_review", strPtr("资料审核通过"), nil},
		{"r005", "app002", "装表派工", "u003", "处理中", "处理中", "meter_install", strPtr("已派工装表，水表号SB-2025-06001"), nil},
		{"r006", "app003", "用户开户", "u002", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r007", "app003", "资料审核", "u003", "待派发", "处理中", "dispatch", strPtr("派发处理"), nil},
		{"r008", "app003", "资料审核", "u003", "处理中", "处理中", "material_review", strPtr("资料退回补正"), strPtr("身份证复印件模糊")},
		{"r009", "app004", "用户开户", "u001", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r010", "app004", "资料审核", "u003", "待派发", "处理中", "dispatch", strPtr("派发处理"), nil},
		{"r011", "app004", "资料审核", "u003", "处理中", "处理中", "material_review", strPtr("资料审核通过"), nil},
		{"r012", "app004", "装表派工", "u003", "处理中", "处理中", "meter_install", strPtr("装表派工异常"), strPtr("装表现场地址不符")},
		{"r013", "app005", "用户开户", "u002", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r014", "app005", "资料审核", "u003", "待派发", "处理中", "dispatch", strPtr("派发处理"), nil},
		{"r015", "app005", "资料审核", "u003", "处理中", "处理中", "material_review", strPtr("资料审核通过"), nil},
		{"r016", "app005", "装表派工", "u003", "处理中", "处理中", "meter_install", strPtr("装表完成"), nil},
		{"r017", "app005", "营业经理复核", "u005", "处理中", "已关闭", "review_close", strPtr("复核通过，正常关闭"), nil},
		{"r018", "app006", "用户开户", "u001", "", "待派发", "建单", strPtr("临期单据，需尽快派发"), nil},
		{"r019", "app007", "用户开户", "u002", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r020", "app007", "资料审核", "u004", "待派发", "处理中", "dispatch", strPtr("派发给赵抄表"), nil},
		{"r021", "app007", "资料审核", "u004", "处理中", "处理中", "material_review", strPtr("资料审核通过"), nil},
		{"r022", "app008", "用户开户", "u001", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r023", "app008", "资料审核", "u004", "待派发", "处理中", "dispatch", strPtr("派发处理"), nil},
		{"r024", "app008", "资料审核", "u004", "处理中", "处理中", "material_review", strPtr("退回补正"), strPtr("未提供房产证")},
		{"r025", "app009", "用户开户", "u002", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r026", "app009", "资料审核", "u003", "待派发", "处理中", "dispatch", strPtr("派发处理"), nil},
		{"r027", "app009", "资料审核", "u003", "处理中", "处理中", "material_review", strPtr("资料审核通过"), nil},
		{"r028", "app009", "装表派工", "u003", "处理中", "处理中", "meter_install", strPtr("装表完成"), nil},
		{"r029", "app009", "营业经理复核", "u005", "处理中", "已关闭", "review_close", strPtr("正常关闭"), nil},
		{"r030", "app010", "用户开户", "u001", "", "待派发", "建单", strPtr("新开户申请"), nil},
		{"r031", "app011", "用户开户", "u002", "", "待派发", "建单", strPtr("工业用水开户"), nil},
		{"r032", "app011", "资料审核", "u003", "待派发", "处理中", "dispatch", strPtr("派发处理"), nil},
		{"r033", "app011", "资料审核", "u003", "处理中", "处理中", "material_review", strPtr("资料审核通过"), nil},
		{"r034", "app011", "装表派工", "u003", "处理中", "处理中", "meter_install", strPtr("装表完成"), nil},
		{"r035", "app012", "用户开户", "u001", "", "待派发", "建单", strPtr("窗口创建开户申请"), nil},
		{"r036", "app012", "资料审核", "u004", "待派发", "处理中", "dispatch", strPtr("派发处理"), nil},
		{"r037", "app012", "资料审核", "u004", "处理中", "处理中", "material_review", strPtr("资料审核通过"), nil},
		{"r038", "app012", "装表派工", "u004", "处理中", "处理中", "meter_install", strPtr("装表位置争议"), strPtr("装表位置用户有异议")},
	}

	for _, r := range records {
		remarkVal := ""
		if r.Remark != nil {
			remarkVal = *r.Remark
		}
		excVal := ""
		if r.ExceptionReason != nil {
			excVal = *r.ExceptionReason
		}

		_, err := db.Exec(`
			INSERT INTO processing_records
			(id, application_id, node_name, operator, previous_status, new_status, action, remark, exception_reason)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, r.ID, r.ApplicationID, r.NodeName, r.Operator, r.PreviousStatus,
			r.NewStatus, r.Action, remarkVal, excVal)
		if err != nil {
			return err
		}
	}

	exceptionReasons := []struct {
		ID            string
		ApplicationID string
		ReasonType    string
		Description   string
		ReportedBy    string
	}{
		{"e001", "app003", "资料异常", "用户身份证复印件模糊，需要补充清晰材料", "u003"},
		{"e002", "app008", "资料异常", "房产证未提供，需用户补充", "u004"},
		{"e003", "app004", "装表异常", "装表现场与地址不符，待核实地址信息", "u003"},
		{"e004", "app012", "装表异常", "装表位置存在争议，需用户确认具体安装位置", "u004"},
	}

	for _, e := range exceptionReasons {
		_, err := db.Exec(`
			INSERT INTO exception_reasons
			(id, application_id, reason_type, description, reported_by)
			VALUES (?, ?, ?, ?, ?)
		`, e.ID, e.ApplicationID, e.ReasonType, e.Description, e.ReportedBy)
		if err != nil {
			return err
		}
	}

	auditRemarks := []struct {
		ID            string
		ApplicationID string
		Operator      string
		Remark        string
	}{
		{"ar001", "app003", "u003", "已电话联系用户，用户表示本周内会携带身份证原件来营业厅"},
		{"ar002", "app003", "u001", "用户来电询问补正材料需要带哪些原件，已告知"},
		{"ar003", "app004", "u003", "地址核查中，需要联系物业确认具体门牌号码"},
		{"ar004", "app008", "u004", "用户表示房产证在银行抵押，需要一周时间取出"},
		{"ar005", "app012", "u004", "已与用户预约本周五到现场确认装表位置"},
	}

	for _, ar := range auditRemarks {
		_, err := db.Exec(`
			INSERT INTO audit_remarks
			(id, application_id, operator, remark)
			VALUES (?, ?, ?, ?)
		`, ar.ID, ar.ApplicationID, ar.Operator, ar.Remark)
		if err != nil {
			return err
		}
	}

	return nil
}

func strPtr(s string) *string {
	return &s
}
