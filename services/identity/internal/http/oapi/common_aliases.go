package oapi

import common "github.com/teamdsb/tmo/services/identity/internal/http/oapi/common"

type MiniLoginRequestRole = common.MiniLoginRequestRole
type SalesQrCodePlatform = common.SalesQrCodePlatform
type UserUserType = common.UserUserType
type UserStatus = common.UserStatus

const (
	UserUserTypeCustomer UserUserType = common.Customer
	UserUserTypeStaff    UserUserType = common.Staff
	UserUserTypeAdmin    UserUserType = common.Admin
)
