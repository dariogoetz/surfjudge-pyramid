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

- Install the project.

    env/bin/pip install .

- Run your project.

    development:
    env/bin/pserve development.ini --reload

    production:
    env/bin/gunicorn --paste production.ini
