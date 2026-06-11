package handlers

import (
	"encoding/json"
	"net/http"

	"hr-onboarding/internal/database"
	"hr-onboarding/internal/middleware"
	"hr-onboarding/internal/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type authHandler struct{}

func NewAuthHandler() *authHandler {
	return &authHandler{}
}

func (h *authHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "请求参数错误", err.Error())
		return
	}

	user, err := database.GetUserByUsername(req.Username)
	if err != nil {
		writeError(w, 401, "登录失败", "用户名或密码错误")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		writeError(w, 401, "登录失败", "用户名或密码错误")
		return
	}

	token, err := middleware.GenerateToken(user)
	if err != nil {
		writeError(w, 500, "生成令牌失败", err.Error())
		return
	}

	user.Password = ""
	writeJSON(w, 200, models.LoginResponse{
		Token: token,
		User:  user,
	})
}

func (h *authHandler) Me(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetCurrentUser(r)
	user.Password = ""
	writeJSON(w, 200, user)
}

func writeJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, code int, message, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(models.ApiError{
		Code:    code,
		Message: message,
		Detail:  detail,
	})
}

func getURLParam(r *http.Request, key string) string {
	return chi.URLParam(r, key)
}
