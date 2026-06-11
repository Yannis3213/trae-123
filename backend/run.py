import uvicorn

from app.main import app
from app.config import BACKEND_HOST, BACKEND_PORT

if __name__ == "__main__":
    uvicorn.run(app, host=BACKEND_HOST, port=BACKEND_PORT)
