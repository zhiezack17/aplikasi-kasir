"""Backend tests for Iteration 3 - Fonnte WhatsApp integration & Settings."""
import os
import sys
import pytest
import requests

# Ensure backend module is importable for unit-tests of helpers
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://selamat-malam-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def auth_h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def cashier_token():
    r = requests.post(f"{API}/auth/login", json={"username": "kasir", "password": "kasir123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- Unit tests for whatsapp.normalize_phone ----------
class TestNormalizePhone:
    def test_normalize_phone_variants(self):
        from whatsapp import normalize_phone
        assert normalize_phone("0812345") == "62812345"
        assert normalize_phone("628123456") == "628123456"
        assert normalize_phone("+62812") == "62812"
        assert normalize_phone("812345") == "62812345"  # starts with 8
        assert normalize_phone("") == ""
        assert normalize_phone("abc---") == ""
        assert normalize_phone("0812-345-67") == "6281234567"


# ---------- Settings endpoints (RBAC + persistence) ----------
class TestSettings:
    def test_get_settings_admin_ok(self, admin_token):
        r = requests.get(f"{API}/settings", headers=auth_h(admin_token))
        assert r.status_code == 200
        body = r.json()
        for k in ("fonnte_token_set", "fonnte_token_masked", "shop_name"):
            assert k in body
        assert isinstance(body["fonnte_token_set"], bool)

    def test_get_settings_cashier_403(self, cashier_token):
        r = requests.get(f"{API}/settings", headers=auth_h(cashier_token))
        assert r.status_code == 403

    def test_put_settings_cashier_403(self, cashier_token):
        r = requests.put(f"{API}/settings", json={"shop_name": "Hack"}, headers=auth_h(cashier_token))
        assert r.status_code == 403

    def test_put_shop_name_only(self, admin_token):
        r = requests.put(f"{API}/settings", json={"shop_name": "Warung Kopi Test"}, headers=auth_h(admin_token))
        assert r.status_code == 200
        g = requests.get(f"{API}/settings", headers=auth_h(admin_token)).json()
        assert g["shop_name"] == "Warung Kopi Test"

    def test_put_token_persists_and_masks(self, admin_token):
        token = "FONNTE_DUMMY_ABCDEFGHIJ1234567890"
        r = requests.put(f"{API}/settings", json={"fonnte_token": token}, headers=auth_h(admin_token))
        assert r.status_code == 200
        g = requests.get(f"{API}/settings", headers=auth_h(admin_token)).json()
        assert g["fonnte_token_set"] is True
        masked = g["fonnte_token_masked"]
        assert masked.startswith(token[:4])
        assert masked.endswith(token[-4:])
        assert "•" in masked

    def test_test_whatsapp_missing_phone(self, admin_token):
        r = requests.post(f"{API}/settings/test-whatsapp", json={"phone": ""}, headers=auth_h(admin_token))
        assert r.status_code == 400
        assert "Nomor HP" in r.json()["detail"]

    def test_test_whatsapp_invalid_token_returns_502(self, admin_token):
        # After test_put_token_persists_and_masks, a dummy token is stored. Fonnte will reject.
        r = requests.post(f"{API}/settings/test-whatsapp", json={"phone": "081234567890"}, headers=auth_h(admin_token))
        # Should not be 200 because token is fake; should be 502 (fonnte rejection) OR 400 if token cleared
        assert r.status_code in (400, 502), r.text

    def test_clear_token_then_400_missing_token(self, admin_token):
        # Clear token
        r = requests.put(f"{API}/settings", json={"fonnte_token": ""}, headers=auth_h(admin_token))
        assert r.status_code == 200
        g = requests.get(f"{API}/settings", headers=auth_h(admin_token)).json()
        assert g["fonnte_token_set"] is False
        # Test endpoint now should return 400 'Token Fonnte belum disimpan'
        r2 = requests.post(f"{API}/settings/test-whatsapp", json={"phone": "081234567890"}, headers=auth_h(admin_token))
        assert r2.status_code == 400
        assert "Token Fonnte" in r2.json()["detail"]


# ---------- Send reminder endpoint ----------
class TestSendReminder:
    _no_phone_cid = None
    _no_debt_cid = None
    _ok_cid = None

    def test_setup_customers(self, admin_token):
        # Customer A: no phone, has debt scenario won't apply (we test no-phone path)
        a = requests.post(f"{API}/customers", json={"name": "TEST_WA_NoPhone"}, headers=auth_h(admin_token)).json()
        TestSendReminder._no_phone_cid = a["id"]

        # Customer B: has phone, no debt
        b = requests.post(f"{API}/customers", json={"name": "TEST_WA_NoDebt", "phone": "081234567890"}, headers=auth_h(admin_token)).json()
        TestSendReminder._no_debt_cid = b["id"]

        # Customer C: has phone and we'll add debt. Need product first.
        cat = requests.post(f"{API}/categories", json={"name": "TEST_CAT_WA", "icon": "Coffee"}, headers=auth_h(admin_token)).json()
        prod = requests.post(f"{API}/products", json={"name": "TEST_PROD_WA", "price": 10000, "stock": 100, "category_id": cat["id"]}, headers=auth_h(admin_token)).json()
        c = requests.post(f"{API}/customers", json={"name": "TEST_WA_WithDebt", "phone": "081234567890"}, headers=auth_h(admin_token)).json()
        TestSendReminder._ok_cid = c["id"]
        tx = requests.post(f"{API}/transactions", json={
            "items": [{"product_id": prod["id"], "product_name": "x", "price": 10000, "quantity": 1, "subtotal": 10000}],
            "payment_method": "debt",
            "customer_id": c["id"],
        }, headers=auth_h(admin_token))
        assert tx.status_code == 200, tx.text

    def test_reminder_no_phone_400(self, admin_token):
        r = requests.post(f"{API}/customers/{TestSendReminder._no_phone_cid}/send-reminder", headers=auth_h(admin_token))
        assert r.status_code == 400
        assert "No. HP" in r.json()["detail"]

    def test_reminder_no_debt_400(self, admin_token):
        r = requests.post(f"{API}/customers/{TestSendReminder._no_debt_cid}/send-reminder", headers=auth_h(admin_token))
        assert r.status_code == 400
        assert "hutang" in r.json()["detail"].lower()

    def test_reminder_missing_token_friendly_msg(self, admin_token):
        # Make sure token is cleared
        requests.put(f"{API}/settings", json={"fonnte_token": ""}, headers=auth_h(admin_token))
        r = requests.post(f"{API}/customers/{TestSendReminder._ok_cid}/send-reminder", headers=auth_h(admin_token))
        assert r.status_code == 400
        detail = r.json()["detail"]
        assert "Pengaturan" in detail or "Token" in detail or "admin" in detail.lower()

    def test_reminder_unknown_customer_404(self, admin_token):
        r = requests.post(f"{API}/customers/non-existent-id/send-reminder", headers=auth_h(admin_token))
        assert r.status_code == 404


# ---------- Verify debt transaction & pay_debt do NOT fail when token missing ----------
class TestNoTokenDoesNotBreakFlows:
    def test_debt_tx_and_pay_when_token_empty(self, admin_token):
        # Token already cleared. Create product, customer with phone, do debt tx, pay-debt.
        cat = requests.post(f"{API}/categories", json={"name": "TEST_CAT_NTK", "icon": "Coffee"}, headers=auth_h(admin_token)).json()
        prod = requests.post(f"{API}/products", json={"name": "TEST_PROD_NTK", "price": 5000, "stock": 100, "category_id": cat["id"]}, headers=auth_h(admin_token)).json()
        cust = requests.post(f"{API}/customers", json={"name": "TEST_NTK", "phone": "08111000222"}, headers=auth_h(admin_token)).json()

        tx = requests.post(f"{API}/transactions", json={
            "items": [{"product_id": prod["id"], "product_name": "x", "price": 5000, "quantity": 1, "subtotal": 5000}],
            "payment_method": "debt",
            "customer_id": cust["id"],
        }, headers=auth_h(admin_token))
        assert tx.status_code == 200, tx.text  # Background task should not raise

        # Pay debt
        debt_amt = requests.get(f"{API}/customers/{cust['id']}", headers=auth_h(admin_token)).json()["debt"]
        pay = requests.post(f"{API}/customers/{cust['id']}/pay-debt", json={"amount": debt_amt, "method": "cash"}, headers=auth_h(admin_token))
        assert pay.status_code == 200, pay.text


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup(request, admin_token):
    yield
    try:
        # Reset token to empty for clean prod state
        requests.put(f"{API}/settings", json={"fonnte_token": "", "shop_name": "Warung Kopi"}, headers=auth_h(admin_token))
        custs = requests.get(f"{API}/customers", headers=auth_h(admin_token)).json()
        for c in custs:
            if c["name"].startswith("TEST_"):
                if c.get("debt", 0) > 0:
                    requests.post(f"{API}/customers/{c['id']}/pay-debt", json={"amount": c["debt"], "method": "cash"}, headers=auth_h(admin_token))
                requests.delete(f"{API}/customers/{c['id']}", headers=auth_h(admin_token))
        prods = requests.get(f"{API}/products", headers=auth_h(admin_token)).json()
        for p in prods:
            if p["name"].startswith("TEST_"):
                requests.delete(f"{API}/products/{p['id']}", headers=auth_h(admin_token))
        cats = requests.get(f"{API}/categories", headers=auth_h(admin_token)).json()
        for c in cats:
            if c["name"].startswith("TEST_"):
                requests.delete(f"{API}/categories/{c['id']}", headers=auth_h(admin_token))
    except Exception as e:
        print(f"cleanup err: {e}")
