package config

type Config struct {
	BackendPort  string
	FrontendPort string
	DBPath       string
}

func Load() *Config {
	return &Config{
		BackendPort:  "8105",
		FrontendPort: "3105",
		DBPath:       "./data/trademark.db",
	}
}
