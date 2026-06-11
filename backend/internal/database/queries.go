package database

import (
	"database/sql"
	"time"

	"hr-onboarding/internal/models"

	"github.com/google/uuid"
)

func GetUserByUsername(username string) (*models.User, error) {
	var u models.User
	var createdAt []byte
	err := DB.QueryRow(
		"SELECT id, username, name, role, password, created_at FROM users WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.Password, &createdAt)
	if err != nil {
		return nil, err
	}
	u.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdAt))
	return &u, nil
}

func GetUserByID(id string) (*models.User, error) {
	var u models.User
	var createdAt []byte
	err := DB.QueryRow(
		"SELECT id, username, name, role, password, created_at FROM users WHERE id = ?",
		id,
	).Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.Password, &createdAt)
	if err != nil {
		return nil, err
	}
	u.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdAt))
	return &u, nil
}

func GetOrderByID(id string) (*models.OnboardingOrder, error) {
	var o models.OnboardingOrder
	var dueDate, createdAt, updatedAt []byte
	var handlerID, handlerName, exceptionReason sql.NullString
	var isException int

	err := DB.QueryRow(`
		SELECT id, title, candidate_name, position, department, status, current_node,
		       current_role, handler_id, handler_name, registrar_id, registrar_name,
		       due_date, warning_level, version, is_exception, exception_reason,
		       remark, created_at, updated_at
		FROM onboarding_orders WHERE id = ?
	`, id).Scan(
		&o.ID, &o.Title, &o.CandidateName, &o.Position, &o.Department,
		&o.Status, &o.CurrentNode, &o.CurrentRole,
		&handlerID, &handlerName,
		&o.RegistrarID, &o.RegistrarName,
		&dueDate, &o.WarningLevel, &o.Version, &isException, &exceptionReason,
		&o.Remark, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	if handlerID.Valid {
		o.HandlerID = handlerID.String
	}
	if handlerName.Valid {
		o.HandlerName = handlerName.String
	}
	o.IsException = isException == 1
	if exceptionReason.Valid {
		o.ExceptionReason = exceptionReason.String
	}

	o.DueDate, _ = time.Parse("2006-01-02 15:04:05", string(dueDate))
	o.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdAt))
	o.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", string(updatedAt))

	return &o, nil
}

func ListOrders(role, status, node, search string) ([]*models.OnboardingOrder, error) {
	query := `
		SELECT id, title, candidate_name, position, department, status, current_node,
		       current_role, handler_id, handler_name, registrar_id, registrar_name,
		       due_date, warning_level, version, is_exception, exception_reason,
		       remark, created_at, updated_at
		FROM onboarding_orders WHERE 1=1
	`
	args := []interface{}{}
	argIdx := 1

	if role != "" {
		query += " AND current_role = ?"
		args = append(args, role)
		argIdx++
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
		argIdx++
	}
	if node != "" {
		query += " AND current_node = ?"
		args = append(args, node)
		argIdx++
	}
	if search != "" {
		query += " AND (title LIKE ? OR candidate_name LIKE ?)"
		args = append(args, "%"+search+"%", "%"+search+"%")
		argIdx += 2
	}

	query += " ORDER BY created_at DESC"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.OnboardingOrder
	for rows.Next() {
		var o models.OnboardingOrder
		var dueDate, createdAt, updatedAt []byte
		var handlerID, handlerName, exceptionReason sql.NullString
		var isException int

		err := rows.Scan(
			&o.ID, &o.Title, &o.CandidateName, &o.Position, &o.Department,
			&o.Status, &o.CurrentNode, &o.CurrentRole,
			&handlerID, &handlerName,
			&o.RegistrarID, &o.RegistrarName,
			&dueDate, &o.WarningLevel, &o.Version, &isException, &exceptionReason,
			&o.Remark, &createdAt, &updatedAt,
		)
		if err != nil {
			return nil, err
		}

		if handlerID.Valid {
			o.HandlerID = handlerID.String
		}
		if handlerName.Valid {
			o.HandlerName = handlerName.String
		}
		o.IsException = isException == 1
		if exceptionReason.Valid {
			o.ExceptionReason = exceptionReason.String
		}

		o.DueDate, _ = time.Parse("2006-01-02 15:04:05", string(dueDate))
		o.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdAt))
		o.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", string(updatedAt))
		orders = append(orders, &o)
	}
	return orders, nil
}

