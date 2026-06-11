#[macro_use] extern crate rocket;

mod models;
mod db;
mod auth;

use rocket::Request;
use rocket::request::{FromRequest, Outcome};
use rocket::http::Status;
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::Header;
use rocket::{Response, State};
use rocket::serde::json::Json;
use crate::models::*;
use crate::db::Database;
use crate::auth::*;

pub struct Auth(pub User);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for Auth {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_header = request.headers().get_one("Authorization");
        let db = match request.rocket().state::<Database>() {
            Some(db) => db,
            None => return Outcome::Error((Status::InternalServerError, ())),
        };
        let token = match auth_header.and_then(|a| a.strip_prefix("Bearer ")) {
            Some(t) => t,
            None => return Outcome::Error((Status::Unauthorized, ())),
        };
        let parts: Vec<&str> = token.splitn(2, ':').collect();
        if parts.len() != 2 {
            return Outcome::Error((Status::Unauthorized, ()));
        }
        match db.get_user(parts[0]) {
            Some(user) => Outcome::Success(Auth(user)),
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

pub struct CORS;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info { name: "CORS", kind: Kind::Response }
    }

    async fn on_response<'r>(&self, _request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "http://localhost:3109"));
        response.set_header(Header::new("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH"));
        response.set_header(Header::new("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin, X-Requested-With"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
        response.set_header(Header::new("Access-Control-Max-Age", "86400"));
    }
}

#[options("/<_..>")]
fn all_options() -> Status {
    Status::NoContent
}

#[get("/")]
fn index() -> &'static str {
    "Warehouse Backend API - Port 8109"
}

#[post("/api/login", data = "<req>")]
fn login(db: &State<Database>, req: Json<LoginRequest>) -> Json<ApiResponse<LoginResponse>> {
    match db.verify_user(&req.username, &req.password) {
        Some(user) => {
            let token = format!("{}:{}", user.id, user.role.to_str());
            let resp = LoginResponse {
                token,
                user: UserInfo {
                    id: user.id.clone(),
                    username: user.username.clone(),
                    name: user.name.clone(),
                    role: user.role.to_str().to_string(),
                    role_display: user.role.display_name().to_string(),
                },
            };
            Json(ApiResponse::ok(resp))
        }
        None => Json(ApiResponse::err("用户名或密码错误")),
    }
}

#[get("/api/orders?<status>&<urgency>")]
fn list_orders(
    db: &State<Database>,
    auth: Auth,
    status: Option<String>,
    urgency: Option<String>,
) -> Json<ApiResponse<serde_json::Value>> {
    let user = auth.0;
    let mut orders = db.list_orders();

    if let Some(s) = status {
        orders.retain(|o| o.status.to_str() == s);
    }
    if let Some(u) = urgency.as_deref() {
        orders.retain(|o| {
            let g = urgency_for_order(o);
            urgency_display(&g).1 == u
        });
    }

    orders.retain(|o| {
        match user.role {
            Role::WarehouseKeeper => o.current_handler_role == Role::WarehouseKeeper.to_str(),
            Role::WarehouseSupervisor => o.current_handler_role == Role::WarehouseSupervisor.to_str(),
            Role::OperationsManager => true,
        }
    });

    let orders_with_urgency: Vec<serde_json::Value> = orders.iter().map(|o| {
        let g = urgency_for_order(o);
        let (urg_label, urg_key) = urgency_display(&g);
        let mut v = serde_json::to_value(o).unwrap();
        v["urgency"] = serde_json::json!({
            "label": urg_label,
            "key": urg_key
        });
        v["status_display"] = serde_json::json!(o.status.display_name());
        v
    }).collect();

    let grouped = if matches!(user.role, Role::OperationsManager) {
        let normal: Vec<_> = orders_with_urgency.iter().filter(|o| o["urgency"]["key"] == "normal").cloned().collect();
        let near: Vec<_> = orders_with_urgency.iter().filter(|o| o["urgency"]["key"] == "near").cloned().collect();
        let overdue: Vec<_> = orders_with_urgency.iter().filter(|o| o["urgency"]["key"] == "overdue").cloned().collect();
        serde_json::json!({
            "orders": orders_with_urgency,
            "groups": {
                "normal": { "label": "正常", "list": normal },
                "near": { "label": "临期(6小时内)", "list": near },
                "overdue": { "label": "已逾期", "list": overdue },
            },
            "stats": {
                "total": orders_with_urgency.len(),
                "normal": normal.len(),
                "near": near.len(),
                "overdue": overdue.len(),
                "pending": orders_with_urgency.iter().filter(|o| o["status"] == "pending_confirmation").count(),
                "exception": orders_with_urgency.iter().filter(|o| o["status"] == "exception").count(),
                "rechecked": orders_with_urgency.iter().filter(|o| o["status"] == "rechecked").count(),
            }
        })
    } else {
        serde_json::json!({
            "orders": orders_with_urgency,
            "stats": {
                "total": orders_with_urgency.len(),
                "pending": orders_with_urgency.iter().filter(|o| o["status"] == "pending_confirmation").count(),
                "exception": orders_with_urgency.iter().filter(|o| o["status"] == "exception").count(),
                "rechecked": orders_with_urgency.iter().filter(|o| o["status"] == "rechecked").count(),
            }
        })
    };

    Json(ApiResponse::ok(grouped))
}

