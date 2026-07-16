import sys, json, re, time, os, random, hashlib, ssl
import requests as reqs_lib
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context
from datetime import datetime, timedelta, timezone
import warnings
import uuid
import base64
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from curl_cffi import requests as curl_reqs

warnings.filterwarnings("ignore")


class TLSAdapter(HTTPAdapter):
    """Force TLS 1.2+ with browser-like cipher suite to avoid WAF fingerprint blocks."""
    def init_poolmanager(self, *args, **kwargs):
        ctx = create_urllib3_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.set_ciphers(
            "ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20"
            ":ECDH+AESGCM:DH+AESGCM:ECDH+AES:DH+AES"
            ":RSA+AESGCM:RSA+AES:!aNULL:!eNULL:!MD5:!DSS"
        )
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)

HP  = "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/statevalidation/homepage.xhtml?statecd=Mzc2MzM2MzAzNjY0MzIzODM3NjIzNjY0MzY2MjM3NDQ0Yw=="
HB  = "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/statevalidation/homepage.xhtml"
LI  = "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/usermgmt/login.xhtml"
FR  = "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/balanceservice/form_reschedule_fitness.xhtml"

CHASSIS_WORKER_URL = "https://rc-chasis.drazeforce-io.workers.dev/fetch"
CHASSIS_API_KEY    = os.environ.get("CHASSIS_API_KEY", "elliotfuckedup")
TIMEOUT            = 20
CACHE_TTL_SECONDS  = 3600
MAX_VAHAN_RETRIES  = 4

PROXY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "proxy.txt")

def _load_proxies():
    """Load proxies from proxy.txt or INDIAN_PROXY env var."""
    proxies = []
    # First check environment variable
    env_proxy = os.environ.get("INDIAN_PROXY")
    if env_proxy:
        proxies.extend([p.strip() for p in env_proxy.split(",") if p.strip()])
        
    # Then check file
    try:
        with open(PROXY_FILE, "r") as f:
            proxies.extend([line.strip() for line in f if line.strip()])
    except FileNotFoundError:
        if not proxies:
            sys.stderr.write(f"⚠️  No INDIAN_PROXY env var and proxy.txt not found at {PROXY_FILE}, no proxies loaded.\n")
            
    return proxies

PROXIES = _load_proxies()
PRIMARY_PROXIES = PROXIES[:35]
BACKUP_PROXIES  = PROXIES[35:]

CHASSIS_NOT_FOUND_ERRORS = [
    "This vehicle might as well be a ghost — no chassis on record anywhere.",
    "Looked everywhere. Either this vehicle was never properly registered, or someone really didn't want it found.",
    "Zero chassis data. The vehicle exists on the road but apparently not in any database that matters.",
    "No chassis found. This plate might be fake, expired, or just lost in the void of Indian bureaucracy.",
    "Our sources have absolutely nothing on this one. Try checking if it was ever actually registered.",
    "Chassis lookup came up completely empty. The registry has never heard of this vehicle.",
    "This vehicle is either brand new, never registered properly, or someone's running ghost plates.",
    "Not a single record. The RTO has no memory of this vehicle existing.",
    "Vanished from every database we hit. Either a paperwork disaster or something shadier.",
    "This plate is invisible to the entire registry system. Make of that what you will.",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
]

def _pick_ua():
    return random.choice(USER_AGENTS)

