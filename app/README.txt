surfjudge
=========

Getting Started
---------------

- Change directory into your newly created project.

    cd surfjudge-pyramid/app

- Create a Python virtual environment (requires package python3-venv).

    python3 -m venv env

- Upgrade packaging tools.

    env/bin/pip install --upgrade pip setuptools

- Install the project (use option -e for development installation).

    env/bin/pip install .

- Run your project.

    development (access on port 6543):
    env/bin/pserve development.ini --reload

    production (access on port 80, requires package gevent):
    env/bin/gunicorn --paste production.ini
