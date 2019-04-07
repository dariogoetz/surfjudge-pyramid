surfjudge
=========

Getting Started
---------------

- Change directory into your newly created project.

    cd surfjudge

- Create a Python virtual environment (requires package python3-venv).

    python3 -m venv env

- Upgrade packaging tools.

    env/bin/pip install --upgrade pip setuptools

- Install the project (use option -e for development installation).

    env/bin/pip install app

- Run your project.
  - directly:
      cd app

      development:
      ../env/bin/pserve development.ini --reload

      production:
      ../env/bin/gunicorn --paste production.ini

  - via docker-compose
      sudo docker-compose up -d