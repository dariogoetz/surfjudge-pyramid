bind = "0.0.0.0:80"
workers = 5
worker_class = "egg:meinheld#gunicorn_worker"

loglevel = "info"
