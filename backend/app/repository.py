from .database import get_connection


def _row_to_dict(row):
    if row is None:
        return None
    return dict(row)


def _rows_to_dicts(rows):
    return [dict(row) for row in rows]


# ── Users ──

def get_all_users():
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM users")
        return _rows_to_dicts(cursor.fetchall())
    finally:
        conn.close()


def get_user_by_id(user_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return _row_to_dict(cursor.fetchone())
    finally:
        conn.close()


def create_user(user_id, name, role):
    conn = get_connection()
    try:
        conn.execute("INSERT INTO users (id, name, role) VALUES (?, ?, ?)", (user_id, name, role))
        conn.commit()
    finally:
        conn.close()


# ── Repair Orders ──

def get_repair_orders(status=None, handler_role=None, handler_id=None,
                      created_by=None, keyword=None, deadline_group=None,
                      offset=0, limit=20):
    conn = get_connection()
    try:
        conditions = []
        params = []
        if status:
            conditions.append("status = ?")
            params.append(status)
        if handler_role:
            conditions.append("current_handler_role = ?")
            params.append(handler_role)
        if handler_id:
            conditions.append("current_handler_id = ?")
            params.append(handler_id)
        if created_by:
            conditions.append("created_by = ?")
            params.append(created_by)
        if keyword:
            conditions.append("(title LIKE ? OR order_no LIKE ? OR enterprise_name LIKE ?)")
            params.extend([f"%{keyword}%", f"%{keyword}%", f"%{keyword}%"])
        if deadline_group == "normal":
            conditions.append("datetime(deadline) > datetime('now', '+3 days')")
        elif deadline_group == "approaching":
            conditions.append("datetime(deadline) > datetime('now') AND datetime(deadline) <= datetime('now', '+3 days')")
        elif deadline_group == "overdue":
            conditions.append("datetime(deadline) <= datetime('now')")

        where_clause = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        count_sql = f"SELECT COUNT(*) as cnt FROM repair_orders{where_clause}"
        total = conn.execute(count_sql, params).fetchone()["cnt"]

        query_sql = f"SELECT * FROM repair_orders{where_clause} ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = conn.execute(query_sql, params).fetchall()
        return _rows_to_dicts(rows), total
    finally:
        conn.close()


def get_repair_order_by_id(order_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM repair_orders WHERE id = ?", (order_id,))
        return _row_to_dict(cursor.fetchone())
    finally:
        conn.close()


def create_repair_order(data):
    conn = get_connection()
    try:
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        values = list(data.values())
        conn.execute(f"INSERT INTO repair_orders ({columns}) VALUES ({placeholders})", values)
        conn.commit()
    finally:
        conn.close()


def update_repair_order(order_id, data):
    conn = get_connection()
    try:
        set_clause = ", ".join([f"{k} = ?" for k in data.keys()])
        values = list(data.values()) + [order_id]
        conn.execute(f"UPDATE repair_orders SET {set_clause}, updated_at = datetime('now') WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()


def get_all_non_archived_orders():
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM repair_orders WHERE status != 'archived' ORDER BY deadline ASC"
        )
        return _rows_to_dicts(cursor.fetchall())
    finally:
        conn.close()


def get_last_handler_by_role(repair_id, role):
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT handler_id, handler_name FROM processing_records "
            "WHERE repair_id = ? AND handler_role = ? ORDER BY created_at DESC LIMIT 1",
            (repair_id, role),
        )
        return _row_to_dict(cursor.fetchone())
    finally:
        conn.close()


# ── Processing Records ──

def get_processing_records(repair_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM processing_records WHERE repair_id = ? ORDER BY created_at", (repair_id,))
        return _rows_to_dicts(cursor.fetchall())
    finally:
        conn.close()


def create_processing_record(data):
    conn = get_connection()
    try:
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        values = list(data.values())
        conn.execute(f"INSERT INTO processing_records ({columns}) VALUES ({placeholders})", values)
        conn.commit()
    finally:
        conn.close()


# ── Attachments ──

def get_attachments(repair_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM attachments WHERE repair_id = ? ORDER BY uploaded_at", (repair_id,))
        return _rows_to_dicts(cursor.fetchall())
    finally:
        conn.close()


def get_attachment_by_id(attachment_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM attachments WHERE id = ?", (attachment_id,))
        return _row_to_dict(cursor.fetchone())
    finally:
        conn.close()


def count_attachments(repair_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT COUNT(*) as cnt FROM attachments WHERE repair_id = ?", (repair_id,))
        return cursor.fetchone()["cnt"]
    finally:
        conn.close()


def create_attachment(data):
    conn = get_connection()
    try:
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        values = list(data.values())
        conn.execute(f"INSERT INTO attachments ({columns}) VALUES ({placeholders})", values)
        conn.commit()
    finally:
        conn.close()


# ── Audit Notes ──

def get_audit_notes(repair_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM audit_notes WHERE repair_id = ? ORDER BY created_at", (repair_id,))
        return _rows_to_dicts(cursor.fetchall())
    finally:
        conn.close()


def create_audit_note(data):
    conn = get_connection()
    try:
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        values = list(data.values())
        conn.execute(f"INSERT INTO audit_notes ({columns}) VALUES ({placeholders})", values)
        conn.commit()
    finally:
        conn.close()


# ── Exception Reasons ──

def get_exception_reasons(repair_id):
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM exception_reasons WHERE repair_id = ? ORDER BY created_at", (repair_id,))
        return _rows_to_dicts(cursor.fetchall())
    finally:
        conn.close()


def create_exception_reason(data):
    conn = get_connection()
    try:
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        values = list(data.values())
        conn.execute(f"INSERT INTO exception_reasons ({columns}) VALUES ({placeholders})", values)
        conn.commit()
    finally:
        conn.close()
