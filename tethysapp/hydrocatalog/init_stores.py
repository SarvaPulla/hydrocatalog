from .model import engine, SessionMaker, Base, Catalog

def init_hydroserver_catalog(first_time):
    Base.metadata.create_all(engine)

    if first_time:
        session = SessionMaker()
        session.commit()
        session.close()