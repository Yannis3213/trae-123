package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	BackendPort   string
	FrontendPort  string
	JWTSecret     string
	SQLitePath    string
	FrontendURL   string
}

func Load() *Config {
	_ = godotenv.Load()

	backendPort := os.Getenv("BACKEND_PORT")
	if backendPort == "" {
		backendPort = "8080"
	}
	frontendPort := os.Getenv("FRONTEND_PORT")
	if frontendPort == "" {
		frontendPort = "3000"
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "cross-border-order-secret-key-2024"
	}
	sqlitePath := os.Getenv("SQLITE_PATH")
	if sqlitePath == "" {
		sqlitePath = "./cross_border.db"
	}

	return &Config{
		BackendPort:  backendPort,
		FrontendPort: frontendPort,
		JWTSecret:    jwtSecret,
		SQLitePath:   sqlitePath,
		FrontendURL:  "http://localhost:" + frontendPort,
	}
}
