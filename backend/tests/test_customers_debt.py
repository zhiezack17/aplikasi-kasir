"""Backend test suite for Customer + Debt features (iteration 2).

Covers:
- Empty products/categories at startup (no seeded sample data)
- Customer CRUD (admin / cashier)
- Customer debt protection on delete
- Transactions with payment_method='debt' (auto-increment customer.debt)
- /customers/:id/pay-debt (partial + over-payment guard)
- /customers/:id/transactions endpoint
- /reports/daily includes outstanding_debt + customers_with_debt + 'debt' in by_payment
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


@pytest.fixture(scope="session")
def category_id(admin_token):
    """Ensure at least one test category exists for test product."""
    r = requests.post(f"{API}/categories",
                      json={"name": "TEST_CAT_Debt", "icon": "Coffee"},
                      headers=auth_h(admin_token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="session")
def product_id(admin_token, category_id):
    """Create a test product to use for debt transactions."""
    r = requests.post(f"{API}/products",
                      json={"name": "TEST_PROD_Debt", "price": 10000, "stock": 200,
                            "category_id": category_id, "description": "for debt tests"},
                      headers=auth_h(admin_token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ============ Empty Seed Verification ============
class TestNoSampleSeed:
    """Verify products & categories are NOT auto-seeded anymore (besides whatever main agent or this suite created)."""

    def test_products_endpoint_works(self, admin_token):
        r = requests.get(f"{API}/products", headers=auth_h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # None of the sample products should exist (Espresso, Cappuccino, etc.)
        sample_names = {"Espresso", "Cappuccino", "Latte", "Americano", "Matcha Latte",
                        "Chocolate", "Croissant", "Pain au Chocolat", "Nasi Goreng", "Mie Goreng"}
        existing_names = {p["name"] for p in data}
        assert not (existing_names & sample_names), \
            f"Sample products still seeded: {existing_names & sample_names}"

    def test_categories_endpoint_works(self, admin_token):
        r = requests.get(f"{API}/categories", headers=auth_h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # None of the sample categories
        sample = {"Kopi", "Non-Kopi", "Pastry", "Makanan"}
        existing = {c["name"] for c in data}
        assert not (existing & sample), f"Sample categories still seeded: {existing & sample}"


# ============ Customer CRUD ============
class TestCustomerCRUD:
    _created_id = None

    def test_create_customer(self, admin_token):
        payload = {"name": "TEST_Pelanggan_A", "phone": "08123", "address": "Jl Mawar 1", "notes": "VIP"}
        r = requests.post(f"{API}/customers", json=payload, headers=auth_h(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Pelanggan_A"
        assert data["phone"] == "08123"
        assert data["address"] == "Jl Mawar 1"
        assert data["notes"] == "VIP"
        assert data["debt"] == 0.0
        assert "id" in data
        TestCustomerCRUD._created_id = data["id"]

    def test_create_customer_blank_name_400(self, admin_token):
        r = requests.post(f"{API}/customers", json={"name": "   "}, headers=auth_h(admin_token))
        assert r.status_code == 400

    def test_list_customers_sorted(self, admin_token):
        # add second customer with name starting with 'A' to verify sort
        requests.post(f"{API}/customers", json={"name": "TEST_AAA_first"},
                      headers=auth_h(admin_token))
        r = requests.get(f"{API}/customers", headers=auth_h(admin_token))
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        assert names == sorted(names, key=lambda s: s.lower()) or names == sorted(names)

    def test_get_customer(self, admin_token):
        assert TestCustomerCRUD._created_id
        r = requests.get(f"{API}/customers/{TestCustomerCRUD._created_id}",
                         headers=auth_h(admin_token))
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Pelanggan_A"

    def test_update_customer_admin(self, admin_token):
        cid = TestCustomerCRUD._created_id
        r = requests.put(f"{API}/customers/{cid}",
                         json={"name": "TEST_Pelanggan_A_upd", "phone": "0999",
                               "address": "Jl Baru", "notes": ""},
                         headers=auth_h(admin_token))
        assert r.status_code == 200
        # Verify
        g = requests.get(f"{API}/customers/{cid}", headers=auth_h(admin_token))
        assert g.json()["name"] == "TEST_Pelanggan_A_upd"
        assert g.json()["phone"] == "0999"

    def test_update_customer_cashier_403(self, cashier_token):
        cid = TestCustomerCRUD._created_id
        r = requests.put(f"{API}/customers/{cid}",
                         json={"name": "should fail"},
                         headers=auth_h(cashier_token))
        assert r.status_code == 403

    def test_cashier_can_create_customer(self, cashier_token):
        r = requests.post(f"{API}/customers",
                          json={"name": "TEST_Cashier_Created"},
                          headers=auth_h(cashier_token))
        assert r.status_code == 200


# ============ Debt transactions ============
class TestDebtTransactions:
    _customer_id = None
    _initial_debt = 0.0

    def test_create_customer_for_debt(self, admin_token):
        r = requests.post(f"{API}/customers",
                          json={"name": "TEST_DebtCust", "phone": "081111"},
                          headers=auth_h(admin_token))
        assert r.status_code == 200
        TestDebtTransactions._customer_id = r.json()["id"]
        assert r.json()["debt"] == 0.0

    def test_debt_tx_requires_customer(self, cashier_token, product_id):
        r = requests.post(f"{API}/transactions",
                          json={"items": [{"product_id": product_id, "product_name": "x",
                                            "price": 10000, "quantity": 1, "subtotal": 10000}],
                                "payment_method": "debt"},
                          headers=auth_h(cashier_token))
        assert r.status_code == 400
        assert "Pelanggan" in r.json()["detail"]

    def test_debt_tx_increments_customer_debt(self, cashier_token, product_id):
        cid = TestDebtTransactions._customer_id
        # quantity=2 -> subtotal=20000, tax=2000, total=22000
        r = requests.post(f"{API}/transactions",
                          json={"items": [{"product_id": product_id, "product_name": "x",
                                            "price": 10000, "quantity": 2, "subtotal": 20000}],
                                "payment_method": "debt",
                                "customer_id": cid},
                          headers=auth_h(cashier_token))
        assert r.status_code == 200, r.text
        tx = r.json()
        assert tx["payment_method"] == "debt"
        assert tx["customer_id"] == cid
        assert tx["customer_name"] == "TEST_DebtCust"
        assert tx["total"] == 22000.0
        # Verify customer.debt incremented
        g = requests.get(f"{API}/customers/{cid}", headers=auth_h(cashier_token))
        assert g.status_code == 200
        assert g.json()["debt"] == 22000.0
        TestDebtTransactions._initial_debt = 22000.0

    def test_debt_tx_invalid_customer_400(self, cashier_token, product_id):
        r = requests.post(f"{API}/transactions",
                          json={"items": [{"product_id": product_id, "product_name": "x",
                                            "price": 10000, "quantity": 1, "subtotal": 10000}],
                                "payment_method": "debt",
                                "customer_id": "non-existent-id"},
                          headers=auth_h(cashier_token))
        assert r.status_code == 400

    def test_delete_customer_with_debt_400(self, admin_token):
        cid = TestDebtTransactions._customer_id
        r = requests.delete(f"{API}/customers/{cid}", headers=auth_h(admin_token))
        assert r.status_code == 400
        assert "hutang" in r.json()["detail"].lower() or "lunasi" in r.json()["detail"].lower()


# ============ Pay Debt ============
class TestPayDebt:
    def test_partial_payment(self, cashier_token, admin_token):
        cid = TestDebtTransactions._customer_id
        # Pay 10000 of the 22000 debt
        r = requests.post(f"{API}/customers/{cid}/pay-debt",
                          json={"amount": 10000, "method": "cash", "notes": "partial"},
                          headers=auth_h(cashier_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "payment" in data and "customer" in data
        assert data["customer"]["debt"] == 12000.0
        assert data["payment"]["amount"] == 10000
        assert data["payment"]["method"] == "cash"

    def test_overpayment_blocked(self, cashier_token):
        cid = TestDebtTransactions._customer_id
        # Current debt 12000, try paying 99999
        r = requests.post(f"{API}/customers/{cid}/pay-debt",
                          json={"amount": 99999, "method": "cash"},
                          headers=auth_h(cashier_token))
        assert r.status_code == 400
        assert "melebihi" in r.json()["detail"].lower() or "Pembayaran" in r.json()["detail"]

    def test_zero_amount_blocked(self, cashier_token):
        cid = TestDebtTransactions._customer_id
        r = requests.post(f"{API}/customers/{cid}/pay-debt",
                          json={"amount": 0, "method": "cash"},
                          headers=auth_h(cashier_token))
        assert r.status_code == 400

    def test_customer_transactions_history(self, cashier_token):
        cid = TestDebtTransactions._customer_id
        r = requests.get(f"{API}/customers/{cid}/transactions",
                         headers=auth_h(cashier_token))
        assert r.status_code == 200
        data = r.json()
        assert "transactions" in data and "payments" in data
        assert len(data["transactions"]) >= 1
        assert len(data["payments"]) >= 1
        assert data["payments"][0]["amount"] == 10000
        assert data["transactions"][0]["payment_method"] == "debt"

    def test_full_payment_zeroes_debt(self, cashier_token, admin_token):
        cid = TestDebtTransactions._customer_id
        # remaining 12000 -> pay full
        r = requests.post(f"{API}/customers/{cid}/pay-debt",
                          json={"amount": 12000, "method": "transfer"},
                          headers=auth_h(cashier_token))
        assert r.status_code == 200
        assert r.json()["customer"]["debt"] == 0.0

        # Now delete should work
        d = requests.delete(f"{API}/customers/{cid}", headers=auth_h(admin_token))
        assert d.status_code == 200


# ============ Reports include debt ============
class TestReportsDebt:
    def test_reports_has_debt_fields(self, admin_token, product_id):
        # Create a fresh customer and add debt so outstanding_debt > 0
        c = requests.post(f"{API}/customers", json={"name": "TEST_ReportDebt"},
                          headers=auth_h(admin_token)).json()
        cid = c["id"]
        # Create debt tx
        tx = requests.post(f"{API}/transactions",
                           json={"items": [{"product_id": product_id, "product_name": "x",
                                             "price": 10000, "quantity": 1, "subtotal": 10000}],
                                 "payment_method": "debt",
                                 "customer_id": cid},
                           headers=auth_h(admin_token))
        assert tx.status_code == 200, tx.text

        r = requests.get(f"{API}/reports/daily", headers=auth_h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "outstanding_debt" in data
        assert "customers_with_debt" in data
        assert data["outstanding_debt"] >= 11000.0  # 10000 + 10% tax
        assert data["customers_with_debt"] >= 1
        assert "debt" in data["by_payment"]
        assert data["by_payment"]["debt"] >= 11000.0

        # cleanup -- pay debt then delete
        cust = requests.get(f"{API}/customers/{cid}", headers=auth_h(admin_token)).json()
        if cust["debt"] > 0:
            requests.post(f"{API}/customers/{cid}/pay-debt",
                          json={"amount": cust["debt"], "method": "cash"},
                          headers=auth_h(admin_token))
        requests.delete(f"{API}/customers/{cid}", headers=auth_h(admin_token))


# ============ Cleanup ============
@pytest.fixture(scope="session", autouse=True)
def cleanup_all(request, admin_token):
    yield
    # Best-effort cleanup of TEST_ prefixed entities
    try:
        custs = requests.get(f"{API}/customers", headers=auth_h(admin_token)).json()
        for c in custs:
            if c["name"].startswith("TEST_"):
                if c.get("debt", 0) > 0:
                    requests.post(f"{API}/customers/{c['id']}/pay-debt",
                                  json={"amount": c["debt"], "method": "cash"},
                                  headers=auth_h(admin_token))
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
