package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestECSPaymentMountsWechatMerchantPrivateKeyAsReadOnlyBind(t *testing.T) {
	repoRoot := filepath.Clean(filepath.Join("..", "..", "..", ".."))
	compose := readDeploymentFile(t, filepath.Join(repoRoot, "infra", "prod", "docker-compose.ecs.yml"))
	paymentService := composeServiceBlock(t, compose, "payment")

	for _, fragment := range []string{
		"PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH: ${PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH:-/run/secrets/wechat_merchant_private_key.pem}",
		"type: bind",
		"source: ${PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_HOST_PATH:-/dev/null}",
		"target: ${PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH:-/run/secrets/wechat_merchant_private_key.pem}",
		"read_only: true",
		"create_host_path: false",
	} {
		if !strings.Contains(paymentService, fragment) {
			t.Errorf("ECS payment service is missing WeChat private-key bind configuration %q", fragment)
		}
	}
	if strings.Contains(paymentService, "mode: 0400") {
		t.Error("file-backed Compose mounts must not claim that an ignored mode setting secures the private key")
	}
}

func TestECSEnvironmentDocumentsSafeWechatPrivateKeyDefaults(t *testing.T) {
	repoRoot := filepath.Clean(filepath.Join("..", "..", "..", ".."))
	env := readDeploymentFile(t, filepath.Join(repoRoot, "infra", "prod", "env.ecs.example"))

	for _, fragment := range []string{
		"PAYMENT_PROVIDER_MODE=disabled",
		"PAYMENT_ENABLED=false",
		"PAYMENT_WECHAT_PAY_ENABLED=false",
		"PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_HOST_PATH=",
		"PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH=/run/secrets/wechat_merchant_private_key.pem",
		"chown 65534:65534",
		"chmod 0400",
	} {
		if !strings.Contains(env, fragment) {
			t.Errorf("ECS environment example is missing safe WeChat private-key setting %q", fragment)
		}
	}
}

func TestECSUpBuildsImagesAndRejectsUnsafePaymentRuntime(t *testing.T) {
	repoRoot := filepath.Clean(filepath.Join("..", "..", "..", ".."))
	script := readDeploymentFile(t, filepath.Join(repoRoot, "tools", "scripts", "prod-ecs-up.sh"))

	for _, fragment := range []string{
		`PAYMENT_AUTH_ENABLED`,
		`PAYMENT_PROVIDER_MODE`,
		`PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_HOST_PATH`,
		`stat -c "%u:%g"`,
		`stat -c "%a"`,
		`run_compose build identity commerce payment gateway-bff`,
	} {
		if !strings.Contains(script, fragment) {
			t.Errorf("ECS up script is missing production payment/build guard %q", fragment)
		}
	}
}

func composeServiceBlock(t *testing.T, compose, service string) string {
	t.Helper()
	lines := strings.Split(compose, "\n")
	start := -1
	for index, line := range lines {
		if line == "  "+service+":" {
			start = index
			break
		}
	}
	if start < 0 {
		t.Fatalf("service %q is missing from ECS compose", service)
	}

	end := len(lines)
	for index := start + 1; index < len(lines); index++ {
		line := lines[index]
		if strings.HasPrefix(line, "  ") && !strings.HasPrefix(line, "   ") {
			end = index
			break
		}
		if line != "" && !strings.HasPrefix(line, " ") {
			end = index
			break
		}
	}
	return strings.Join(lines[start:end], "\n")
}

func readDeploymentFile(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(content)
}
