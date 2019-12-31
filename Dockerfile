FROM python:latest

ADD app /app

EXPOSE 80

WORKDIR /app

# required for raspberry pi
# RUN apt-get update && apt-get install -y libzmq3-dev

# RUN python3 setup.py install
RUN python3 setup.py develop

RUN apt-get update && apt-get install zip

ENV PYTHONPATH=.

# CMD ["pserve", "development.ini", "--reload"]
CMD ["gunicorn", "--paste", "production_postgres.ini", "-c", "gunicorn_prod_gthread.conf.py"]
