import sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from database import Base, engine
    from models import User
    from auth import hash_password
    Base.metadata.create_all(bind=engine)
    print('1 OK models/database')
    from seed import seed_database
    print('2 OK seed')
    import main
    print('3 OK main')
    print('4 port=8105')
    for r in main.origins:
        print('  CORS:', r)
    from sqlalchemy.orm import Session
    from database import SessionLocal
    db = SessionLocal()
    try:
        uc = db.query(User).count()
        print(f'5 用户数: {uc}')
        from models import CareRecord
        cr = db.query(CareRecord).count()
        print(f'6 照护记录数: {cr}')
    finally:
        db.close()
    print('7 全部OK')
except Exception as e:
    print('ERR:', type(e).__name__, e)
    import traceback
    traceback.print_exc()
    sys.exit(1)
