use log::{info, error};
use rocket::fairing::Fairing;
use rocket::Build;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

pub fn init_db_pool() -> impl Fairing {
    rocket::fairing::AdHoc::try_on_ignite("DB Pool Init", |rocket| async {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite://data/police_case.db?mode=rwc".into());

        match SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&database_url)
            .await
        {
            Ok(pool) => {
                info!("数据库连接池初始化成功");
                Ok(rocket.manage(pool))
            }
            Err(e) => {
                error!("数据库连接失败: {}", e);
                Err(rocket)
            }
        }
    })
}