#[get("/api/orders/<id>")]
fn get_order(
    db: &State<Database>,
    auth: Auth,
    id: &str,
) -> Json<ApiResponse<serde_json::Value>> {
    let user = auth.0;
    let order = match db.get_order(id) {
        Some(o) => o,
        None => return Json(ApiResponse::err("单据不存在")),
    };
    let attachments = db.list_attachments(id);
    let records = db.list_records(id);
    let audit_notes = db.list_audit_notes(id);
    let exceptions = db.list_exceptions(id);

    let g = urgency_for_order(&order);
    let (urg_label, urg_key) = urgency_display(&g);

    let mut actions: Vec<String> = Vec::new();
    if order.current_handler_role == user.role.to_str()
        && order.current_handler_id.as_deref().map(|h| h == user.id).unwrap_or(true)
    {
        match user.role {
            Role::WarehouseKeeper => {
                if order.status == OrderStatus::Exception {
                    actions.push("补正".to_string());
                    actions.push("保存".to_string());
                }
                actions.push("提交".to_string());
                actions.push("保存".to_string());
            }
            Role::WarehouseSupervisor => {
                if order.status == OrderStatus::PendingConfirmation {
                    actions.push("确认通过".to_string());
                }
                actions.push("退回补正".to_string());
            }
            Role::OperationsManager => {
                if order.status == OrderStatus::PendingConfirmation {
                    actions.push("最终确认".to_string());
                }
                actions.push("退回补正".to_string());
            }
        }
    }
    actions.sort();
    actions.dedup();

    let can_edit_modules = order.current_handler_role == user.role.to_str()
        && (order.status == OrderStatus::Exception || matches!(user.role, Role::WarehouseKeeper));

    let result = serde_json::json!({
        "order": {
            "id": order.id,
            "order_no": order.order_no,
            "supplier_name": order.supplier_name,
            "material_name": order.material_name,
            "quantity": order.quantity,
            "status": order.status.to_str(),
            "status_display": order.status.display_name(),
            "version": order.version,
            "current_handler_role": order.current_handler_role,
            "current_handler_id": order.current_handler_id,
            "current_handler_name": order.current_handler_name,
            "deadline": order.deadline,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
            "appointment_evidence": order.appointment_evidence,
            "appointment_complete": order.appointment_complete,
            "inspection_evidence": order.inspection_evidence,
            "inspection_complete": order.inspection_complete,
            "registration_evidence": order.registration_evidence,
            "registration_complete": order.registration_complete,
            "last_opinion": order.last_opinion,
            "last_attachment_id": order.last_attachment_id,
            "last_audit_note": order.last_audit_note,
        },
        "urgency": { "label": urg_label, "key": urg_key },
        "attachments": attachments,
        "processing_records": records,
        "audit_notes": audit_notes,
        "exception_reasons": exceptions,
        "available_actions": actions,
        "can_edit_modules": can_edit_modules,
        "current_user": {
            "id": user.id,
            "name": user.name,
            "role": user.role.to_str(),
            "role_display": user.role.display_name(),
        }
    });
    Json(ApiResponse::ok(result))
}