BASE_HEADERS = {
    "User-Agent": _pick_ua(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
}
AJAX_HEADERS = {
    "Accept": "application/xml, text/xml, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Faces-Request": "partial/ajax",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": "https://vahan.parivahan.gov.in",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

_cache = {}


def normalize_vehicle_number(raw):
    raw = raw.upper().strip().replace("-", "").replace(" ", "")
    m = re.match(r'^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$', raw)
    if not m:
        return raw
    state  = m.group(1)
    dist   = m.group(2).zfill(2)
    series = m.group(3)
    number = m.group(4).zfill(4)
    return f"{state}{dist}{series}{number}"


def get_cached(key):
    entry = _cache.get(key)
    if not entry:
        return None
    if datetime.utcnow() > entry["expires"]:
        del _cache[key]
        return None
    return entry["data"]


def set_cached(key, data):
    _cache[key] = {
        "data": data,
        "expires": datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS),
    }


def pick_proxy():
    pool = PRIMARY_PROXIES if PRIMARY_PROXIES else BACKUP_PROXIES
    if not pool:
        return {}
    proxy_url = random.choice(pool)
    return {"http": proxy_url, "https": proxy_url}


def build_session(use_proxy=True):
    sess = reqs_lib.Session()
    hdrs = dict(BASE_HEADERS)
    hdrs["User-Agent"] = _pick_ua()  # randomize per session
    sess.headers.update(hdrs)
    sess.verify = False
    if use_proxy:
        sess.proxies.update(pick_proxy())
    adapter = TLSAdapter(pool_connections=10, pool_maxsize=10, max_retries=0)
    sess.mount("https://", adapter)
    sess.mount("http://", adapter)
    return sess


def req(sess, url, data=None, headers=None, referer=None):
    hdrs = {}
    if headers:
        hdrs.update(headers)
    if referer:
        hdrs["Referer"] = referer
    last_exc = None
    for attempt in range(3):
        try:
            time.sleep(random.uniform(0.3, 1.2))  # human-like delay
            if data is not None:
                resp = sess.post(url, data=data, headers=hdrs, timeout=TIMEOUT)
            else:
                resp = sess.get(url, headers=hdrs, timeout=TIMEOUT)
            if resp.status_code == 403:
                raise ConnectionError("403 Forbidden — proxy blocked")
            return resp.text, dict(resp.headers)
        except Exception as e:
            last_exc = e
            if attempt < 2:
                sess.proxies.update(pick_proxy())
                time.sleep(random.uniform(1, 2))
    raise last_exc


def extract_vs(html):
    m = re.search(r'<input[^>]*name="javax\.faces\.ViewState"[^>]*value="([^"]+)"', html)
    return m.group(1) if m else None


def extract_vs_ajax(html):
    m = re.search(r'<update id="j_id1:javax\.faces\.ViewState:0"><!\[CDATA\[(.*?)\]\]></update>', html)
    return m.group(1) if m else None


def pad_chassis(chassis_last):
    return chassis_last[-5:].zfill(5)


# ── ICICI Lombard Quote API logic for chassis lookup ──
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
    return _aes_encrypt(f"{client_id}|{ts}", FIXED_KEY, FIXED_IV)

def fetch_chassis_icici(reg_no, proxy_url=None):
    s = curl_reqs.Session(impersonate="chrome124")
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
    if proxy_url:
        s.proxies = {"http": proxy_url, "https": proxy_url}

    def _post(url: str, payload: dict, token: str = None, client_id: str = "1", referer: str = None) -> dict:
        kv = generate_kv()
        headers = {
            "Kv": encrypt_kv_rsa(kv),
            "apibinding": get_api_binding(client_id),
            "authorization": f"Bearer {token}" if token else "Bearer",
            "corelationid": str(uuid.uuid4()),
            "referer": referer or BASE_URL + "/motor-insurance/car-insurance",
        }
        body = json.dumps({"msg": encrypt_body(json.dumps(payload), kv)})
        resp = s.post(url, data=body, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.json()

    token_data = _post(TOKEN_URL, {"Client": "website", "Scope": "MvImfz1HGC4UzIbv6oQT4UvKT83p"})
    token = token_data.get("Passcode") or token_data.get("authToken")
    client_id = str(token_data.get("clientId") or "1")
    if not token:
        raise RuntimeError(f"Token not found: {token_data}")

    rc_data = _post(
        RC_DETAILS_URL,
        {"RegistrationNumber": reg_no.upper()},
        token=token, client_id=client_id,
        referer=BASE_URL + "/motor-insurance/car-insurance/get-quote/select-plans",
    )
    chassis = rc_data.get("ChassisNo", "").replace(" ", "")
    engine = rc_data.get("EngineNo", "")
    if not chassis:
        raise ValueError(f"Chassis not found in ICICI response: {rc_data}")
    return chassis, engine


def fetch_chassis(reg_no):
    last_exc = None
    
    # Try ICICI Lombard first (Direct & Fast)
    for attempt in range(2):
        try:
            proxy = pick_proxy() if attempt == 1 else None
            proxy_url = proxy.get("http") if proxy else None
            chassis, engine = fetch_chassis_icici(reg_no, proxy_url=proxy_url)
            if chassis:
                return chassis, engine
        except Exception as e:
            last_exc = e
            time.sleep(0.5)

    # Fallback to old Cloudflare worker API
    for attempt in range(2):
        try:
            proxy = pick_proxy() if attempt == 1 else None
            resp = reqs_lib.get(
                CHASSIS_WORKER_URL,
                params={"key": CHASSIS_API_KEY, "vehicle": reg_no},
                timeout=15,
                verify=False,
                proxies=proxy,
            )
            data = resp.json()
            if not data.get("success"):
                raise LookupError(random.choice(CHASSIS_NOT_FOUND_ERRORS))
            inner   = data.get("data", {})
            chassis = inner.get("chassis", "").replace(" ", "")
            engine  = inner.get("engine", "")
            if not chassis:
                raise LookupError(random.choice(CHASSIS_NOT_FOUND_ERRORS))
            return chassis, engine
        except LookupError:
            raise
        except Exception as e:
            last_exc = e
            time.sleep(0.5)
            
    raise Exception(f"All chassis lookup methods failed. Last error: {last_exc}")


def get_mobile(reg_no, chassis_no_last5=None, use_proxy=True):
    start  = time.time()
    result = {
        "success": False,
        "mobile_number": "",
        "chassis_number": "",
        "engine_number": "",
        "error": "",
        "lookup_time_seconds": 0,
    }

    normalized = normalize_vehicle_number(reg_no)
    cache_key  = hashlib.md5(normalized.encode()).hexdigest()
    cached     = get_cached(cache_key)
    if cached:
        cached["cached"] = True
        return cached

    try:
        if chassis_no_last5 is None:
            chassis_full, engine_no   = fetch_chassis(normalized)
            chassis_no_last5          = chassis_full[-5:]
            result["chassis_number"]  = chassis_full
            result["engine_number"]   = engine_no

        chassis_no_last5 = pad_chassis(chassis_no_last5)
        sess = build_session(use_proxy=use_proxy)

        for attempt in range(MAX_VAHAN_RETRIES):
            result["error"] = ""
            try:
                html, _ = req(sess, HP)
                vs  = extract_vs(html)
                cid = (re.search(r'id="(j_idt\d+)"[^>]*class="[^"]*ui-chkbox', html) or type("x", (), {"group": lambda s, n: "j_idt187"})()).group(1)
                if not vs:
                    raise Exception("No ViewState on homepage")

                ajax_h = {**AJAX_HEADERS, "Referer": HP}

                html, _ = req(sess, HB, headers=ajax_h, data={
                    "javax.faces.partial.ajax": "true", "javax.faces.source": "fit_c_office_to",
                    "javax.faces.partial.execute": "fit_c_office_to",
                    "javax.faces.behavior.event": "change", "javax.faces.partial.event": "change",
                    "homepageformid": "homepageformid", "j_idt12": "", "j_idt47_input": "en",
                    "state_cd_filter": "", "fit_c_office_to_input": "1", "abc": "abc",
                    "javax.faces.ViewState": vs, "pmtchk_input": "-1", "nocregnno": "",
                })
                vs = extract_vs_ajax(html) or vs

                html, _ = req(sess, HB, headers=ajax_h, data={
                    "javax.faces.partial.ajax": "true", "javax.faces.source": cid,
                    "javax.faces.partial.execute": cid,
                    "javax.faces.partial.render": "proccedHomeButtonId",
                    "javax.faces.behavior.event": "change", "javax.faces.partial.event": "change",
                    "homepageformid": "homepageformid", "j_idt12": "", "j_idt47_input": "en",
                    "state_cd_filter": "", "fit_c_office_to_input": "1", f"{cid}_input": "on",
                    "abc": "abc", "javax.faces.ViewState": vs, "pmtchk_input": "-1", "nocregnno": "",
                })
                vs = extract_vs_ajax(html) or vs

                html, _ = req(sess, HB, headers=ajax_h, data={
                    "javax.faces.partial.ajax": "true", "javax.faces.source": "proccedHomeButtonId",
                    "javax.faces.partial.execute": "@all",
                    "javax.faces.partial.render": "regnid facelesslist portaldownMsgPnl mainhomepagepnl leftmenupnlid leftmenupnlidservdown",
                    "proccedHomeButtonId": "proccedHomeButtonId",
                    "homepageformid": "homepageformid", "j_idt12": "", "j_idt47_input": "en",
                    "state_cd_filter": "", "fit_c_office_to_input": "1", f"{cid}_input": "on",
                    "abc": "abc", "javax.faces.ViewState": vs, "pmtchk_input": "-1", "nocregnno": "",
                })
                vs = extract_vs_ajax(html) or vs

                dlg_m = re.search(r'id="(j_idt\d+)"[^>]*class="[^"]*ui-button', html)
                dlg   = dlg_m.group(1) if dlg_m else "j_idt536"
                html, _ = req(sess, HB, headers=ajax_h, data={
                    "javax.faces.partial.ajax": "true", "javax.faces.source": dlg,
                    "javax.faces.partial.execute": "@all", dlg: dlg,
                    "homepageformid": "homepageformid", "j_idt12": "", "j_idt47_input": "en",
                    "state_cd_filter": "", "fit_c_office_to_input": "1", f"{cid}_input": "on",
                    "pmtchk_input": "-1", "nocregnno": "", "javax.faces.ViewState": vs,
                })
                vs = extract_vs_ajax(html) or vs

                html, _ = req(sess, LI + "?faces-redirect=true", referer=HP)
                vs = extract_vs(html)
                if not vs:
                    raise Exception("No ViewState on login page")

                fit_m = re.search(r'id="(j_idt\d+)"[^>]*name="\1"[^>]*type="submit"', html)
                fit   = fit_m.group(1) if fit_m else "j_idt506"
                html, _ = req(sess, LI, data={
                    "loginForm": "loginForm", fit: fit,
                    "javax.faces.ViewState": vs, "InputEnter": "",
                    "fitbalcTest": "fitbalcTest", "pur_cd": "86",
                }, headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Origin": "https://vahan.parivahan.gov.in",
                }, referer=LI + "?faces-redirect=true")

                html, _ = req(sess, FR, headers={**BASE_HEADERS, "Referer": LI + "?faces-redirect=true", "Cache-Control": "max-age=0"})
                vs = extract_vs(html)
                if not vs:
                    raise Exception("No ViewState on fitness form")

                html, _ = req(sess, FR, headers={**AJAX_HEADERS, "Referer": FR}, data={
                    "javax.faces.partial.ajax": "true",
                    "javax.faces.source": "balanceFeesFine:validate_dtls",
                    "javax.faces.partial.execute": "@all",
                    "javax.faces.partial.render": "balanceFeesFine:auth_panel",
                    "balanceFeesFine:validate_dtls": "balanceFeesFine:validate_dtls",
                    "balanceFeesFine": "balanceFeesFine",
                    "balanceFeesFine:tf_reg_no": normalized,
                    "balanceFeesFine:tf_chasis_no": chassis_no_last5,
                    "javax.faces.ViewState": vs,
                })

                mobile = None
                for pattern in [
                    r'id="balanceFeesFine:tf_mobile"[^>]*value="(\d{10})"',
                    r'value="(\d{10})"[^>]*id="balanceFeesFine:tf_mobile"',
                    r'balanceFeesFine:tf_mobile[^>]*value="(\d{10})"',
                ]:
                    m = re.search(pattern, html, re.DOTALL)
                    if m and m.group(1)[0] in "6789":
                        mobile = m.group(1)
                        break

                if not mobile:
                    nums = re.findall(r'\b([6-9]\d{9})\b', html)
                    if nums:
                        mobile = nums[0]

                if mobile:
                    result["success"]       = True
                    result["mobile_number"] = mobile
                else:
                    result["error"] = "Mobile number not found in response"

                break

            except Exception as e:
                result["error"] = f"{type(e).__name__}: {str(e)}"
                if attempt < MAX_VAHAN_RETRIES - 1:
                    sess = build_session(use_proxy=use_proxy)  # fresh session + new proxy + new UA
                    time.sleep(random.uniform(1, 3))

    except LookupError as e:
        result["error"] = str(e)
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)}"

    elapsed = round(time.time() - start, 2)
    result["lookup_time_seconds"] = elapsed
    result["cached"] = False

    if result["success"]:
        set_cached(cache_key, dict(result))

    return result


if __name__ == "__main__":
    use_proxy_flag = "--no-proxy" not in sys.argv
    args = [a for a in sys.argv[1:] if a != "--no-proxy"]
    reg_no  = args[0].upper() if len(args) > 0 else ""
    chassis = args[1] if len(args) > 1 else None
    if not reg_no or len(args) > 2:
        print(json.dumps({"success": False, "error": "Usage: python num.py <VEHICLE> [CHASSIS_LAST5] [--no-proxy]"}))
        sys.exit(1)
    
    result = get_mobile(reg_no, chassis, use_proxy=use_proxy_flag)
    
    # Clean up output fields if they are empty
    if not result.get("error"):
        result.pop("error", None)
    if not result.get("chassis_number"):
        result.pop("chassis_number", None)
    if not result.get("engine_number"):
        result.pop("engine_number", None)
        
    print(json.dumps(result, indent=2))