package middleware

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"trademark-system/internal/models"

	"github.com/go-chi/chi/v5"
)

type versionBody struct {
	Version int `json:"version"`
}

func VersionCheck(db *sql.DB) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			if id == "" {
				next.ServeHTTP(w, r)
				return
			}

			var currentVersion int
			err := db.QueryRow(`
				SELECT version FROM trademark_applications WHERE id = ?
			`, id).Scan(&currentVersion)
			if err != nil {
				if err == sql.ErrNoRows {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusNotFound)
					json.NewEncoder(w).Encode(models.ApiResponse{
						Code:    404,
						Message: "商标申请单不存在",
					})
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(models.ApiResponse{
					Code:    500,
					Message: "查询版本失败",
				})
				return
			}

			requestVersion := -1

			ifMatch := r.Header.Get("X-If-Match")
			if ifMatch != "" {
				if v, err := strconv.Atoi(ifMatch); err == nil {
					requestVersion = v
				}
			}

			if requestVersion == -1 {
				xVersion := r.Header.Get("X-Version")
				if xVersion != "" {
					if v, err := strconv.Atoi(xVersion); err == nil {
						requestVersion = v
					}
				}
			}

			if requestVersion == -1 {
				body, err := io.ReadAll(r.Body)
				if err == nil {
					var vb versionBody
					if json.Unmarshal(body, &vb) == nil && vb.Version > 0 {
						requestVersion = vb.Version
					}
					r.Body = io.NopCloser(bytes.NewReader(body))
				}
			}

			if requestVersion != -1 && requestVersion != currentVersion {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusConflict)
				json.NewEncoder(w).Encode(models.ApiResponse{
					Code:    409,
					Message: "版本冲突，当前版本为 " + strconv.Itoa(currentVersion) + "，请刷新页面后重试",
				})
				return
			}

			w.Header().Set("X-Version", strconv.Itoa(currentVersion))
			next.ServeHTTP(w, r)
		})
	}
}
