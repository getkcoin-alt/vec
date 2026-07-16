from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from datetime import datetime, timezone
from curl_cffi import requests

import uuid
import json
import base64

FIXED_KEY = b"7080808080808083"
FIXED_IV  = b"9080808080808083"
ENCODING  = "utf-8"

RSA_PUBLIC_KEY_PEM = b"""-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqJB60iVd+Thl+P5+Ore0
abr7Ae+ANK+9jCj7UbYyXNSIbP6g3QMd4LhAAojln4VZRgpSBKjZ8YBc1yGgb516
BOzfOBeqN4WtwN764UwFCyMaF0nA50BnjcMfGKLPvmhAbeRtaG06GtLhbAS9z57N
QdEXivHzlRZJehzf7IHcpIUUDXKcaXe2/dHkAGk2zLhdrY9VErAxVj1g39qMNSvA
JlrVT+heuR3MWwdle9KNgVFgg7AXybBhorb9GIuMsQS6UTxA/HIvSZUqAetDRfgG
hTCss9Kq6EqJV92u4AiOIngstIOA3seLWx48N4xR0jfmZZElwlJIHeedgWxDsEN4
/wIDAQAB
-----END PUBLIC KEY-----"""

BASE_URL       = "https://www.icicilombard.com"
TOKEN_URL      = BASE_URL + "/digital/v2.0/auth-api/client/initialize"
RC_DETAILS_URL = BASE_URL + "/digital/v2.0/car-quote-api/RcDetails"


# ── Crypto ─────────────────────────────────────────────────────────────────────

def _aes_encrypt(data: str, key: bytes, iv: bytes) -> str:
    raw = data.encode(ENCODING)
    padder = padding.PKCS7(128).padder()
    padded = padder.update(raw) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    enc = cipher.encryptor()
    return base64.b64encode(enc.update(padded) + enc.finalize()).decode(ENCODING)


def generate_kv() -> str:
    return uuid.uuid4().hex


def encrypt_kv_rsa(kv: str) -> str:
    pub_key = serialization.load_pem_public_key(RSA_PUBLIC_KEY_PEM, backend=default_backend())
    encrypted = pub_key.encrypt(kv.encode(ENCODING), asym_padding.PKCS1v15())
    return base64.b64encode(encrypted).decode(ENCODING)


def encrypt_body(data: str, kv: str) -> str:
    key = kv[:16].encode(ENCODING)
    iv  = kv[16:].encode(ENCODING)
    return "e01" + _aes_encrypt(data, key, iv)


def get_api_binding(client_id: str = "1") -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return _aes_encrypt("{}|{}".format(client_id, ts), FIXED_KEY, FIXED_IV)


# ── Session ────────────────────────────────────────────────────────────────────

def _session() -> requests.Session:
    s = requests.Session(impersonate="chrome124")
    s.headers.update({
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "sec-ch-ua": '"Not/A)Brand";v="99", "Google Chrome";v="124", "Chromium";v="124"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "deviceid": "d1234",
        "efid": "true",
        "version": "v6.1.1",
        "gclid": "",
    })
    return s


def _post(session: requests.Session, url: str, payload: dict,
          token: str = None, client_id: str = "1", referer: str = None) -> dict:
    kv = generate_kv()
    headers = {
        "Kv": encrypt_kv_rsa(kv),
        "apibinding": get_api_binding(client_id),
        "authorization": "Bearer {}".format(token) if token else "Bearer",
        "corelationid": str(uuid.uuid4()),
        "referer": referer or BASE_URL + "/motor-insurance/car-insurance",
    }
    body = json.dumps({"msg": encrypt_body(json.dumps(payload), kv)})
    resp = session.post(url, data=body, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ── API calls ──────────────────────────────────────────────────────────────────

def get_token(session: requests.Session) -> tuple:
    data = _post(session, TOKEN_URL, {"Client": "website", "Scope": "MvImfz1HGC4UzIbv6oQT4UvKT83p"})
    token = data.get("Passcode") or data.get("authToken")
    client_id = str(data.get("clientId") or "1")
    if not token:
        raise RuntimeError("Token not found: {}".format(data))
    return token, client_id


def get_rc_details(registration_number: str, session: requests.Session,
                   token: str, client_id: str) -> dict:
    return _post(
        session, RC_DETAILS_URL,
        {"RegistrationNumber": registration_number},
        token=token, client_id=client_id,
        referer=BASE_URL + "/motor-insurance/car-insurance/get-quote/select-plans",
    )


def extract_rc(registration_number: str) -> dict:
    session = _session()
    token, client_id = get_token(session)
    return get_rc_details(registration_number, session, token, client_id)


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    details = extract_rc("RJ27CD4410")
    print(json.dumps(details, indent=2))