func UpdateOrder(o *models.OnboardingOrder) error {
	_, err := DB.Exec(`
		UPDATE onboarding_orders SET
			title = ?, candidate_name = ?, position = ?, department = ?,
			status = ?, current_node = ?, current_role = ?,
			handler_id = ?, handler_name = ?,
			due_date = ?, warning_level = ?, version = ?,
			is_exception = ?, exception_reason = ?, remark = ?,
			updated_at = ?
		WHERE id = ?
	`,
		o.Title, o.CandidateName, o.Position, o.Department,
		o.Status, o.CurrentNode, o.CurrentRole,
		o.HandlerID, o.HandlerName,
		o.DueDate, o.WarningLevel, o.Version,
		o.IsException, o.ExceptionReason, o.Remark,
		time.Now(), o.ID,
	)
	return err
}

func GetAttachmentsByOrder(orderID string) ([]*models.Attachment, error) {
	rows, err := DB.Query(`
		SELECT id, order_id, node, type, name, url, uploaded_by, created_at
		FROM attachments WHERE order_id = ? ORDER BY created_at
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []*models.Attachment
	for rows.Next() {
		var a models.Attachment
		var createdAt []byte
		err := rows.Scan(&a.ID, &a.OrderID, &a.Node, &a.Type, &a.Name, &a.URL, &a.UploadedBy, &createdAt)
		if err != nil {
			return nil, err
		}
		a.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdAt))
		attachments = append(attachments, &a)
	}
	return attachments, nil
}

func GetRequiredAttachmentTypes(node string) []string {
	switch node {
	case models.NodeDocs:
		return []string{"id_card", "diploma", "resignation_cert"}
	case models.NodeContract:
		return []string{"offer", "contract"}
	case models.NodeAccount:
		return []string{"system_access", "email_account"}
	default:
		return []string{}
	}
}

func GetProcessRecords(orderID string) ([]*models.ProcessRecord, error) {
	rows, err := DB.Query(`
		SELECT id, order_id, node, action, operator_id, operator_name, operator_role,
		       from_status, to_status, from_node, to_node, remark, exception_type, created_at
		FROM process_records WHERE order_id = ? ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*models.ProcessRecord
	for rows.Next() {
		var r models.ProcessRecord
		var fromStatus, toStatus, fromNode, toNode, remark, exceptionType sql.NullString
		var createdAt []byte
		err := rows.Scan(
			&r.ID, &r.OrderID, &r.Node, &r.Action,
			&r.OperatorID, &r.OperatorName, &r.OperatorRole,
			&fromStatus, &toStatus, &fromNode, &toNode,
			&remark, &exceptionType, &createdAt,
		)
		if err != nil {
			return nil, err
		}
		if fromStatus.Valid {
			r.FromStatus = fromStatus.String
		}
		if toStatus.Valid {
			r.ToStatus = toStatus.String
		}
		if fromNode.Valid {
			r.FromNode = fromNode.String
		}
		if toNode.Valid {
			r.ToNode = toNode.String
		}
		if remark.Valid {
			r.Remark = remark.String
		}
		if exceptionType.Valid {
			r.ExceptionType = exceptionType.String
		}
		r.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdAt))
		records = append(records, &r)
	}
	return records, nil
}

func CreateProcessRecord(r *models.ProcessRecord) error {
	_, err := DB.Exec(`
		INSERT INTO process_records 
		(id, order_id, node, action, operator_id, operator_name, operator_role,
		 from_status, to_status, from_node, to_node, remark, exception_type, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		uuid.New().String(), r.OrderID, r.Node, r.Action,
		r.OperatorID, r.OperatorName, r.OperatorRole,
		r.FromStatus, r.ToStatus, r.FromNode, r.ToNode,
		r.Remark, r.ExceptionType, time.Now(),
	)
	return err
}

func GetAuditNotes(orderID string) ([]*models.AuditNote, error) {
	rows, err := DB.Query(`
		SELECT id, order_id, status_label, content, created_by, created_by_name, created_at
		FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*models.AuditNote
	for rows.Next() {
		var n models.AuditNote
		var createdAt []byte
		err := rows.Scan(&n.ID, &n.OrderID, &n.StatusLabel, &n.Content, &n.CreatedBy, &n.CreatedByName, &createdAt)
		if err != nil {
			return nil, err
		}
		n.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdAt))
		notes = append(notes, &n)
	}
	return notes, nil
}

func CreateAuditNote(n *models.AuditNote) error {
	_, err := DB.Exec(`
		INSERT INTO audit_notes (id, order_id, status_label, content, created_by, created_by_name, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`,
		uuid.New().String(), n.OrderID, n.StatusLabel, n.Content,
		n.CreatedBy, n.CreatedByName, time.Now(),
	)
	return err
}
