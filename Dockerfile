FROM python:latest

ADD app /app

EXPOSE 80

WORKDIR /app

# RUN python3 setup.py install
RUN python3 setup.py develop

ENV PYTHONPATH=.

# CMD ["pserve", "development.ini", "--reload"]
CMD ["gunicorn", "--paste", "production.ini"]