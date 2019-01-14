surfjudge
=========

Getting Started
---------------

- Change directory into your newly created project.

    cd surfjudge

- Create a Python virtual environment.

    python3 -m venv env

- Upgrade packaging tools.

    env/bin/pip install --upgrade pip setuptools

- Install the project in editable mode with its testing requirements.

    env/bin/pip install .

- Run your project.

    development:
    env/bin/pserve development.ini --reload

    production:
    env/bin/gunicorn --paste production.ini
