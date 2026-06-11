package main

import (
	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Post("/login", Login)

	protected := api.Group("/", JWTMiddleware)

	protected.Get("/users/me", GetCurrentUser)

	protected.Get("/orders", GetOrders)
	protected.Get("/orders/:id", GetOrder)
	protected.Post("/orders", CreateOrder)
	protected.Put("/orders/:id/status", UpdateOrderStatus)
	protected.Post("/orders/batch", BatchUpdateStatus)
	protected.Get("/orders/:id/audit-trail", GetAuditTrail)
	protected.Post("/orders/:id/attachments", CreateAttachment)
	protected.Post("/orders/:id/audit-notes", CreateAuditNote)
	protected.Post("/orders/:id/exception-reasons", CreateExceptionReason)

	protected.Get("/statistics", GetStatistics)
}