#[post("/api/orders/process", data = "<req>")]
fn process_order(
    db: &State<Database>,
    auth: Auth,
    req: Json<ProcessOrderRequest>,
) -> Json<ApiResponse<serde_json::Value>> {
    let user = auth.0;
    let mut order = match db.get_order(&req.order_id) {
        Some(o) => o,
        None => return Json(ApiResponse::err("单据不存在")),
    };

    if let Err(msg) = validate_process(db, &order, &req, &user) {
        return Json(ApiResponse::err(&msg));
    }
    if let Err(msg) = apply_process(db, &mut order, &req, &user) {
        return Json(ApiResponse::err(&msg));
    }

    Json(ApiResponse::ok(serde_json::json!({
        "order_id": order.id,
        "new_status": order.status.to_str(),
        "new_version": order.version,
    })))
}

#[post("/api/orders/batch", data = "<req>")]
fn batch_process_orders(
    db: &State<Database>,
    auth: Auth,
    req: Json<BatchProcessRequest>,
) -> Json<ApiResponse<Vec<BatchProcessResultItem>>> {
    let user = auth.0;
    let mut results = Vec::new();
    for sub in &req.orders {
        let order_no = db.get_order(&sub.order_id).map(|o| o.order_no.clone()).unwrap_or_else(|| sub.order_id.clone());
        let mut order = match db.get_order(&sub.order_id) {
            Some(o) => o,
            None => {
                results.push(BatchProcessResultItem {
                    order_id: sub.order_id.clone(),
                    order_no,
                    success: false,
                    message: "单据不存在".to_string(),
                });
                continue;
            }
        };
        if let Err(msg) = validate_process(db, &order, sub, &user) {
            results.push(BatchProcessResultItem {
                order_id: sub.order_id.clone(),
                order_no,
                success: false,
                message: msg,
            });
            continue;
        }
        match apply_process(db, &mut order, sub, &user) {
            Ok(()) => results.push(BatchProcessResultItem {
                order_id: sub.order_id.clone(),
                order_no,
                success: true,
                message: format!("成功执行「{}」，状态更新为「{}」", sub.action, order.status.display_name()),
            }),
            Err(msg) => results.push(BatchProcessResultItem {
                order_id: sub.order_id.clone(),
                order_no,
                success: false,
                message: msg,
            }),
        }
    }
    Json(ApiResponse::ok(results))
}

#[post("/api/orders/<id>/upload", data = "<body>")]
fn upload_attachment(
    db: &State<Database>,
    auth: Auth,
    id: &str,
    body: Json<serde_json::Value>,
) -> Json<ApiResponse<Attachment>> {
    let user = auth.0;
    let filename = body["filename"].as_str().unwrap_or("attachment.pdf").to_string();
    let module = body["module"].as_str().unwrap_or("general").to_string();
    let att = Attachment {
        id: db::new_id(),
        order_id: id.to_string(),
        filename,
        uploaded_by: user.id.clone(),
        uploaded_at: chrono::Utc::now(),
        uploader_role: user.role.to_str().to_string(),
        module,
    };
    db.add_attachment(&att);
    Json(ApiResponse::ok(att))
}

#[launch]
fn rocket() -> _ {
    let db = Database::new("data/warehouse.db");
    db.init_schema();
    db.seed_data();

    rocket::build()
        .attach(CORS)
        .manage(db)
        .mount("/", routes![
            index,
            all_options,
            login,
            list_orders,
            get_order,
            process_order,
            batch_process_orders,
            upload_attachment,
        ])
}
