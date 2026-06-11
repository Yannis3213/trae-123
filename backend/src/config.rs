use std::env;

pub struct Config {
    pub jwt_secret: String,
    pub database_url: String,
    pub backend_port: u16,
}

impl Config {
    pub fn load() -> Self {
        Self {
            jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-key-change-me".into()),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://data/police_case.db?mode=rwc".into()),
            backend_port: env::var("BACKEND_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8107),
        }
    }
}
