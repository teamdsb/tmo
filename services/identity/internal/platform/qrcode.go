package platform

import (
	"encoding/base64"
	"fmt"

	"github.com/skip2/go-qrcode"
)

func generateMockQRCode(scene string) (string, error) {
	payload := fmt.Sprintf("tmo://sales-bind?scene=%s", scene)
	png, err := qrcode.Encode(payload, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}
	return encodePNGDataURL(png), nil
}

func encodePNGDataURL(png []byte) string {
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
}
