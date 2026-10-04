package handler

import (
	"errors"
	"strings"

	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func validOrderStatus(status oapi.OrderStatus) bool {
	switch status {
	case oapi.OrderStatusSUBMITTED, oapi.OrderStatusCONFIRMED, oapi.OrderStatusPAYPENDING,
		oapi.OrderStatusPAID, oapi.OrderStatusPAYFAILED, oapi.OrderStatusSHIPPED,
		oapi.OrderStatusDELIVERED, oapi.OrderStatusCANCELLED, oapi.OrderStatusCLOSED:
		return true
	default:
		return false
	}
}

func orderStatusFilters(params oapi.GetOrdersParams) (*string, []string, error) {
	if params.Status != nil && params.Statuses != nil {
		return nil, nil, errors.New("status and statuses are mutually exclusive")
	}
	if params.Status != nil {
		if !validOrderStatus(*params.Status) {
			return nil, nil, errors.New("invalid order status")
		}
		status := string(*params.Status)
		return &status, nil, nil
	}
	if params.Statuses == nil {
		return nil, nil, nil
	}
	if len(*params.Statuses) == 0 || len(*params.Statuses) > 9 {
		return nil, nil, errors.New("statuses must contain between 1 and 9 order states")
	}
	statuses := make([]string, 0, len(*params.Statuses))
	seen := make(map[oapi.OrderStatus]bool)
	count := 0
	for _, group := range *params.Statuses {
		for _, raw := range strings.Split(string(group), ",") {
			count++
			status := oapi.OrderStatus(raw)
			if count > 9 || !validOrderStatus(status) {
				return nil, nil, errors.New("statuses must contain between 1 and 9 valid order states")
			}
			if !seen[status] {
				statuses = append(statuses, string(status))
				seen[status] = true
			}
		}
	}
	return nil, statuses, nil
}
