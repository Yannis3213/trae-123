package utils

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"workshop-system/internal/config"
	"workshop-system/internal/models"
)

func JSONResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func ErrorResponse(w http.ResponseWriter, status int, message string) {
	JSONResponse(w, status, map[string]string{"error": message})
}

func GenerateToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"name":     user.Name,
		"role":     user.Role,
		"exp":      time.Now().Add(time.Duration(config.AppConfig.TokenTTL) * time.Second).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.TokenSecret))
}

func ParseToken(tokenString string) (*models.User, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.TokenSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		var userID int64
		switch v := claims["user_id"].(type) {
		case float64:
			userID = int64(v)
		case string:
			userID, _ = strconv.ParseInt(v, 10, 64)
		case int64:
			userID = v
		}
		return &models.User{
			ID:       userID,
			Username: claims["username"].(string),
			Name:     claims["name"].(string),
			Role:     models.Role(claims["role"].(string)),
		}, nil
	}

	return nil, err
}

func GenerateOrderNo() string {
	now := time.Now()
	return "WO" + now.Format("20060102") + strconv.FormatInt(time.Now().UnixNano()%1000, 10)
}

func GetUserFromContext(r *http.Request) *models.User {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		return nil
	}
	return user
}
