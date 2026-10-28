package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"manajemen-puyuh/backend/internal/services"
	"manajemen-puyuh/backend/internal/utils"
)

func (h *Handler) Login(c *gin.Context) {
	var input services.LoginInput
	if !utils.BindJSON(c, &input) {
		return
	}
	result, err := h.Auth.Login(input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, result)
}

func (h *Handler) Me(c *gin.Context) {
	user := currentUser(c)
	if user == nil {
		utils.Fail(c, http.StatusUnauthorized, "sesi tidak valid", nil)
		return
	}
	utils.OK(c, user)
}

func (h *Handler) Logout(c *gin.Context) {
	if user := currentUser(c); user != nil {
		h.Auth.Logout(user.ID)
	}
	utils.OK(c, gin.H{"message": "berhasil keluar"})
}

func (h *Handler) ChangePassword(c *gin.Context) {
	user := currentUser(c)
	var input services.ChangePasswordInput
	if !utils.BindJSON(c, &input) {
		return
	}
	if err := h.Auth.ChangePassword(user.ID, input); err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, gin.H{"message": "kata sandi berhasil diubah"})
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	user := currentUser(c)
	var input services.UpdateProfileInput
	if !utils.BindJSON(c, &input) {
		return
	}
	updated, err := h.Auth.UpdateProfile(user.ID, input)
	if err != nil {
		utils.HandleError(c, err)
		return
	}
	utils.OK(c, updated)
}

func (h *Handler) Health(c *gin.Context) {
	utils.OK(c, gin.H{"status": "ok"})
}
