FROM python:3.7

# required for raspberry pi
# RUN apt-get update && apt-get install -y libzmq3-dev

RUN apt-get update && apt-get install -y zip \
  && rm -rf /var/lib/apt/lists/*

ADD app /app

EXPOSE 80

WORKDIR /app

# RUN python3 setup.py install
RUN python3 setup.py develop

ENV PYTHONPATH=.

# CMD ["pserve", "development.ini", "--reload"]
CMD ["gunicorn", "--paste", "production_postgres.ini", "-c", "gunicorn_prod_meinheld.conf.py"]
