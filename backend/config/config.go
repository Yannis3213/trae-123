package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	FrontendPort string
	BackendPort  string
	DBPath       string
}

var AppConfig *Config

func LoadConfig() {
	godotenv.Load("../.env")
	godotenv.Load()

	frontendPort := os.Getenv("FRONTEND_PORT")
	if frontendPort == "" {
		frontendPort = "5173"
	}

	backendPort := os.Getenv("BACKEND_PORT")
	if backendPort == "" {
		backendPort = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "data/lease.db"
	}

	AppConfig = &Config{
		FrontendPort: frontendPort,
		BackendPort:  backendPort,
		DBPath:       dbPath,
	}
}

func GetFrontendPort() string {
	if AppConfig != nil {
		return AppConfig.FrontendPort
	}
	return "5173"
}

func GetBackendPort() string {
	if AppConfig != nil {
		return AppConfig.BackendPort
	}
	return "8080"
}

func GetAllowOrigin() string {
	port := GetFrontendPort()
	return "http://localhost:" + port
}

func GetIntEnv(key string, defaultValue int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return defaultValue
	}
	return n
}
