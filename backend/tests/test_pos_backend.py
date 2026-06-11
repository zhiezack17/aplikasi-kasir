"""Backend test suite for Cafe POS app.

Covers: auth, categories, products, transactions, role-based access, reports.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://selamat-malam-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ============ Fixtures ============
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def cashier_token():
    r = requests.post(f"{API}/auth/login", json={"username": "kasir", "password": "kasir123"}, timeout=15)
    assert r.status_code == 200, f"cashier login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def auth_h(token):
    return {"Authorization": f"Bearer {token}"}


# ============ Auth ============
class TestAuth:
    def test_login_admin_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["role"] == "admin"
        assert data["user"]["username"] == "admin"

    def test_login_cashier_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": "kasir", "password": "kasir123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "cashier"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=auth_h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"


# ============ Categories ============
class TestCategories:
    def test_list_categories_seeded(self, admin_token):
        r = requests.get(f"{API}/categories", headers=auth_h(admin_token))
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        for expected in ["Kopi", "Non-Kopi", "Pastry", "Makanan"]:
            assert expected in names, f"missing seeded category {expected}"

    def test_create_category_admin(self, admin_token):
        r = requests.post(f"{API}/categories", json={"name": "TEST_Drinks", "icon": "Cup"}, headers=auth_h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Drinks"
        assert "id" in data
        # cleanup
        requests.delete(f"{API}/categories/{data['id']}", headers=auth_h(admin_token))

    def test_create_category_cashier_forbidden(self, cashier_token):
        r = requests.post(f"{API}/categories", json={"name": "TEST_Forbidden"}, headers=auth_h(cashier_token))
        assert r.status_code == 403

    def test_delete_category_in_use(self, admin_token):
        # Get any seeded category that has products (Kopi)
        cats = requests.get(f"{API}/categories", headers=auth_h(admin_token)).json()
        kopi = next(c for c in cats if c["name"] == "Kopi")
        r = requests.delete(f"{API}/categories/{kopi['id']}", headers=auth_h(admin_token))
        assert r.status_code == 400
        assert "produk" in r.json()["detail"].lower() or "kategori" in r.json()["detail"].lower()


# ============ Products ============
class TestProducts:
    def test_list_products_seeded(self, admin_token):
        r = requests.get(f"{API}/products", headers=auth_h(admin_token))
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 10
        for p in prods[:3]:
            assert "category_id" in p
            assert "price" in p
            assert "stock" in p
            assert "image_url" in p

    def test_create_update_delete_product(self, admin_token):
        cats = requests.get(f"{API}/categories", headers=auth_h(admin_token)).json()
        cid = cats[0]["id"]
        # CREATE
        payload = {"name": "TEST_Item", "price": 12345, "stock": 5, "category_id": cid, "image_url": "https://example.com/x.jpg"}
        r = requests.post(f"{API}/products", json=payload, headers=auth_h(admin_token))
        assert r.status_code == 200, r.text
        prod = r.json()
        assert prod["name"] == "TEST_Item"
        pid = prod["id"]

        # GET verification
        r = requests.get(f"{API}/products", headers=auth_h(admin_token))
        assert any(p["id"] == pid and p["name"] == "TEST_Item" for p in r.json())

        # UPDATE
        payload["name"] = "TEST_Item_Updated"
        payload["price"] = 99999
        r = requests.put(f"{API}/products/{pid}", json=payload, headers=auth_h(admin_token))
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Item_Updated"
        assert r.json()["price"] == 99999

        # DELETE
        r = requests.delete(f"{API}/products/{pid}", headers=auth_h(admin_token))
        assert r.status_code == 200

    def test_cashier_cannot_create_product(self, cashier_token, admin_token):
        cats = requests.get(f"{API}/categories", headers=auth_h(admin_token)).json()
        cid = cats[0]["id"]
        r = requests.post(f"{API}/products", json={"name": "TEST_x", "price": 1, "category_id": cid}, headers=auth_h(cashier_token))
        assert r.status_code == 403


# ============ Transactions ============
class TestTransactions:
    def _get_first_product(self, token):
        r = requests.get(f"{API}/products", headers=auth_h(token))
        return r.json()[0]

    def test_create_transaction_cash(self, cashier_token):
        prod = self._get_first_product(cashier_token)
        items = [{"product_id": prod["id"], "product_name": prod["name"], "price": prod["price"], "quantity": 2, "subtotal": prod["price"] * 2}]
        expected_subtotal = prod["price"] * 2
        expected_tax = round(expected_subtotal * 0.10, 2)
        expected_total = round(expected_subtotal + expected_tax, 2)
        payload = {"items": items, "payment_method": "cash", "cash_received": expected_total + 5000}
        r = requests.post(f"{API}/transactions", json=payload, headers=auth_h(cashier_token))
        assert r.status_code == 200, r.text
        tx = r.json()
        assert tx["subtotal"] == round(expected_subtotal, 2)
        assert tx["tax"] == expected_tax
        assert tx["total"] == expected_total
        assert tx["change"] == 5000
        assert tx["order_number"].startswith("ORD")
        assert tx["payment_method"] == "cash"

    def test_create_transaction_insufficient_cash(self, cashier_token):
        prod = self._get_first_product(cashier_token)
        items = [{"product_id": prod["id"], "product_name": prod["name"], "price": prod["price"], "quantity": 1, "subtotal": prod["price"]}]
        payload = {"items": items, "payment_method": "cash", "cash_received": 1}
        r = requests.post(f"{API}/transactions", json=payload, headers=auth_h(cashier_token))
        assert r.status_code == 400

    def test_stock_deducted(self, cashier_token, admin_token):
        prod = self._get_first_product(cashier_token)
        before = prod["stock"]
        items = [{"product_id": prod["id"], "product_name": prod["name"], "price": prod["price"], "quantity": 1, "subtotal": prod["price"]}]
        total = round(prod["price"] * 1.1, 2)
        r = requests.post(f"{API}/transactions", json={"items": items, "payment_method": "qris"}, headers=auth_h(cashier_token))
        assert r.status_code == 200
        # Fetch product again
        prods = requests.get(f"{API}/products", headers=auth_h(admin_token)).json()
        after = next(p for p in prods if p["id"] == prod["id"])["stock"]
        assert after == before - 1, f"expected stock {before-1}, got {after}"

    def test_cashier_sees_only_own(self, cashier_token, admin_token):
        # cashier list
        r_c = requests.get(f"{API}/transactions", headers=auth_h(cashier_token))
        assert r_c.status_code == 200
        cashier_txs = r_c.json()
        # admin list
        r_a = requests.get(f"{API}/transactions", headers=auth_h(admin_token))
        assert r_a.status_code == 200
        # All cashier txs should belong to the cashier user (verify cashier_id consistency)
        if cashier_txs:
            cashier_ids = {t["cashier_id"] for t in cashier_txs}
            assert len(cashier_ids) == 1, "cashier should only see own transactions"


# ============ Reports ============
class TestReports:
    def test_daily_report_structure(self, admin_token):
        r = requests.get(f"{API}/reports/daily", headers=auth_h(admin_token))
        assert r.status_code == 200
        data = r.json()
        for key in ["date", "total_revenue", "total_orders", "by_payment", "top_products", "trend"]:
            assert key in data, f"missing key {key}"
        assert "cash" in data["by_payment"]
        assert "qris" in data["by_payment"]
        assert "transfer" in data["by_payment"]
        assert isinstance(data["trend"], list)
        assert len(data["trend"]) == 7
        for d in data["trend"]:
            assert "date" in d and "revenue" in d and "orders" in d
