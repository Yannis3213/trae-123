import os
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()

from .config import Config
from .models import db
from .routes import bp as api_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    frontend_port = int(os.environ.get('FRONTEND_PORT', 5173))
    backend_port = int(os.environ.get('BACKEND_PORT', 5000))

    CORS(app, resources={
        r"/api/*": {
            "origins": [
                f"http://localhost:{frontend_port}",
                f"http://127.0.0.1:{frontend_port}"
            ],
            "allow_headers": ["Content-Type", "X-User-Role", "X-User-Name"]
        }
    })

    db.init_app(app)

    app.register_blueprint(api_bp, url_prefix='/api')

    with app.app_context():
        db.create_all()
        from .seed import seed_database
        seed_database()

    return app


if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('BACKEND_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
