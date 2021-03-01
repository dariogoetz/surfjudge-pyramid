bind = "0.0.0.0:80"
workers = 3
worker_class = "egg:meinheld#gunicorn_worker"

loglevel = "info"
