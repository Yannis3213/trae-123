mod db;
mod error;
mod handlers;
mod models;
mod validators;

use poem::Route;
use poem::get;
use poem::post;
use poem::put;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db = db::init_db("data.db").expect("数据库初始化失败");
    let dedup = handlers::new_dedup_state();

    let app = Route::new()
        .at("/api/inspections", get(handlers::list_inspections).post(handlers::create_inspection))
        .at("/api/inspections/batch-process", post(handlers::batch_process))
        .at("/api/inspections/:id", get(handlers::get_inspection))
        .at("/api/inspections/:id/process", put(handlers::process_inspection))
        .at("/api/inspections/:id/audit-trail", get(handlers::get_audit_trail))
        .at("/api/inspections/:id/attachments", post(handlers::upload_attachment))
        .at("/api/stats", get(handlers::get_stats))
        .at("/api/overdue-queue", get(handlers::get_overdue_queue))
        .with(poem::middleware::Cors::new())
        .data(db)
        .data(dedup);

    tracing::info!("服务器启动在端口 8002");
    poem::Server::new(poem::listener::TcpListener::bind("0.0.0.0:8002"))
        .run(app)
        .await
        .expect("服务器启动失败");
}
