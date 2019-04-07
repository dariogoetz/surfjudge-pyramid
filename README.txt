surfjudge
=========

Getting Started (natively)
---------------

- Change directory into your newly created project.

    cd surfjudge-pyramid

- Create a Python virtual environment (requires package python3-venv).

    python3 -m venv env

- Upgrade packaging tools.

    env/bin/pip install --upgrade pip setuptools

- Install the project (use option -e for development installation).

    env/bin/pip install app

- Run your project.
  - directly:
      cd app

      development (access on port 6543):
      ../env/bin/pserve development.ini --reload

      production (access on port 80):
      sudo ../env/bin/gunicorn --paste production.ini


Getting Started (using docker)
---------------
- Install and run your project using docker-compose
    sudo docker-compose up -d