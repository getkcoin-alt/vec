from flask import Flask, request, jsonify
from num import get_mobile
import os

app = Flask(__name__)

@app.route('/mobile', methods=['GET'])
def fetch_mobile():
    reg = request.args.get('reg')
    if not reg:
        return jsonify({"success": False, "error": "Missing reg parameter"}), 400
    
    try:
        # Use the existing get_mobile logic, which utilizes proxies natively
        result = get_mobile(reg, use_proxy=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "success": False, 
            "error": "Execution Failed", 
            "details": str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
