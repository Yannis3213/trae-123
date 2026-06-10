package auth

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	RealName string `json:"realName"`
	Role     string `json:"role"`
}

type contextKey string

const userContextKey contextKey = "user"

var jwtSecret = []byte("water-biz-secret-key-change-in-production")

func AuthenticateUser(db *sql.DB, username, password string) (*User, error) {
	var user User
	var storedPassword string

	err := db.QueryRow(`
		SELECT id, username, real_name, role, password 
		FROM users WHERE username = ?
	`, username).Scan(&user.ID, &user.Username, &user.RealName, &user.Role, &storedPassword)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if storedPassword != password {
		return nil, errors.New("invalid credentials")
	}

	return &user, nil
}

func GenerateToken(user *User) (string, error) {
	claims := jwt.MapClaims{
		"sub":      user.ID,
		"username": user.Username,
		"realName": user.RealName,
		"role":     user.Role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ValidateToken(tokenString string) (*User, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		user := &User{
			ID:       claims["sub"].(string),
			Username: claims["username"].(string),
			RealName: claims["realName"].(string),
			Role:     claims["role"].(string),
		}
		return user, nil
	}

	return nil, errors.New("invalid token")
}

func GetCurrentUser(r *http.Request) *User {
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok {
		return nil
	}
	return user
}

func SetUserContext(r *http.Request, user *User) *http.Request {
	ctx := context.WithValue(r.Context(), userContextKey, user)
	return r.WithContext(ctx)
}
