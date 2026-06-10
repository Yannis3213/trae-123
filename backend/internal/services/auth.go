package services

import (
	"database/sql"

	"golang.org/x/crypto/bcrypt"
	"workshop-system/internal/database"
	"workshop-system/internal/models"
	"workshop-system/internal/utils"
)

type AuthService struct{}

func NewAuthService() *AuthService {
	return &AuthService{}
}

func (s *AuthService) Login(req *models.LoginRequest) (*models.LoginResponse, error) {
	user := &models.User{}
	err := database.DB.QueryRow(`
		SELECT id, username, password, name, role, created_at
		FROM users WHERE username = ?
	`, req.Username).Scan(&user.ID, &user.Username, &user.Password, &user.Name, &user.Role, &user.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, nil
	}

	token, err := utils.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &models.LoginResponse{
		Token: token,
		User:  user,
	}, nil
}
