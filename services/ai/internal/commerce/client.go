package commerce

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Client struct {
	baseURL string
	http    *http.Client
}

type RequestError struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *RequestError) Error() string {
	if e == nil {
		return ""
	}
	if e.Code != "" {
		return fmt.Sprintf("commerce request failed: status=%d code=%s", e.StatusCode, e.Code)
	}
	return fmt.Sprintf("commerce request failed: status=%d", e.StatusCode)
}

type errorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type AfterSalesTicket struct {
	ID          uuid.UUID `json:"id"`
	Status      string    `json:"status"`
	Subject     string    `json:"subject"`
	Description string    `json:"description"`
}

type AfterSalesMessage struct {
	ID         uuid.UUID  `json:"id"`
	TicketID   uuid.UUID  `json:"ticketId"`
	SenderType string     `json:"senderType"`
	SenderUser *uuid.UUID `json:"senderUserId"`
	Content    string     `json:"content"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type PagedAfterSalesMessageList struct {
	Items    []AfterSalesMessage `json:"items"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
	Total    int                 `json:"total"`
}

type ProductSummary struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	CategoryID uuid.UUID `json:"categoryId"`
}

type PagedProductList struct {
	Items    []ProductSummary `json:"items"`
	Page     int              `json:"page"`
	PageSize int              `json:"pageSize"`
	Total    int              `json:"total"`
}

type PriceTier struct {
	MinQty       int   `json:"minQty"`
	MaxQty       *int  `json:"maxQty"`
	UnitPriceFen int64 `json:"unitPriceFen"`
}

type SKU struct {
	ID         uuid.UUID         `json:"id"`
	SpuID      uuid.UUID         `json:"spuId"`
	SkuCode    *string           `json:"skuCode"`
	Name       string            `json:"name"`
	Spec       *string           `json:"spec"`
	Attributes map[string]string `json:"attributes"`
	PriceTiers []PriceTier       `json:"priceTiers"`
	Unit       *string           `json:"unit"`
	IsActive   bool              `json:"isActive"`
}

type ProductInfo struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	Description      *string   `json:"description"`
	Images           []string  `json:"images"`
	CategoryID       uuid.UUID `json:"categoryId"`
	FilterDimensions []string  `json:"filterDimensions"`
}

type ProductDetail struct {
	Product ProductInfo `json:"product"`
	SKUs    []SKU       `json:"skus"`
}

func NewClient(baseURL string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &Client{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		http: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) GetAfterSalesTicket(ctx context.Context, authHeader string, ticketID uuid.UUID, requestID string) (AfterSalesTicket, error) {
	var ticket AfterSalesTicket
	err := c.getJSON(ctx, "/after-sales/tickets/"+ticketID.String(), nil, authHeader, requestID, &ticket)
	return ticket, err
}

func (c *Client) ListAfterSalesMessages(ctx context.Context, authHeader string, ticketID uuid.UUID, requestID string) ([]AfterSalesMessage, error) {
	page := 1
	pageSize := 100
	all := make([]AfterSalesMessage, 0, pageSize)

	for {
		var response PagedAfterSalesMessageList
		query := url.Values{}
		query.Set("page", strconv.Itoa(page))
		query.Set("pageSize", strconv.Itoa(pageSize))

		if err := c.getJSON(ctx, "/after-sales/tickets/"+ticketID.String()+"/messages", query, authHeader, requestID, &response); err != nil {
			return nil, err
		}

		all = append(all, response.Items...)
		if len(all) >= response.Total || len(response.Items) == 0 {
			return all, nil
		}
		page++
	}
}

func (c *Client) ListProductsPage(ctx context.Context, page, pageSize int) (PagedProductList, error) {
	var response PagedProductList
	query := url.Values{}
	query.Set("page", strconv.Itoa(page))
	query.Set("pageSize", strconv.Itoa(pageSize))
	err := c.getJSON(ctx, "/catalog/products", query, "", "", &response)
	return response, err
}

func (c *Client) GetProductDetail(ctx context.Context, productID uuid.UUID) (ProductDetail, error) {
	var detail ProductDetail
	err := c.getJSON(ctx, "/catalog/products/"+productID.String(), nil, "", "", &detail)
	return detail, err
}

func (c *Client) getJSON(ctx context.Context, path string, query url.Values, authHeader, requestID string, target interface{}) error {
	if c.baseURL == "" {
		return fmt.Errorf("commerce base url missing")
	}

	endpoint := c.baseURL + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	if requestID != "" {
		req.Header.Set("X-Request-ID", requestID)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr errorResponse
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return &RequestError{
			StatusCode: resp.StatusCode,
			Code:       apiErr.Code,
			Message:    apiErr.Message,
		}
	}

	return json.NewDecoder(resp.Body).Decode(target)
}
