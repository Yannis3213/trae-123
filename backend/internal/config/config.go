package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	FrontendPort int
	BackendPort  int
	DBPath       string
	UploadPath   string
	TokenSecret  string
	TokenTTL     int
}

var AppConfig *Config

func Load() error {
	_ = godotenv.Load("../.env")

	frontendPort, _ := strconv.Atoi(getEnv("FRONTEND_PORT", "4200"))
	backendPort, _ := strconv.Atoi(getEnv("BACKEND_PORT", "3000"))
	tokenTTL, _ := strconv.Atoi(getEnv("TOKEN_TTL", "86400"))

	AppConfig = &Config{
		FrontendPort: frontendPort,
		BackendPort:  backendPort,
		DBPath:       getEnv("DB_PATH", "./data/workshop.db"),
		UploadPath:   getEnv("UPLOAD_PATH", "./uploads"),
		TokenSecret:  getEnv("TOKEN_SECRET", "workshop-secret-key-2024"),
		TokenTTL:     tokenTTL,
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
